import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIRaceForTask,
  getProviderCredentialDetails,
  getProviderCredentialStatus,
  hasAnyProviderCredentials,
  AIModelFailedError,
} from '@/lib/ai-provider';
import { JOB_ANALYSIS_SYSTEM_PROMPT, type JobAnalysis } from '@/lib/cv-types';
import { extractJSON, fixCommonJSONIssues } from '@/lib/json-utils';
import { aiQueue } from '@/lib/request-queue';
import { parsingCache, hashContent } from '@/lib/response-cache';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  // Rate limiting (consistent with parse-cv)
  const ip = resolveClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip, 'ai');
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please try again in ${retryAfter} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { jobDescText, sessionId } = body;

    if (!jobDescText || typeof jobDescText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'jobDescText is required and must be a string' },
        { status: 400 }
      );
    }

    if (jobDescText.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: 'Job description is too short. Please provide more details.' },
        { status: 400 }
      );
    }

    // --- Cache check (instant) ---
    const cacheKey = `job:${hashContent(jobDescText.trim())}`;
    const cached = parsingCache.get(cacheKey) as { jobAnalysis: JobAnalysis; usedModel: string } | null;
    if (cached) {
      console.warn('[analyze-job] Cache hit:', cacheKey.substring(0, 12));
      if (sessionId) {
        db.cVSession.update({
          where: { id: sessionId },
          data: { jobDescText, analyzedJob: JSON.stringify(cached.jobAnalysis), step: 3, updatedAt: new Date() },
        }).catch(() => { /* non-critical */ });
      }
      return NextResponse.json({ success: true, data: cached.jobAnalysis, model: cached.usedModel, cached: true });
    }

    // --- Credential check ---
    if (!hasAnyProviderCredentials()) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI provider is configured. Set one of: ZHIPU_API_KEY (or GLM_API_KEY/BIGMODEL_API_KEY), OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, NVIDIA_API_KEY.',
          providerStatus: getProviderCredentialStatus(),
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    // --- Race 2 reasoning models in parallel (was sequential callAIWithFallback) ---
    const { content: responseText, model: usedModel } = await aiQueue.enqueue(
      () => callAIRaceForTask(
        'analyze',
        [
          { role: 'system', content: JOB_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: jobDescText },
        ],
        1,    // sequential — avoids burning 2 NVIDIA slots simultaneously when rate-limited
        0.2,
      ),
      'normal',
      30_000
    );

    // Parse JSON response
    let jobAnalysis: JobAnalysis;
    try {
      const rawJson = extractJSON(responseText);
      if (!rawJson) throw new Error('No JSON object found in response');
      jobAnalysis = JSON.parse(fixCommonJSONIssues(rawJson)) as JobAnalysis;

      if (!jobAnalysis.jobTitle && !jobAnalysis.summary) {
        throw new Error('Missing required fields: jobTitle or summary');
      }
      // Ensure all fields have defaults
      jobAnalysis.keyRequirements       = jobAnalysis.keyRequirements       || [];
      jobAnalysis.preferredSkills       = jobAnalysis.preferredSkills       || [];
      jobAnalysis.keywords              = jobAnalysis.keywords              || [];
      jobAnalysis.requiredQualifications  = jobAnalysis.requiredQualifications  || [];
      jobAnalysis.preferredQualifications = jobAnalysis.preferredQualifications || [];
      jobAnalysis.certifications        = jobAnalysis.certifications        || [];
      jobAnalysis.atsFilterKeywords     = jobAnalysis.atsFilterKeywords     || [];
      if (!jobAnalysis.competitionLevel || !['low', 'medium', 'high', 'very-high'].includes(jobAnalysis.competitionLevel)) {
        jobAnalysis.competitionLevel = 'medium';
      }
    } catch (parseError) {
      console.error('[analyze-job] JSON parse failed:', parseError);
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid response format for job analysis. Please try again.' },
        { status: 500 }
      );
    }

    // --- Cache result (non-blocking) ---
    parsingCache.set(cacheKey, { jobAnalysis, usedModel });

    if (sessionId) {
      db.cVSession.upsert({
        where: { id: sessionId },
        update: { jobDescText, analyzedJob: JSON.stringify(jobAnalysis), step: 3, updatedAt: new Date() },
        create: { jobDescText, analyzedJob: JSON.stringify(jobAnalysis), step: 3 },
      }).catch((dbErr: unknown) => {
        console.warn('[analyze-job] DB save failed (non-critical):', dbErr instanceof Error ? dbErr.message : String(dbErr));
      });
    }

    return NextResponse.json({ success: true, data: jobAnalysis, model: usedModel, cached: false });
  } catch (error: unknown) {
    if (error instanceof AIModelFailedError) {
      console.error('[analyze-job] All models failed. Diagnostics:', JSON.stringify(error.diagnostics));
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          providerStatus: getProviderCredentialStatus(),
          diagnostics: error.diagnostics,
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes('timed out')) {
      return NextResponse.json(
        { success: false, error: 'Server is busy processing requests. Please try again in a few seconds.' },
        { status: 503 }
      );
    }

    console.error('[analyze-job] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
