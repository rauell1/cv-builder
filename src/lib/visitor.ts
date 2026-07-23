import { randomUUID } from 'crypto';

export const VISITOR_COOKIE_NAME = 'cvb_vid';
export const VISITOR_HEADER_NAME = 'x-visitor-id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Reads the anonymous visitor cookie from a request, or generates a fresh
 * one. This is NOT a device fingerprint - it's a single random opaque value
 * with no identifying information, used only as a coarse "is this the same
 * browser session as before" signal for the admin dashboard and as a second
 * rate-limiting dimension alongside IP. Clearing cookies (or a private
 * window) gets a fresh one - that's expected. It's a soft signal that
 * raises the bar for casual limit evasion, not a hard security boundary on
 * its own; IP-based limiting remains the primary control.
 */
export function readVisitorIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE_NAME}=([a-zA-Z0-9-]+)`));
  return match ? match[1] : null;
}

export function generateVisitorId(): string {
  return randomUUID();
}

/**
 * Reads the visitor ID that proxy.ts already resolved for this exact
 * request (relayed via a request header) - routes should use this rather
 * than re-parsing the cookie themselves, so logging and rate limiting never
 * disagree about which visitor a request belongs to.
 */
export function getVisitorIdFromRequest(request: { headers: { get(name: string): string | null } }): string | null {
  return request.headers.get(VISITOR_HEADER_NAME);
}

export function visitorCookieOptions() {
  return {
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
  };
}
