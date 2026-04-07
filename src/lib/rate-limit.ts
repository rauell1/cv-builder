/**
 * In-memory rate limiter for API routes.
 * Per-IP, per-route-category sliding window rate limiting.
 * No external dependencies.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const store: Map<string, RateLimitEntry> = new Map();

// Cleanup stale entries every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function scheduleCleanup(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > now - 60_000);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      clearInterval(cleanupTimer!);
      cleanupTimer = null;
    }
  }, 60_000);
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as unknown as { unref: () => void }).unref();
  }
}

/**
 * Rate limit configurations per category.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  ai: { limit: 10, windowMs: 60_000 },
  'file-upload': { limit: 5, windowMs: 60_000 },
  pdf: { limit: 5, windowMs: 60_000 },
  health: { limit: 60, windowMs: 60_000 },
  default: { limit: 30, windowMs: 60_000 },
};

/**
 * Check rate limit for a given IP and category.
 * Returns `{ allowed, retryAfter }`.
 */
export function checkRateLimit(
  ip: string,
  category: string,
  now: number = Date.now()
): { allowed: boolean; retryAfter: number } {
  const config = RATE_LIMITS[category] || RATE_LIMITS.default;
  const key = `${ip}:${category}`;

  scheduleCleanup();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= config.limit) {
    const oldestTs = entry.timestamps[0];
    const retryAfterMs = oldestTs + config.windowMs - now;
    return { allowed: false, retryAfter: Math.ceil(retryAfterMs / 1000) };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfter: 0 };
}

/**
 * Resolve client IP from request headers.
 */
export function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
