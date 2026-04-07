// =============================================================================
// Rate Limiter — Lightweight in-memory IP-based rate limiter
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter using in-memory Map.
 * Limits requests per IP address within a time window.
 */
export class RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60_000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if a request from the given IP is allowed.
   * Returns { allowed, remaining, retryAfterMs }
   */
  check(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();

    // Cleanup expired entries periodically (every check is cheap enough)
    if (this.entries.size > 10000) {
      for (const [key, entry] of this.entries) {
        if (now >= entry.resetAt) {
          this.entries.delete(key);
        }
      }
    }

    let entry = this.entries.get(ip);

    if (!entry || now >= entry.resetAt) {
      // New window
      entry = { count: 1, resetAt: now + this.windowMs };
      this.entries.set(ip, entry);
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterMs: 0 };
    }

    entry.count++;
    const remaining = this.maxRequests - entry.count;

    if (remaining < 0) {
      const retryAfterMs = entry.resetAt - now;
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining, retryAfterMs: 0 };
  }

  /** Get current stats for monitoring */
  getStats() {
    return {
      trackedIPs: this.entries.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }
}

// Preconfigured instances for different endpoint types

/**
 * Strict rate limit for AI-heavy endpoints (extract-file, parse-cv, analyze-job).
 * 20 requests per minute per IP.
 */
export const aiRateLimit = new RateLimiter(60_000, 20);

/**
 * Relaxed rate limit for general API endpoints.
 * 60 requests per minute per IP.
 */
export const generalRateLimit = new RateLimiter(60_000, 60);
