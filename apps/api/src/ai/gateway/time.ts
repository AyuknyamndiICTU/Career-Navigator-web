const DAY_MS = 86_400_000;

/** YYYY-MM-DD in UTC. */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM in UTC (budgets reset on the 1st, UTC). */
export function utcMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function nextUtcMidnight(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

export function nextUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

const pacific = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function pacificParts(date: Date): Record<string, number> {
  return Object.fromEntries(
    pacific
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
}

/** Gemini's per-day quotas reset at midnight Pacific time. */
export function pacificDay(date = new Date()): string {
  const p = pacificParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function msUntilPacificMidnight(date = new Date()): number {
  const p = pacificParts(date);
  const elapsed =
    ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + date.getMilliseconds();
  return Math.max(1_000, DAY_MS - elapsed);
}

export const TTL = {
  day: 2 * DAY_MS,
  month: 40 * DAY_MS,
};
