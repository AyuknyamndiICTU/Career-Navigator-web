import { parseDurationToMs } from '../auth/jwt/jwt-utils';

// The only module that reads process.env. Getters are evaluated on access so tests can change values per case.

function read(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function flag(key: string): boolean {
  return read(key) === 'true';
}

function positiveInt(key: string, fallback: number): number {
  const value = Number(read(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const env = {
  get nodeEnv(): string {
    return read('NODE_ENV') ?? 'development';
  },
  get isProduction(): boolean {
    return read('NODE_ENV') === 'production';
  },
  get port(): number {
    return positiveInt('PORT', 3000);
  },
  get databaseUrl(): string | undefined {
    return read('DATABASE_URL');
  },
  get redisUrl(): string | undefined {
    return read('REDIS_URL');
  },
  get publicApiBaseUrl(): string | undefined {
    return read('API_BASE_URL') ?? read('NEXT_PUBLIC_API_BASE_URL');
  },
  /** undefined = no allow-list configured (reflect the request origin; dev only). */
  get corsAllowedOrigins(): string[] | undefined {
    const raw = read('CORS_ALLOWED_ORIGINS');
    if (!raw || raw === '*') return undefined;
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  },
  get cookieSecure(): boolean {
    const override = read('COOKIE_SECURE');
    return override ? override === 'true' : this.isProduction;
  },
  get swaggerEnabled(): boolean {
    const override = read('SWAGGER_ENABLED');
    return override ? override === 'true' : !this.isProduction;
  },
  get rateLimitWindowMs(): number {
    return positiveInt('RATE_LIMIT_WINDOW_MS', 60_000);
  },
  get rateLimitMax(): number {
    return positiveInt('RATE_LIMIT_MAX', 200);
  },
  jwt: {
    get accessSecret(): string | undefined {
      return read('JWT_ACCESS_SECRET');
    },
    get refreshSecret(): string | undefined {
      return read('JWT_REFRESH_SECRET');
    },
    get accessExpiresIn(): string {
      return read('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    },
    get refreshExpiresIn(): string {
      return read('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    },
  },
  otp: {
    get emailLogOnly(): boolean {
      return flag('OTP_EMAIL_LOG_ONLY');
    },
  },
  brevo: {
    get apiKey(): string | undefined {
      return read('BREVO_API_KEY');
    },
    get senderEmail(): string | undefined {
      return read('BREVO_SENDER_EMAIL');
    },
  },
  minio: {
    get endpoint(): string | undefined {
      return read('MINIO_ENDPOINT');
    },
    get accessKey(): string | undefined {
      return read('MINIO_ACCESS_KEY');
    },
    get secretKey(): string | undefined {
      return read('MINIO_SECRET_KEY');
    },
    get bucket(): string {
      return read('MINIO_BUCKET') ?? 'resumes';
    },
  },
  opensearch: {
    get url(): string | undefined {
      return read('OPENSEARCH_URL');
    },
    get username(): string | undefined {
      return read('OPENSEARCH_USERNAME');
    },
    get password(): string | undefined {
      return read('OPENSEARCH_PASSWORD');
    },
  },
  ai: {
    get geminiApiKey(): string | undefined {
      return read('GEMINI_API_KEY');
    },
    get ollamaApiKey(): string | undefined {
      return read('OLLAMA_API_KEY');
    },
    get anthropicApiKey(): string | undefined {
      return read('ANTHROPIC_API_KEY');
    },
    get openrouterApiKey(): string | undefined {
      return read('OPENROUTER_API_KEY');
    },
    get openaiApiKey(): string | undefined {
      return read('OPENAI_API_KEY');
    },
    get jobMatchEnabled(): boolean {
      return flag('AI_JOB_MATCH_ENABLED') || flag('GEMINI_JOB_MATCH_ENABLED');
    },
    /** Comma-separated `provider/model` chain for a task, e.g. AI_ROUTE_CHAT. */
    route(task: string): string | undefined {
      return read(`AI_ROUTE_${task.toUpperCase().replace(/-/g, '_')}`);
    },
    get chatTimeBudgetMs(): number {
      return positiveInt('AI_CHAT_TIME_BUDGET_MS', 20_000);
    },
    /** Daily platform-AI calls per user and task, e.g. AI_USER_DAILY_LIMIT_CHAT. */
    userDailyLimit(task: string, fallback: number): number {
      return positiveInt(
        `AI_USER_DAILY_LIMIT_${task.toUpperCase().replace(/-/g, '_')}`,
        fallback,
      );
    },
    /** `provider/model=N` pairs capping platform calls per model per day. */
    get modelDailyLimits(): Map<string, number> {
      const limits = new Map<string, number>();
      for (const pair of (read('AI_MODEL_DAILY_LIMITS') ?? '').split(',')) {
        const at = pair.lastIndexOf('=');
        const limit = Number(pair.slice(at + 1));
        if (at > 0 && Number.isInteger(limit) && limit > 0) {
          limits.set(pair.slice(0, at).trim(), limit);
        }
      }
      return limits;
    },
    /** Platform providers whose usage is free (tokens counted, cost $0). */
    get platformFreeProviders(): string[] {
      return (read('AI_PLATFORM_FREE_PROVIDERS') ?? 'gemini,openrouter')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    },
    get byokEnabled(): boolean {
      return flag('AI_BYOK_ENABLED') && Boolean(read('AI_KEY_ENCRYPTION_KEY'));
    },
    get keyEncryptionKey(): string | undefined {
      return read('AI_KEY_ENCRYPTION_KEY');
    },
    get keyEncryptionKeyPrevious(): string | undefined {
      return read('AI_KEY_ENCRYPTION_KEY_PREVIOUS');
    },
    get keyEncryptionKeyVersion(): number {
      return positiveInt('AI_KEY_ENCRYPTION_KEY_VERSION', 1);
    },
    /** Extra HTTPS hosts users may point OpenAI-compatible keys at. */
    get byokAllowedHosts(): string[] {
      return (read('AI_BYOK_ALLOWED_HOSTS') ?? '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    },
  },
  cvScan: {
    get enabled(): boolean {
      return flag('CV_SCAN_ENABLED');
    },
    get concurrency(): number {
      return positiveInt('CV_SCAN_WORKER_CONCURRENCY', 1);
    },
  },
  notificationsWorker: {
    get enabled(): boolean {
      return flag('NOTIFICATIONS_WORKER_ENABLED');
    },
    get concurrency(): number {
      return positiveInt('NOTIFICATIONS_WORKER_CONCURRENCY', 2);
    },
  },
  agora: {
    get appId(): string | undefined {
      return read('AGORA_APP_ID');
    },
    get appCertificate(): string | undefined {
      return read('AGORA_APP_CERTIFICATE');
    },
  },
};

const BOOLEAN_KEYS = [
  'OTP_EMAIL_LOG_ONLY',
  'CV_SCAN_ENABLED',
  'NOTIFICATIONS_WORKER_ENABLED',
  'COOKIE_SECURE',
  'SWAGGER_ENABLED',
  'GEMINI_JOB_MATCH_ENABLED',
  'AI_JOB_MATCH_ENABLED',
  'AI_BYOK_ENABLED',
];

const POSITIVE_INT_KEYS = [
  'PORT',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'CV_SCAN_WORKER_CONCURRENCY',
  'NOTIFICATIONS_WORKER_CONCURRENCY',
  'AI_CHAT_TIME_BUDGET_MS',
  'AI_KEY_ENCRYPTION_KEY_VERSION',
];

const URL_KEYS: Array<[key: string, protocols: string[]]> = [
  ['DATABASE_URL', ['postgres:', 'postgresql:']],
  ['REDIS_URL', ['redis:', 'rediss:']],
  ['MINIO_ENDPOINT', ['http:', 'https:']],
  ['OPENSEARCH_URL', ['http:', 'https:']],
];

function isAes256Key(value: string | undefined): boolean {
  return Boolean(value) && Buffer.from(value!, 'base64').length === 32;
}

/** Throws one error listing every problem, so a bad deploy fails at boot instead of on the first request. */
export function validateEnv(): void {
  const problems: string[] = [];

  for (const key of [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ]) {
    if (!read(key)) problems.push(`${key} is required`);
  }

  for (const key of ['JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN']) {
    const value = read(key);
    if (!value) continue;
    try {
      parseDurationToMs(value);
    } catch {
      problems.push(`${key} must look like 15m, 12h or 30d (got "${value}")`);
    }
  }

  for (const key of BOOLEAN_KEYS) {
    const value = read(key);
    if (value && value !== 'true' && value !== 'false') {
      problems.push(`${key} must be "true" or "false" (got "${value}")`);
    }
  }

  for (const key of POSITIVE_INT_KEYS) {
    const value = read(key);
    if (value && !(Number.isInteger(Number(value)) && Number(value) > 0)) {
      problems.push(`${key} must be a positive integer (got "${value}")`);
    }
  }

  for (const [key, protocols] of URL_KEYS) {
    const value = read(key);
    if (!value) continue;
    try {
      if (!protocols.includes(new URL(value).protocol)) throw new Error();
    } catch {
      problems.push(`${key} must be a ${protocols.join(' or ')} URL`);
    }
  }

  if (
    (env.cvScan.enabled || env.notificationsWorker.enabled) &&
    !env.redisUrl
  ) {
    problems.push('REDIS_URL is required when a background worker is enabled');
  }

  if (!env.otp.emailLogOnly && (!env.brevo.apiKey || !env.brevo.senderEmail)) {
    problems.push(
      'BREVO_API_KEY and BREVO_SENDER_EMAIL are required unless OTP_EMAIL_LOG_ONLY=true',
    );
  }

  if (env.isProduction && env.otp.emailLogOnly) {
    problems.push(
      'OTP_EMAIL_LOG_ONLY=true would write live OTPs to production logs',
    );
  }

  if (flag('AI_BYOK_ENABLED') && !isAes256Key(env.ai.keyEncryptionKey)) {
    problems.push(
      'AI_KEY_ENCRYPTION_KEY must be 32 random bytes in base64 when AI_BYOK_ENABLED=true (openssl rand -base64 32)',
    );
  }
  if (
    env.ai.keyEncryptionKeyPrevious &&
    !isAes256Key(env.ai.keyEncryptionKeyPrevious)
  ) {
    problems.push('AI_KEY_ENCRYPTION_KEY_PREVIOUS must be 32 bytes in base64');
  }

  if (env.isProduction && !env.corsAllowedOrigins) {
    problems.push(
      'CORS_ALLOWED_ORIGINS must list the allowed origins in production',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n - ${problems.join('\n - ')}`,
    );
  }
}
