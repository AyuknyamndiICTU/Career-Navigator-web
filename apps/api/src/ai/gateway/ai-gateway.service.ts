import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AiCredentialsService, OwnRoute } from '../byok/ai-credentials.service';
import { AiQuotaExceededError, AiQuotaService } from './ai-quota.service';
import { AiStateStore } from './ai-state.store';
import { AiUsageService, MeteredUsage } from './ai-usage.service';
import { toNetworkError } from './http';
import { ModelHealthService } from './model-health.service';
import { PROVIDERS } from './providers';
import { platformRoute, TaskProfile, taskProfile } from './task-profiles';
import {
  AiTask,
  ChatTurn,
  EMPTY_USAGE,
  ProviderCall,
  ProviderError,
  ProviderId,
  TokenUsage,
} from './types';

export type AiRequest = {
  task: AiTask;
  userId: string;
  system: string;
  messages: ChatTurn[];
  /** Aborts provider calls when the client goes away. */
  signal?: AbortSignal;
  /** Deterministic tasks: reuse an answer for the same key (scoped per user when their own key is used). */
  cache?: { key: string; ttlMs: number };
};

export type AiResult = {
  text: string;
  provider: ProviderId;
  model: string;
  viaOwnKey: boolean;
  cached: boolean;
  latencyMs: number;
  usage: MeteredUsage;
};

export type AiStreamEvent =
  | { type: 'start'; provider: ProviderId; model: string; viaOwnKey: boolean }
  | { type: 'delta'; text: string }
  | { type: 'usage'; outputTokensEstimate: number }
  | { type: 'done'; result: AiResult };

type Candidate = {
  /** Health/cooldown key: platform `p:provider/model`, own key `c:credentialId/model`. */
  key: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  own: OwnRoute | null;
};

type Plan = {
  candidates: Candidate[];
  ownBlocked: string | null;
  cacheScope: string;
};

export class AiCancelledError extends Error {
  constructor() {
    super('AI request cancelled by the client');
  }
}

const CACHE_HIT_USAGE: MeteredUsage = {
  ...EMPTY_USAGE,
  costUsd: 0,
  costSource: 'FREE',
  estimated: false,
};

