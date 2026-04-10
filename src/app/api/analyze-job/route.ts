import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIWithFallback,
  getNextRotatingModel,
  getProviderCredentialDetails,
  getProviderCredentialStatus,
  hasAnyProviderCredentials,
} from '@/lib/ai-provider';
import { JOB_ANALYSIS_SYSTEM_PROMPT, type JobAnalysis } from '@/lib/cv-types';
import { aiQueue } from '@/lib/request-queue';
import { parsingCache, hashContent } from '@/lib/response-cache';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Robust JSON extraction from LLM responses
// ---------------------------------------------------------------------------

function extractJSON(text: string): string | null {
  const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = codeBlockRe.exec(text);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (candidate.startsWith('{')) return candidate;
  }
  let depth = 0, start = -1, inString = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return text.substring(start, i + 1); }
  }
  return null;
}

function fixCommonJSONIssues(json: string): string {
  return json
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/(?<=:\s*|[\[,]\s*)'([^']*)'(?=\s*[,}\]:])/g, '"$1"')
    .replace(/(?<=:\s*")([\s\S]*?)(?="\s*[,}])/g, (match) =>
      match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    );
}

export async function POST(request: NextRequest) {
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

    // --- Check cache first ---
    const cacheKey = `job:${hashContent(jobDescText.trim())}`;
    const cached = parsingCache.get(cacheKey) as { jobAnalysis: JobAnalysis; usedModel: string } | null;
    if (cached) {
      console.warn('[analyze-job] Cache hit for job desc hash:', cacheKey.substring(0, 12));
      if (sessionId) {
        try {
          await db.cVSession.update({
            where: { id: sessionId },
            data: {
              jobDescText,
              analyzedJob: JSON.stringify(cached.jobAnalysis),
              step: 3,
              updatedAt: new Date(),
            },
          });
        } catch {
          // DB save failure should not block cached response
        }
      }
      return NextResponse.json({
        success: true,
        data: cached.jobAnalysis,
        model: cached.usedModel,
        cached: true,
      });
    }

    // --- Enqueue in AI queue (limits concurrency for 1000+ users) ---
    if (!hasAnyProviderCredentials()) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI provider is configured. Set one of: ZHIPU_API_KEY (or GLM_API_KEY/BIGMODEL_API_KEY), OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY (or GOOGLE_API_KEY/GEMINI_API_KEY).',
          providerStatus: getProviderCredentialStatus(),
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    const { content: responseText, model: usedModel } = await aiQueue.enqueue(
      () => callAIWithFallback(
        [
          { role: 'system', content: JOB_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: jobDescText },
        ],
        getNextRotatingModel('glm-4-flash'),
        'simple'
      ),
      'normal',
      30_000
    );

    // Parse the JSON response from LLM using robust extractor
    let jobAnalysis: JobAnalysis;
    try {
      const rawJson = extractJSON(responseText);
      if (!rawJson) throw new Error('No JSON object found in response');

      const fixed = fixCommonJSONIssues(rawJson);
      jobAnalysis = JSON.parse(fixed) as JobAnalysis;

      if (!jobAnalysis.jobTitle && !jobAnalysis.summary) {
        throw new Error('Missing required fields: jobTitle or summary');
      }
      // Ensure all fields have proper defaults for new extended JobAnalysis interface
      jobAnalysis.keyRequirements = jobAnalysis.keyRequirements || [];
      jobAnalysis.preferredSkills = jobAnalysis.preferredSkills || [];
      jobAnalysis.keywords = jobAnalysis.keywords || [];
      jobAnalysis.requiredQualifications = jobAnalysis.requiredQualifications || [];
      jobAnalysis.preferredQualifications = jobAnalysis.preferredQualifications || [];
      jobAnalysis.certifications = jobAnalysis.certifications || [];
      jobAnalysis.atsFilterKeywords = jobAnalysis.atsFilterKeywords || [];
      if (!jobAnalysis.competitionLevel || !['low', 'medium', 'high', 'very-high'].includes(jobAnalysis.competitionLevel)) {
        jobAnalysis.competitionLevel = 'medium';
      }
    } catch (parseError) {
      console.error('Failed to parse LLM JSON response for job analysis:', parseError);
      console.error('Raw response:', responseText);
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid response format for job analysis. Please try again.' },
        { status: 500 }
      );
    }

    // --- Cache the result ---
    parsingCache.set(cacheKey, { jobAnalysis, usedModel });

    // Update session if sessionId provided (use upsert to avoid RecordNotFound)
    if (sessionId) {
      try {
        await db.cVSession.upsert({
          where: { id: sessionId },
          update: {
            jobDescText,
            analyzedJob: JSON.stringify(jobAnalysis),
            step: 3,
            updatedAt: new Date(),
          },
          create: {
            jobDescText,
            analyzedJob: JSON.stringify(jobAnalysis),
            step: 3,
          },
        });
      } catch (dbError) {
        console.warn('Could not save session:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      data: jobAnalysis,
      model: usedModel,
      cached: false,
    });
  } catch (error: unknown) {
    console.error('Analyze job error:', error);

    if (error instanceof Error && error.message.includes('AI model failed')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          providerStatus: getProviderCredentialStatus(),
          diagnostics: (error as any)?.diagnostics,
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    // Handle queue timeout
    if (error instanceof Error && error.message.includes('timed out')) {
      return NextResponse.json(
        { success: false, error: 'Server is busy processing requests. Please try again in a few seconds.' },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
