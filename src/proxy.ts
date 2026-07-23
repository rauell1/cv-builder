import { NextResponse, type NextRequest } from 'next/server';
import { ipAddress } from '@vercel/functions';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkDailyRateLimit } from '@/lib/daily-rate-limit';
import { AI_RATE_LIMIT_PATHS } from '@/lib/ai-rate-limit-paths';
import {
  readVisitorIdFromCookie, generateVisitorId, visitorCookieOptions,
  VISITOR_COOKIE_NAME, VISITOR_HEADER_NAME,
} from '@/lib/visitor';

// ---------------------------------------------------------------------------
// Route categories - must match the keys in RATE_LIMITS (src/lib/rate-limit.ts)
// ---------------------------------------------------------------------------

const FILE_UPLOAD_PATHS = ['/api/extract-file'];

const PDF_PATHS = [
  '/api/generate-pdf',
  '/api/generate-script',
  '/api/generate-cover-letter-pdf',
];

const HEALTH_PATHS = ['/api/health'];

function matchesPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function categoryForPath(pathname: string): string {
  if (matchesPath(pathname, AI_RATE_LIMIT_PATHS)) return 'ai';
  if (matchesPath(pathname, FILE_UPLOAD_PATHS)) return 'file-upload';
  if (matchesPath(pathname, PDF_PATHS)) return 'pdf';
  if (matchesPath(pathname, HEALTH_PATHS)) return 'health';
  return 'default';
}

// ---------------------------------------------------------------------------
// Security headers - applied to every response
// ---------------------------------------------------------------------------

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function attachSecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
}

// ---------------------------------------------------------------------------
// Proxy (formerly "middleware" - renamed per Next.js 16 convention)
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // ipAddress() is the Vercel-maintained helper for the client IP - Vercel's
  // edge overwrites x-forwarded-for before it reaches this code (see
  // https://vercel.com/docs/headers/request-headers), so this can't be
  // spoofed by a client-supplied header the way a naively-trusted proxy
  // header could be on other platforms.
  const ip = ipAddress(request) || 'unknown';
  const category = categoryForPath(request.nextUrl.pathname);

  // Anonymous visitor cookie: not a fingerprint, just an opaque random ID so
  // the daily cap (below) has a second dimension beyond raw IP. Generated
  // once per browser and relayed to the downstream route via a request
  // header so route handlers and this check always agree on the same value
  // for a given request.
  const existingVisitorId = readVisitorIdFromCookie(request.headers.get('cookie'));
  const visitorId = existingVisitorId || generateVisitorId();
  const isNewVisitor = !existingVisitorId;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(VISITOR_HEADER_NAME, visitorId);

  function finish(res: NextResponse): NextResponse {
    attachSecurityHeaders(res);
    if (isNewVisitor) {
      res.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
    }
    return res;
  }

  // Cheap in-memory burst check first - catches rapid-fire hammering
  // instantly without touching the database.
  const burst = checkRateLimit(ip, category);
  if (!burst.allowed) {
    return finish(NextResponse.json(
      { success: false, error: 'Too many requests', retryAfter: burst.retryAfter },
      { status: 429, headers: { 'Retry-After': String(burst.retryAfter) } },
    ));
  }

  // Persistent daily cap second - catches sustained abuse that stays under
  // the per-minute limit but runs up real AI provider cost over hours.
  // Checked as two independent dimensions: rotating IP alone, or clearing
  // cookies alone, isn't enough to fully reset the cap on its own.
  const [dailyByIp, dailyByVisitor] = await Promise.all([
    checkDailyRateLimit(ip, 'ip', category),
    checkDailyRateLimit(visitorId, 'visitor', category),
  ]);
  if (!dailyByIp.allowed || !dailyByVisitor.allowed) {
    return finish(NextResponse.json(
      { success: false, error: 'Daily request limit reached for this category. Please try again tomorrow.' },
      { status: 429, headers: { 'Retry-After': '86400' } },
    ));
  }

  return finish(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ['/api/:path*'],
};
