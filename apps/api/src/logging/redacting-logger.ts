import { ConsoleLogger } from '@nestjs/common';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|password|newpassword|currentpassword|otp|otpcode|apikey|api_key|x-api-key|x-goog-api-key|secret|accesstoken|refreshtoken|token)$/i;

const STRING_RULES: Array<[RegExp, string]> = [
  // Secrets in query strings, e.g. Gemini's `?key=...`.
  [
    /([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"']+/gi,
    `$1${REDACTED}`,
  ],
  [/(Bearer\s+)[\w\-.~+/]+=*/gi, `$1${REDACTED}`],
  // `"apiKey":"..."`, `password=...`, `x-goog-api-key: ...` inside serialized text.
  [
    /(["']?\b(?:authorization|cookie|password|newPassword|otp|otpCode|apiKey|api_key|x-api-key|x-goog-api-key|secret|accessToken|refreshToken)\b["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}&]+)/gi,
    `$1"${REDACTED}"`,
  ],
];

export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return STRING_RULES.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      value,
    );
  }
  if (
    value instanceof Error ||
    value === null ||
    typeof value !== 'object' ||
    depth > 4
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1),
    ]),
  );
}

/** Nest's console logger (JSON lines in production) with tokens, passwords, OTPs and API keys masked. */
export class RedactingLogger extends ConsoleLogger {
  log(message: unknown, ...rest: unknown[]): void {
    super.log(redact(message), ...rest.map((v) => redact(v)));
  }

  error(message: unknown, ...rest: unknown[]): void {
    super.error(redact(message), ...rest.map((v) => redact(v)));
  }

  warn(message: unknown, ...rest: unknown[]): void {
    super.warn(redact(message), ...rest.map((v) => redact(v)));
  }

  debug(message: unknown, ...rest: unknown[]): void {
    super.debug(redact(message), ...rest.map((v) => redact(v)));
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    super.verbose(redact(message), ...rest.map((v) => redact(v)));
  }

  fatal(message: unknown, ...rest: unknown[]): void {
    super.fatal(redact(message), ...rest.map((v) => redact(v)));
  }
}
