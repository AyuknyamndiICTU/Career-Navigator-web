import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UserAiCredential } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AiKeyCrypto } from '../gateway/ai-key-crypto';
import { AiPricingService } from '../gateway/ai-pricing.service';
import { AiStateStore } from '../gateway/ai-state.store';
import { AiUsageService, OwnKeyMeta } from '../gateway/ai-usage.service';
import {
  assertAllowedBaseUrl,
  PROVIDERS,
  providerByDbId,
} from '../gateway/providers';
import {
  getOpenRouterKeyInfo,
  OpenRouterKeyInfo,
} from '../gateway/providers/openai-compatible.provider';
import { allTaskProfiles } from '../gateway/task-profiles';
import { AI_TASKS, AiTask, ProviderError, ProviderId } from '../gateway/types';
import type {
  CreateAiCredentialDto,
  UpdateAiCredentialDto,
  UpdateAiPreferencesDto,
} from './dto/ai-credential.dto';

export type OwnRoute = {
  credentialId: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  meta: OwnKeyMeta;
};

export type OwnResolution = { route: OwnRoute } | { blocked: string } | null;

export type ModelOption = { id: string; free: boolean };

const MAX_KEYS_PER_USER = 10;
const MODELS_CACHE_MS = 24 * 3_600_000;
const KEY_INFO_CACHE_MS = 60_000;
const VALIDATION_TIMEOUT_MS = 10_000;

function publicView(c: UserAiCredential, monthSpendUsd: number) {
  return {
    id: c.id,
    provider: c.provider,
    providerName: providerByDbId(c.provider).name,
    label: c.label,
    keyPreview: `••••${c.last4}`,
    baseUrl: c.baseUrl,
    tier: c.tier,
    monthlyBudgetUsd:
      c.monthlyBudgetUsd === null ? null : Number(c.monthlyBudgetUsd),
    monthSpendUsd,
    status: c.status,
    statusReason: c.statusReason,
    lastValidatedAt: c.lastValidatedAt,
    createdAt: c.createdAt,
  };
}

