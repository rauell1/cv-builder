import { NextResponse } from 'next/server';
import { aiQueue, requestQueue } from '@/lib/request-queue';
import { extractionCache, parsingCache } from '@/lib/response-cache';
import { getProviderCredentialDetails, getProviderCredentialStatus, hasAnyProviderCredentials } from '@/lib/ai-provider';

export async function GET() {
  const aiMetrics = aiQueue.getMetrics();
  const reqMetrics = requestQueue.getMetrics();
  const extCacheStats = extractionCache.getStats();
  const parseCacheStats = parsingCache.getStats();

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    queues: {
      ai: aiMetrics,
      general: reqMetrics,
    },
    cache: {
      extraction: extCacheStats,
      parsing: parseCacheStats,
    },
    providers: {
      anyConfigured: hasAnyProviderCredentials(),
      status: getProviderCredentialStatus(),
      details: getProviderCredentialDetails(),
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
