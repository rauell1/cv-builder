import { NextResponse } from 'next/server';
import { aiQueue } from '@/lib/request-queue';
import { extractionCache, parsingCache } from '@/lib/response-cache';
import {
  getProviderCredentialDetails,
  getProviderCredentialStatus,
  hasAnyProviderCredentials,
} from '@/lib/ai-provider';

export const dynamic = 'force-dynamic'; // Always run server-side, never cache

export async function GET() {
  const aiMetrics = aiQueue.getMetrics();
  const extCacheStats = extractionCache.getStats();
  const parseCacheStats = parsingCache.getStats();

  const credDetails = getProviderCredentialDetails();
  const anyConfigured = hasAnyProviderCredentials();

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      queues: {
        ai: aiMetrics,
      },
      cache: {
        extraction: extCacheStats,
        parsing: parseCacheStats,
      },
      providers: {
        anyConfigured,
        status: getProviderCredentialStatus(),
        details: credDetails,
      },
    },
    {
      headers: {
        // Allow the client hook to read this without a stale value,
        // but let the CDN cache for 10s to reduce cold hits on Vercel.
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
