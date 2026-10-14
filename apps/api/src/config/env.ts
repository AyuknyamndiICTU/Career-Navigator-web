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
    get ollamaBaseUrl(): string | undefined {
      return read('OLLAMA_BASE_URL');
    },
    get ollamaApiKey(): string | undefined {
      return read('OLLAMA_API_KEY');
    },
    get geminiJobMatchEnabled(): boolean {
      return flag('GEMINI_JOB_MATCH_ENABLED');
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
];

const POSITIVE_INT_KEYS = [
  'PORT',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'CV_SCAN_WORKER_CONCURRENCY',
  'NOTIFICATIONS_WORKER_CONCURRENCY',
];

const URL_KEYS: Array<[key: string, protocols: string[]]> = [
  ['DATABASE_URL', ['postgres:', 'postgresql:']],
  ['REDIS_URL', ['redis:', 'rediss:']],
  ['MINIO_ENDPOINT', ['http:', 'https:']],
  ['OLLAMA_BASE_URL', ['http:', 'https:']],
  ['OPENSEARCH_URL', ['http:', 'https:']],
];

/** Throws one error listing every problem, so a bad deploy fails at boot instead of on the first request. */
export function validateEnv(): void {
  const problems: string[] = [];

  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
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

  if ((env.cvScan.enabled || env.notificationsWorker.enabled) && !env.redisUrl) {
    problems.push('REDIS_URL is required when a background worker is enabled');
  }

  if (!env.otp.emailLogOnly && (!env.brevo.apiKey || !env.brevo.senderEmail)) {
    problems.push(
      'BREVO_API_KEY and BREVO_SENDER_EMAIL are required unless OTP_EMAIL_LOG_ONLY=true',
    );
  }

  if (env.isProduction && !env.corsAllowedOrigins) {
    problems.push('CORS_ALLOWED_ORIGINS must list the allowed origins in production');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n - ${problems.join('\n - ')}`,
    );
  }
}
