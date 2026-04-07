import { NextResponse } from "next/server";
import { aiQueue, requestQueue } from "@/lib/request-queue";
import { extractionCache, parsingCache } from "@/lib/response-cache";

export async function GET() {
  try {
    const aiMetrics = aiQueue.getMetrics();
    const generalMetrics = requestQueue.getMetrics();
    const extractionStats = extractionCache.getStats();
    const parsingStats = parsingCache.getStats();

    const mem = process.memoryUsage();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      },
      aiQueue: {
        active: aiMetrics.activeCount,
        queued: aiMetrics.queueLength,
        completed: aiMetrics.completedCount,
        failed: aiMetrics.failedCount,
        dropped: aiMetrics.droppedCount,
        avgWaitMs: Math.round(aiMetrics.averageWaitTimeMs),
        totalProcessed: aiMetrics.totalProcessed,
      },
      generalQueue: {
        active: generalMetrics.activeCount,
        queued: generalMetrics.queueLength,
        completed: generalMetrics.completedCount,
        failed: generalMetrics.failedCount,
        avgWaitMs: Math.round(generalMetrics.averageWaitTimeMs),
        totalProcessed: generalMetrics.totalProcessed,
      },
      cache: {
        extraction: extractionStats,
        parsing: parsingStats,
      },
    });
  } catch (error) {
    // Health endpoint should always return 200, even with degraded data
    console.error('[health] Error collecting metrics:', error);
    return NextResponse.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
      aiQueue: { active: 0, queued: 0, completed: 0, failed: 0, dropped: 0, avgWaitMs: 0, totalProcessed: 0 },
      generalQueue: { active: 0, queued: 0, completed: 0, failed: 0, avgWaitMs: 0, totalProcessed: 0 },
      cache: { extraction: {}, parsing: {} },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
