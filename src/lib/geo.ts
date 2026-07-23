import { geolocation } from '@vercel/functions';

/**
 * Country/region/city for a request, from Vercel's edge-set geo headers.
 * Same trust guarantee as ipAddress() - these headers are populated by
 * Vercel's own infrastructure and overwritten if a client tries to send
 * them itself, so they can't be spoofed. See
 * https://vercel.com/docs/headers/request-headers.
 */
export function getRequestGeo(request: Request): { country: string | null; region: string | null; city: string | null } {
  const geo = geolocation(request);
  return {
    country: geo.country ?? null,
    region: geo.countryRegion ?? null,
    city: geo.city ?? null,
  };
}
