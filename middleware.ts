import { NextRequest, NextResponse } from 'next/server';
import { isAIRateLimitPath } from '@/lib/ai-rate-limit-paths';
import { aiRateLimit, generalRateLimit } from '@/lib/rate-limiter';

/**
 * Next.js middleware for rate limiting API routes.
 * Uses IP-based sliding window rate limiting to prevent abuse.
 */

function getClientIP(request: NextRequest): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIP = forwarded.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  // Fallback to a hash of the connection info
  return 'unknown';
}

export function middleware(request: NextRequest) {
  // Only rate-limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check endpoints
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;

  const isAIEndpoint = isAIRateLimitPath(path);

  const limiter = isAIEndpoint ? aiRateLimit : generalRateLimit;
  const result = limiter.check(ip);

  // Add rate limit headers
  const headers = new Headers();
  headers.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  headers.set('X-RateLimit-Window', isAIEndpoint ? '60' : '60');

  if (!result.allowed) {
    headers.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));

    return NextResponse.json(
      {
        success: false,
        error: `Too many requests. Please try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
      },
      {
        status: 429,
        headers,
      }
    );
  }

  return NextResponse.next({
    headers,
  });
}

export const config = {
  matcher: '/api/:path*',
};
