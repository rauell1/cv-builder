import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { AI_RATE_LIMIT_PATHS } from '@/lib/ai-rate-limit-paths';

// ---------------------------------------------------------------------------
// Route categories — must match the keys in RATE_LIMITS (src/lib/rate-limit.ts)
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
// Security headers — applied to every response
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
// Proxy (formerly "middleware" — renamed per Next.js 16 convention)
// ---------------------------------------------------------------------------

export function proxy(request: NextRequest): NextResponse {
  const ip = resolveClientIp(request);
  const category = categoryForPath(request.nextUrl.pathname);
  const { allowed, retryAfter } = checkRateLimit(ip, category);

  if (!allowed) {
    const response = NextResponse.json(
      { success: false, error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
    attachSecurityHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  attachSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