/** Rough token estimate for partial streams (≈4 characters per token). */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/**
 * One entry point for every AI call. Order per request: the user's own key for the task
 * (if set, valid and within budget) → the platform's free chain (if the user allows fallback and
 * still has free allowance today). Each candidate gets a per-attempt timeout inside a total time
 * budget; 429s cool the model down, repeated failures open its circuit, and every call is metered.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger('AiGateway');

  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly health: ModelHealthService,
    private readonly quota: AiQuotaService,
    private readonly usage: AiUsageService,
    private readonly store: AiStateStore,
  ) {}

  // ─── Planning ─────────────────────────────────────────────────────────────

  private async plan(req: AiRequest): Promise<Plan> {
    const candidates: Candidate[] = [];
    const own = await this.credentials.resolveForTask(req.userId, req.task);
    let ownBlocked: string | null = null;

    if (own && 'route' in own) {
      const key = `c:${own.route.credentialId}/${own.route.model}`;
      const reason = await this.health.unavailableReason(key, false);
      if (reason) {
        ownBlocked = `Your AI key "${own.route.meta.label}" is temporarily unavailable (${reason}).`;
      } else {
        candidates.push({
          key,
          provider: own.route.provider,
          model: own.route.model,
          apiKey: own.route.apiKey,
          baseUrl: own.route.baseUrl,
          own: own.route,
        });
      }
    } else if (own) {
      ownBlocked = own.blocked;
    }

    const usePlatform =
      !own || (await this.credentials.userAllowsFallback(req.userId));
    if (usePlatform) {
      for (const entry of platformRoute(req.task)) {
        const apiKey = PROVIDERS[entry.provider].platformKey();
        if (!apiKey) continue;
        const key = `p:${entry.provider}/${entry.model}`;
        if (await this.health.unavailableReason(key, true)) continue;
        candidates.push({
          key,
          provider: entry.provider,
          model: entry.model,
          apiKey,
          baseUrl: PROVIDERS[entry.provider].baseUrl,
          own: null,
        });
      }
    }

    // Answers produced with a user's own key are never shared with other users.
    const cacheScope = candidates[0]?.own ? `u:${req.userId}` : 'p';
    return { candidates, ownBlocked, cacheScope };
  }

  private call(
    c: Candidate,
    req: AiRequest,
    profile: TaskProfile,
    signal: AbortSignal,
  ): ProviderCall {
    return {
      model: c.model,
      system: req.system,
      messages: req.messages,
      maxOutputTokens: profile.maxOutputTokens,
      temperature: profile.temperature,
      json: profile.json,
      apiKey: c.apiKey,
      baseUrl: c.baseUrl,
      signal,
    };
  }

  private cacheKey(req: AiRequest, scope: string): string {
    const digest = createHash('sha256').update(req.cache!.key).digest('hex');
    return `ai:cache:${req.task}:${scope}:${digest}`;
  }

  // ─── Failure handling ─────────────────────────────────────────────────────

  private async onFailure(
    c: Candidate,
    req: AiRequest,
    err: ProviderError,
    latencyMs: number,
  ) {
    this.logger.warn(
      `ai task=${req.task} provider=${c.provider} model=${c.model} own=${Boolean(c.own)} status=error kind=${err.kind} latencyMs=${latencyMs} msg="${err.message}"`,
    );
    await this.health.recordFailure(c.key, err);
    await this.usage
      .record({
        userId: req.userId,
        task: req.task,
        provider: c.provider,
        model: c.model,
        ownKey: c.own?.meta ?? null,
        usage: EMPTY_USAGE,
        latencyMs,
        status: 'error',
      })
      .catch(() => undefined);

    if (!c.own) return;
    if (err.kind === 'auth') {
      await this.credentials.markInvalid(
        req.userId,
        c.own.credentialId,
        err.message,
      );
    } else if (err.kind === 'payment') {
      await this.credentials.notifyOnce(
        req.userId,
        c.own.credentialId,
        'payment',
        `Your AI key "${c.own.meta.label}" is out of credit at the provider. Top it up, or requests use the free platform AI if fallback is on.`,
      );
    } else if (err.kind === 'rate-limit' || err.kind === 'daily-quota') {
      await this.credentials.notifyOnce(
        req.userId,
        c.own.credentialId,
        err.kind,
        `Your AI key "${c.own.meta.label}" hit the provider's rate limit; it is paused briefly.`,
      );
    }
  }

  private async onSuccess(
    c: Candidate,
    req: AiRequest,
    text: string,
    usage: TokenUsage,
    latencyMs: number,
    status: 'ok' | 'cancelled' = 'ok',
  ): Promise<AiResult> {
    await this.health.recordSuccess(c.key);
    if (!c.own) await this.quota.consume(req.userId, req.task);

    const metered = await this.usage.record({
      userId: req.userId,
      task: req.task,
      provider: c.provider,
      model: c.model,
      ownKey: c.own?.meta ?? null,
      usage,
      latencyMs,
      status,
    });

    this.logger.log(
      `ai task=${req.task} provider=${c.provider} model=${c.model} own=${Boolean(c.own)} status=${status} latencyMs=${latencyMs} in=${metered.inputTokens} out=${metered.outputTokens} cachedIn=${metered.cachedTokens} cost=${metered.costUsd.toFixed(6)} cacheHit=false`,
    );

    return {
      text,
      provider: c.provider,
      model: c.model,
      viaOwnKey: Boolean(c.own),
      cached: false,
      latencyMs,
      usage: metered,
    };
  }

  /** Error after every candidate failed or was skipped. */
  private exhausted(
    plan: Plan,
    quotaError: HttpException | null,
  ): HttpException {
    if (plan.candidates.length === 0 && plan.ownBlocked) {
      return new ServiceUnavailableException(plan.ownBlocked);
    }
    if (quotaError) return quotaError;
    const anyPlatformKey = Object.values(PROVIDERS).some((p) =>
      p.platformKey(),
    );
    if (plan.candidates.length === 0 && !anyPlatformKey) {
      return new ServiceUnavailableException(
        'AI is not configured on this server. Add your own API key in Settings → AI providers.',
      );
    }
    return new ServiceUnavailableException(
      plan.ownBlocked ??
        'The AI assistant is busy right now. Please try again in a minute.',
    );
  }

  /** Platform candidates need free allowance left today; checked once per request. */
  private async platformAllowed(
    c: Candidate,
    req: AiRequest,
    state: { checked: boolean; error: HttpException | null },
  ): Promise<boolean> {
    if (c.own) return true;
    if (!state.checked) {
      state.checked = true;
      try {
        await this.quota.assertAvailable(req.userId, req.task);
      } catch (err) {
        if (!(err instanceof AiQuotaExceededError)) throw err;
        state.error = err;
      }
    }
    return state.error === null;
  }

  // ─── Generate (non-streamed) ──────────────────────────────────────────────

  async generate(req: AiRequest): Promise<AiResult> {
    const profile = taskProfile(req.task);
    const started = Date.now();
    const deadline = started + profile.totalBudgetMs();
    const plan = await this.plan(req);

    if (req.cache) {
      const hit = await this.store.get(this.cacheKey(req, plan.cacheScope));
      if (hit) {
        const cached = JSON.parse(hit) as Pick<
          AiResult,
          'text' | 'provider' | 'model' | 'viaOwnKey'
        >;
        this.logger.log(
          `ai task=${req.task} cacheHit=true provider=${cached.provider} model=${cached.model}`,
        );
        return {
          ...cached,
          cached: true,
          latencyMs: Date.now() - started,
          usage: CACHE_HIT_USAGE,
        };
      }
    }

    const quotaState = { checked: false, error: null as HttpException | null };

    for (const c of plan.candidates) {
      if (!(await this.platformAllowed(c, req, quotaState))) break;

      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 500) throw this.exhausted(plan, quotaState.error);

        const attemptStarted = Date.now();
        const timeout = AbortSignal.timeout(
          Math.min(profile.attemptTimeoutMs, remaining),
        );
        const signal = req.signal
          ? AbortSignal.any([req.signal, timeout])
          : timeout;

        try {
          const out = await PROVIDERS[c.provider].adapter.generate(
            this.call(c, req, profile, signal),
          );
          if (!out.text.trim())
            throw new ProviderError('server', 'Empty response');

          const result = await this.onSuccess(
            c,
            req,
            out.text,
            out.usage,
            Date.now() - attemptStarted,
          );
          if (req.cache) {
            await this.store.set(
              this.cacheKey(req, plan.cacheScope),
              JSON.stringify({
                text: result.text,
                provider: result.provider,
                model: result.model,
                viaOwnKey: result.viaOwnKey,
              }),
              req.cache.ttlMs,
            );
          }
          return result;
        } catch (e) {
          if (req.signal?.aborted) throw new AiCancelledError();
          const err = toNetworkError(e, signal);
          await this.onFailure(c, req, err, Date.now() - attemptStarted);
          // One retry per model, and only for transient server/network errors.
          if (!err.retryable) break;
        }
      }
    }

    throw this.exhausted(plan, quotaState.error);
  }

  // ─── Stream ───────────────────────────────────────────────────────────────

  async *stream(req: AiRequest): AsyncGenerator<AiStreamEvent> {
    const profile = taskProfile(req.task);
    const deadline = Date.now() + profile.totalBudgetMs();
    const plan = await this.plan(req);
    const quotaState = { checked: false, error: null as HttpException | null };

    for (const c of plan.candidates) {
      if (!(await this.platformAllowed(c, req, quotaState))) break;

      const remaining = deadline - Date.now();
      if (remaining < 500) break;

      const attemptStarted = Date.now();
      const controller = new AbortController();
      const onClientAbort = () => controller.abort(new AiCancelledError());
      req.signal?.addEventListener('abort', onClientAbort, { once: true });
      // Until the first token: the first-token timeout; afterwards: what's left of the total budget.
      let timer = setTimeout(
        () =>
          controller.abort(
            new Error(
              `No answer within ${Math.round(profile.firstTokenTimeoutMs / 1000)}s`,
            ),
          ),
        Math.min(profile.firstTokenTimeoutMs, remaining),
      );

      let text = '';
      let usage: TokenUsage | null = null;
      let deltas = 0;

      try {
        for await (const event of PROVIDERS[c.provider].adapter.stream(
          this.call(c, req, profile, controller.signal),
        )) {
          if (event.type === 'usage') {
            usage = event.usage;
            continue;
          }
          if (deltas === 0) {
            clearTimeout(timer);
            timer = setTimeout(
              () => controller.abort(new Error('The answer took too long')),
              Math.max(1_000, deadline - Date.now()),
            );
            yield {
              type: 'start',
              provider: c.provider,
              model: c.model,
              viaOwnKey: Boolean(c.own),
            };
          }
          deltas += 1;
          text += event.text;
          yield { type: 'delta', text: event.text };
          if (deltas % 20 === 0)
            yield { type: 'usage', outputTokensEstimate: estimateTokens(text) };
        }

        if (deltas === 0) throw new ProviderError('server', 'Empty response');

        const result = await this.onSuccess(
          c,
          req,
          text,
          usage ?? { ...EMPTY_USAGE, outputTokens: estimateTokens(text) },
          Date.now() - attemptStarted,
        );
        yield { type: 'done', result };
        return;
      } catch (e) {
        if (req.signal?.aborted) {
          // Client left mid-answer: bill what was generated (estimated, the provider sent no totals).
          if (deltas > 0) {
            await this.onSuccess(
              c,
              req,
              text,
              usage ?? {
                ...EMPTY_USAGE,
                inputTokens: estimateTokens(
                  req.system + req.messages.map((m) => m.content).join(''),
                ),
                outputTokens: estimateTokens(text),
              },
              Date.now() - attemptStarted,
              'cancelled',
            ).catch(() => undefined);
          }
          return;
        }
        const err = toNetworkError(e, controller.signal);
        await this.onFailure(c, req, err, Date.now() - attemptStarted);
        // Text already shown can't be swapped for another model's answer.
        if (deltas > 0) {
          throw new ServiceUnavailableException(
            'The answer was interrupted. Please try again.',
          );
        }
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onClientAbort);
      }
    }

    throw this.exhausted(plan, quotaState.error);
  }
}
