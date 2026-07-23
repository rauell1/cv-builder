import { db } from '@/lib/db';

/**
 * Persistent daily request cap per IP + route category, backed by Postgres.
 *
 * The in-memory limiter in rate-limit.ts stops rapid bursts cheaply, but its
 * state is per serverless instance and resets constantly - it cannot stop a
 * sustained abuser who stays just under the per-minute limit for hours,
 * which still runs up real cost on our NVIDIA/Google API keys. This checks
 * a much longer window (a calendar day) that actually holds across every
 * instance, since it lives in the database rather than process memory.
 */

export const DAILY_LIMITS: Record<string, number> = {
  ai: 150,
  'file-upload': 60,
  pdf: 60,
  default: 500,
  // health is excluded on purpose - it's polled by uptime monitors, not users.
};

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Atomically increments today's counter for this ip+category and returns
 * the count after incrementing. A single INSERT ... ON CONFLICT DO UPDATE
 * is used (rather than a separate read-then-write) so concurrent requests
 * from the same IP can't race past the limit.
 */
async function incrementAndGetCount(ip: string, category: string, day: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "DailyRateLimit" (id, ip, category, day, count, "updatedAt")
    VALUES (gen_random_uuid()::text, ${ip}, ${category}, ${day}, 1, now())
    ON CONFLICT (ip, category, day)
    DO UPDATE SET count = "DailyRateLimit".count + 1, "updatedAt" = now()
    RETURNING count;
  `;
  return rows[0]?.count ?? 1;
}

/**
 * Checks (and records) today's request against the daily cap for this
 * ip+category. Fails open on any database error - a DB hiccup should not
 * take the whole site down, since the per-minute in-memory limiter in
 * rate-limit.ts still provides a baseline of protection either way.
 */
export async function checkDailyRateLimit(
  ip: string,
  category: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const limit = DAILY_LIMITS[category];
  if (!limit || ip === 'unknown') {
    return { allowed: true, count: 0, limit: limit ?? Infinity };
  }

  try {
    const count = await incrementAndGetCount(ip, category, todayUTC());
    return { allowed: count <= limit, count, limit };
  } catch (err) {
    console.warn('[daily-rate-limit] Check failed, failing open:', err instanceof Error ? err.message : err);
    return { allowed: true, count: 0, limit };
  }
}
