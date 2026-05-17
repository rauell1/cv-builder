import { NextRequest, NextResponse } from 'next/server';
import { callAIRaceForTask, hasAnyProviderCredentials } from '@/lib/ai-provider';
import { aiQueue } from '@/lib/request-queue';
import { extractJSON, fixCommonJSONIssues } from '@/lib/json-utils';
import { insightsCache, hashContent } from '@/lib/response-cache';
import type { CVScore, ParsedCV, JobAnalysis } from '@/lib/cv-types';
import { CV_SCORE_SYSTEM_PROMPT } from '@/lib/cv-types';

export const runtime = 'nodejs';
export const maxDuration = 30;

function buildScorePrompt(cvData: ParsedCV, jobAnalysis: JobAnalysis, jobDescText: string): string {
  return `=== CV DATA ===
${JSON.stringify(cvData, null, 2)}

=== JOB ANALYSIS ===
${JSON.stringify(jobAnalysis, null, 2)}

=== FULL JOB DESCRIPTION ===
${jobDescText}

Evaluate this CV against the job description using the scoring criteria. Be thorough and objective.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvData, jobAnalysis, jobDescText } = body;

    if (!cvData || typeof cvData !== 'object') {
      return NextResponse.json(
        { success: false, error: 'cvData is required and must be a valid ParsedCV object' },
        { status: 400 }
      );
    }

    if (!jobAnalysis || typeof jobAnalysis !== 'object') {
      return NextResponse.json(
        { success: false, error: 'jobAnalysis is required and must be a valid JobAnalysis object' },
        { status: 400 }
      );
    }

    if (!jobDescText || typeof jobDescText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'jobDescText is required and must be a string' },
        { status: 400 }
      );
    }

    if (!hasAnyProviderCredentials()) {
      return NextResponse.json(
        { success: false, error: 'No AI provider is configured. Set at least one provider API key.' },
        { status: 503 }
      );
    }

    const cacheKey = `score:${hashContent(JSON.stringify(cvData) + jobDescText)}`;
    const cached = insightsCache.get(cacheKey) as CVScore | null;
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    const messages = [
      { role: 'system' as const, content: CV_SCORE_SYSTEM_PROMPT },
      { role: 'user'   as const, content: buildScorePrompt(cvData, jobAnalysis, jobDescText) },
    ];

    const { content: responseText, model: usedModel } = await aiQueue.enqueue(
      () => callAIRaceForTask('score', messages, 2, 0.3),
      'normal',
    );

    let cvScore: CVScore;
    try {
      const rawJson = extractJSON(responseText);
      if (!rawJson) throw new Error('No JSON found in response');
      const parsed = JSON.parse(fixCommonJSONIssues(rawJson)) as CVScore;

      if (typeof parsed.overallScore !== 'number' || typeof parsed.atsScore !== 'number') {
        throw new Error('Missing overallScore or atsScore');
      }
      if (!parsed.keywordMatch || !Array.isArray(parsed.keywordMatch.matched) || !Array.isArray(parsed.keywordMatch.missing)) {
        throw new Error('Invalid keywordMatch structure');
      }
      if (!Array.isArray(parsed.sectionScores)) {
        throw new Error('Missing sectionScores array');
      }

      cvScore = {
        overallScore: Math.max(0, Math.min(100, parsed.overallScore)),
        atsScore: Math.max(0, Math.min(100, parsed.atsScore)),
        keywordMatch: parsed.keywordMatch,
        sectionScores: parsed.sectionScores.map((s) => ({
          section: s.section || 'Unknown',
          score: Math.max(0, Math.min(100, s.score || 0)),
          feedback: s.feedback || '',
        })),
        weakBullets: Array.isArray(parsed.weakBullets) ? parsed.weakBullets : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (parseError) {
      console.error('Failed to parse CV score response:', parseError);
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid format for CV scoring. Please try again.' },
        { status: 500 }
      );
    }

    insightsCache.set(cacheKey, cvScore);
    return NextResponse.json({ success: true, data: cvScore, model: usedModel });
  } catch (error: unknown) {
    console.error('Score CV error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
