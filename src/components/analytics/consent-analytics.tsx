"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { useCookieConsent } from "@/lib/cookie-consent-context";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function ConsentAnalytics() {
  const { hasConsented, consent } = useCookieConsent();

  if (!hasConsented || !consent.analytics) {
    return null;
  }

  return (
    <>
      {measurementId ? <GoogleAnalytics gaId={measurementId} /> : null}
      <Analytics />
    </>
  );
}