/** Users' own AI keys: storage, validation, model discovery and per-task resolution. */
@Injectable()
export class AiCredentialsService {
  private readonly audit = new Logger('AiKeyAudit');

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AiKeyCrypto,
    private readonly store: AiStateStore,
    private readonly usage: AiUsageService,
    private readonly pricing: AiPricingService,
  ) {}

  private assertEnabled(): void {
    if (!env.ai.byokEnabled) {
      throw new ForbiddenException(
        'Using your own AI keys is disabled on this server',
      );
    }
  }

  private async owned(userId: string, id: string): Promise<UserAiCredential> {
    const credential = await this.prisma.userAiCredential.findFirst({
      where: { id, userId },
    });
    if (!credential) throw new NotFoundException('AI key not found');
    return credential;
  }

  private decrypt(c: UserAiCredential): string {
    const { plaintext, needsReencrypt } = this.crypto.decrypt(c);
    if (needsReencrypt) {
      // Lazy rotation: rows readable only with the previous master key move to the current one.
      void this.prisma.userAiCredential
        .update({ where: { id: c.id }, data: this.crypto.encrypt(plaintext) })
        .catch(() => undefined);
    }
    return plaintext;
  }

  private async baseUrlFor(
    c: Pick<UserAiCredential, 'provider' | 'baseUrl'>,
  ): Promise<string> {
    return c.baseUrl
      ? assertAllowedBaseUrl(c.baseUrl)
      : providerByDbId(c.provider).baseUrl;
  }

  private async fetchModels(
    provider: ProviderId,
    apiKey: string,
    baseUrl: string,
  ) {
    return PROVIDERS[provider].adapter.listModels(
      apiKey,
      baseUrl,
      AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    );
  }

  // ─── Resolution (used by the gateway on every request) ───────────────────────

  async resolveForTask(userId: string, task: AiTask): Promise<OwnResolution> {
    if (!env.ai.byokEnabled) return null;

    let preference: Prisma.UserAiPreferenceGetPayload<{
      include: { credential: true };
    }> | null;
    try {
      preference = await this.prisma.userAiPreference.findUnique({
        where: { userId_task: { userId, task } },
        include: { credential: true },
      });
    } catch {
      return null;
    }
    if (!preference) return null;

    const c = preference.credential;
    const name = `"${c.label}"`;
    if (c.status === 'DISABLED')
      return { blocked: `Your AI key ${name} is turned off.` };
    if (c.status === 'INVALID') {
      return {
        blocked: `Your AI key ${name} was rejected by the provider. Update it in Settings → AI providers.`,
      };
    }

    const budget =
      c.monthlyBudgetUsd === null ? null : Number(c.monthlyBudgetUsd);
    if (budget && (await this.usage.credentialMonthSpendUsd(c.id)) >= budget) {
      return {
        blocked: `Your AI key ${name} used its monthly budget of $${budget.toFixed(2)}. Raise the budget or turn on free fallback.`,
      };
    }

    try {
      const provider = providerByDbId(c.provider).id;
      return {
        route: {
          credentialId: c.id,
          provider,
          model: preference.model,
          apiKey: this.decrypt(c),
          baseUrl: await this.baseUrlFor(c),
          meta: {
            id: c.id,
            tier: c.tier,
            monthlyBudgetUsd: budget,
            label: c.label,
          },
        },
      };
    } catch (err) {
      return {
        blocked: `Your AI key ${name} can't be used: ${(err as Error).message}`,
      };
    }
  }

  /** Called by the gateway when a provider rejects a user's key (401/403). */
  async markInvalid(
    userId: string,
    credentialId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.userAiCredential
      .update({
        where: { id: credentialId },
        data: { status: 'INVALID', statusReason: reason.slice(0, 200) },
      })
      .catch(() => undefined);
    this.audit.log(
      `credential.invalid user=${userId} id=${credentialId} reason="${reason}"`,
    );
    await this.notifyOnce(
      userId,
      credentialId,
      'invalid',
      'The provider rejected one of your AI keys. Requests use the free platform AI (if fallback is on) until you update it in Settings → AI providers.',
    );
  }

  async notifyOnce(
    userId: string,
    credentialId: string,
    kind: string,
    message: string,
  ): Promise<void> {
    if (
      await this.store.setOnce(
        `ai:keynote:${credentialId}:${kind}`,
        '1',
        3_600_000,
      )
    ) {
      await this.usage.notify(userId, message);
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async list(userId: string) {
    const rows = await this.prisma.userAiCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      rows.map(async (c) =>
        publicView(c, await this.usage.credentialMonthSpendUsd(c.id)),
      ),
    );
  }

  async create(userId: string, dto: CreateAiCredentialDto) {
    this.assertEnabled();
    const count = await this.prisma.userAiCredential.count({
      where: { userId },
    });
    if (count >= MAX_KEYS_PER_USER) {
      throw new BadRequestException(
        `You can store up to ${MAX_KEYS_PER_USER} AI keys`,
      );
    }

    const info = providerByDbId(dto.provider);
    if (dto.baseUrl && info.id !== 'openai') {
      throw new BadRequestException(
        'A custom base URL is only supported for OpenAI-compatible keys',
      );
    }

    const apiKey = dto.apiKey.trim();
    let baseUrl = info.baseUrl;
    let models: string[];
    try {
      if (dto.baseUrl) baseUrl = await assertAllowedBaseUrl(dto.baseUrl);
      models = await this.fetchModels(info.id, apiKey, baseUrl);
    } catch (err) {
      throw new BadRequestException(this.validationMessage(err));
    }

    const created = await this.prisma.userAiCredential.create({
      data: {
        userId,
        provider: dto.provider,
        label: dto.label?.trim() || info.name,
        ...this.crypto.encrypt(apiKey),
        last4: apiKey.slice(-4),
        baseUrl: dto.baseUrl ? baseUrl : null,
        tier: dto.tier ?? 'FREE',
        monthlyBudgetUsd: dto.monthlyBudgetUsd ?? null,
        lastValidatedAt: new Date(),
      },
    });
    await this.store.set(
      `ai:models:${created.id}`,
      JSON.stringify(models),
      MODELS_CACHE_MS,
    );
    this.audit.log(
      `credential.create user=${userId} id=${created.id} provider=${created.provider}`,
    );
    return publicView(created, 0);
  }

  private validationMessage(err: unknown): string {
    if (err instanceof ProviderError) {
      if (err.kind === 'auth')
        return 'The provider rejected this key. Check that it is correct and active.';
      if (err.kind === 'bad-request') return err.message;
      return `Could not reach the provider to check the key (${err.message}). Try again shortly.`;
    }
    return `Could not check the key: ${err instanceof Error ? err.message : String(err)}`;
  }

  async update(userId: string, id: string, dto: UpdateAiCredentialDto) {
    await this.owned(userId, id);
    const updated = await this.prisma.userAiCredential.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.tier !== undefined ? { tier: dto.tier } : {}),
        ...(dto.monthlyBudgetUsd !== undefined
          ? { monthlyBudgetUsd: dto.monthlyBudgetUsd }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status, statusReason: null }
          : {}),
      },
    });
    this.audit.log(`credential.update user=${userId} id=${id}`);
    return publicView(updated, await this.usage.credentialMonthSpendUsd(id));
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const { count } = await this.prisma.userAiCredential.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('AI key not found');
    await this.store.del(`ai:models:${id}`);
    this.audit.log(`credential.delete user=${userId} id=${id}`);
    return { deleted: true };
  }

  async test(userId: string, id: string) {
    const c = await this.owned(userId, id);
    const provider = providerByDbId(c.provider).id;
    let status: 'ACTIVE' | 'INVALID' = 'ACTIVE';
    let reason: string | null = null;
    let modelCount = 0;
    let keyInfo: OpenRouterKeyInfo | null = null;

    try {
      const apiKey = this.decrypt(c);
      const baseUrl = await this.baseUrlFor(c);
      const models = await this.fetchModels(provider, apiKey, baseUrl);
      modelCount = models.length;
      await this.store.set(
        `ai:models:${c.id}`,
        JSON.stringify(models),
        MODELS_CACHE_MS,
      );
      if (provider === 'openrouter') keyInfo = await this.keyInfo(c, true);
    } catch (err) {
      if (err instanceof ProviderError && err.kind !== 'auth') {
        throw new BadRequestException(this.validationMessage(err));
      }
      status = 'INVALID';
      reason = this.validationMessage(err);
    }

    const updated = await this.prisma.userAiCredential.update({
      where: { id },
      data: {
        // A user-disabled key stays disabled after a successful test.
        status:
          c.status === 'DISABLED' && status === 'ACTIVE' ? 'DISABLED' : status,
        statusReason: reason,
        lastValidatedAt: new Date(),
      },
    });
    this.audit.log(`credential.test user=${userId} id=${id} result=${status}`);
    return {
      credential: publicView(
        updated,
        await this.usage.credentialMonthSpendUsd(id),
      ),
      ok: status === 'ACTIVE',
      message: reason ?? `Key works — ${modelCount} models available.`,
      keyInfo,
    };
  }

  async models(userId: string, id: string): Promise<ModelOption[]> {
    const c = await this.owned(userId, id);
    const provider = providerByDbId(c.provider).id;

    let models: string[];
    const cached = await this.store.get(`ai:models:${c.id}`);
    if (cached) {
      models = JSON.parse(cached) as string[];
    } else {
      try {
        models = await this.fetchModels(
          provider,
          this.decrypt(c),
          await this.baseUrlFor(c),
        );
      } catch (err) {
        throw new BadRequestException(this.validationMessage(err));
      }
      await this.store.set(
        `ai:models:${c.id}`,
        JSON.stringify(models),
        MODELS_CACHE_MS,
      );
    }

    const options = await Promise.all(
      models.map(async (model) => {
        const price = await this.pricing.priceFor(provider, model);
        const free =
          c.tier === 'FREE' ||
          Boolean(price?.isFree) ||
          (provider === 'openrouter' &&
            (model.endsWith(':free') || model === 'openrouter/free'));
        return { id: model, free };
      }),
    );
    return options.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Live remaining credit for OpenRouter keys (cached 60 s). */
  async keyInfo(
    c: UserAiCredential,
    fresh = false,
  ): Promise<OpenRouterKeyInfo | null> {
    if (c.provider !== 'OPENROUTER') return null;
    const cacheKey = `ai:orkey:${c.id}`;
    if (!fresh) {
      const cached = await this.store.get(cacheKey);
      if (cached) return JSON.parse(cached) as OpenRouterKeyInfo;
    }
    try {
      const info = await getOpenRouterKeyInfo(
        this.decrypt(c),
        await this.baseUrlFor(c),
        AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
      );
      await this.store.set(cacheKey, JSON.stringify(info), KEY_INFO_CACHE_MS);
      return info;
    } catch {
      return null;
    }
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    const [user, prefs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { aiFallbackToPlatform: true },
      }),
      this.prisma.userAiPreference.findMany({ where: { userId } }),
    ]);
    return {
      fallbackToPlatform: user?.aiFallbackToPlatform ?? true,
      tasks: allTaskProfiles().map((p) => {
        const pref = prefs.find((x) => x.task === p.task);
        return {
          task: p.task,
          label: p.label,
          credentialId: pref?.credentialId ?? null,
          model: pref?.model ?? null,
        };
      }),
    };
  }

  async updatePreferences(userId: string, dto: UpdateAiPreferencesDto) {
    if (dto.fallbackToPlatform !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { aiFallbackToPlatform: dto.fallbackToPlatform },
      });
    }

    for (const item of dto.tasks ?? []) {
      const task = item.task as AiTask;
      if (!AI_TASKS.includes(task))
        throw new BadRequestException(`Unknown AI feature ${item.task}`);

      if (!item.credentialId) {
        await this.prisma.userAiPreference.deleteMany({
          where: { userId, task },
        });
        continue;
      }
      this.assertEnabled();
      await this.owned(userId, item.credentialId);
      if (!item.model?.trim())
        throw new BadRequestException(`Pick a model for ${item.task}`);

      await this.prisma.userAiPreference.upsert({
        where: { userId_task: { userId, task } },
        create: {
          userId,
          task,
          credentialId: item.credentialId,
          model: item.model.trim(),
        },
        update: { credentialId: item.credentialId, model: item.model.trim() },
      });
    }
    return this.getPreferences(userId);
  }

  async userAllowsFallback(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { aiFallbackToPlatform: true },
      });
      return user?.aiFallbackToPlatform ?? true;
    } catch {
      return true;
    }
  }
}
