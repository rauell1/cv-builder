import { NextRequest, NextResponse } from 'next/server';
import { callAIRaceForTask, hasAnyProviderCredentials } from '@/lib/ai-provider';
import { aiQueue } from '@/lib/request-queue';
import { insightsCache, hashContent } from '@/lib/response-cache';
import {
  SECTION_INSIGHT_SYSTEM_PROMPT,
  type ParsedCV,
  type JobAnalysis,
  type SectionInsight,
} from '@/lib/cv-types';

export const runtime = 'nodejs';
export const maxDuration = 45;

const ALL_SECTIONS = [
  { id: 'personal', name: 'Personal Information' },
  { id: 'statement', name: 'Personal Statement' },
  { id: 'experience', name: 'Work Experience' },
  { id: 'education', name: 'Education' },
  { id: 'projects', name: 'Projects' },
  { id: 'skills', name: 'Skills' },
] as const;

type SectionId = (typeof ALL_SECTIONS)[number]['id'];

function getSectionContent(cvData: ParsedCV, sectionId: SectionId): string {
  switch (sectionId) {
    case 'personal':   return JSON.stringify(cvData.personalInfo, null, 2);
    case 'statement':  return cvData.personalStatement || '(empty)';
    case 'experience': return JSON.stringify(cvData.workExperience, null, 2);
    case 'education':  return JSON.stringify(cvData.education, null, 2);
    case 'projects':   return JSON.stringify(cvData.projects, null, 2);
    case 'skills':     return JSON.stringify(cvData.skills, null, 2);
    default:           return '';
  }
}

function buildSectionPrompt(
  sectionId: SectionId,
  sectionName: string,
  sectionContent: string,
  jobAnalysis: JobAnalysis,
  jobDescText: string
): string {
  return `
Please analyze the "${sectionName}" section of this CV against the target job.

=== CV SECTION: ${sectionName.toUpperCase()} ===
${sectionContent}

=== TARGET JOB ===
Job Title: ${jobAnalysis.jobTitle}
Company: ${jobAnalysis.company}
Key Requirements: ${jobAnalysis.keyRequirements.slice(0, 8).join('; ')}
Keywords: ${jobAnalysis.keywords.slice(0, 15).join(', ')}

=== FULL JOB DESCRIPTION ===
${jobDescText}

Analyze this "${sectionName}" section and provide insights as a JSON object. Set "sectionId" to "${sectionId}" and "sectionName" to "${sectionName}".`.trim();
}

function isValidSectionInsight(obj: unknown): obj is SectionInsight {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.sectionId === 'string' &&
    typeof r.sectionName === 'string' &&
    typeof r.score === 'number' &&
    Array.isArray(r.strengths) &&
    Array.isArray(r.weaknesses) &&
    Array.isArray(r.suggestions) &&
    ['high', 'medium', 'low'].includes(r.priority as string) &&
    typeof r.improved === 'boolean'
  );
}

async function generateSingleSectionInsight(
  sectionId: SectionId,
  sectionName: string,
  sectionContent: string,
  jobAnalysis: JobAnalysis,
  jobDescText: string
): Promise<SectionInsight | null> {
  const messages = [
    { role: 'system' as const, content: SECTION_INSIGHT_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildSectionPrompt(sectionId, sectionName, sectionContent, jobAnalysis, jobDescText) },
  ];

  try {
    const { content: responseText } = await aiQueue.enqueue(
      () => callAIRaceForTask('score', messages, 1, 0.4),
      'normal',
    );

    if (!responseText) return null;

    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!isValidSectionInsight(parsed)) return null;

    parsed.sectionId = sectionId;
    parsed.sectionName = sectionName;
    return parsed as SectionInsight;
  } catch {
    return null;
  }
}

/** Run tasks in capped concurrency — prevents one request from consuming all queue slots. */
async function runCapped<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try { results[i] = await tasks[i](); } catch { results[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvData, jobAnalysis, jobDescText, sectionId } = body;

    if (!cvData || typeof cvData !== 'object') {
      return NextResponse.json({ success: false, error: 'cvData is required' }, { status: 400 });
    }
    if (!jobAnalysis || typeof jobAnalysis !== 'object') {
      return NextResponse.json({ success: false, error: 'jobAnalysis is required' }, { status: 400 });
    }
    if (!jobDescText || typeof jobDescText !== 'string') {
      return NextResponse.json({ success: false, error: 'jobDescText is required' }, { status: 400 });
    }

    if (!hasAnyProviderCredentials()) {
      return NextResponse.json(
        { success: false, error: 'No AI provider is configured. Set at least one provider API key.' },
        { status: 503 }
      );
    }

    let sectionsToAnalyze: (typeof ALL_SECTIONS)[number][];
    if (sectionId && typeof sectionId === 'string') {
      const matched = ALL_SECTIONS.find((s) => s.id === sectionId);
      if (!matched) {
        return NextResponse.json(
          { success: false, error: `Invalid sectionId "${sectionId}". Must be one of: ${ALL_SECTIONS.map((s) => s.id).join(', ')}` },
          { status: 400 }
        );
      }
      sectionsToAnalyze = [matched];
    } else {
      sectionsToAnalyze = [...ALL_SECTIONS];
    }

    // Cache check
    const cacheKey = `insights:${hashContent(JSON.stringify(cvData) + jobDescText + (sectionId || 'all'))}`;
    const cached = insightsCache.get(cacheKey) as SectionInsight[] | null;
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    // Cap at 2 concurrent section calls per request so we don't consume all queue slots
    const tasks = sectionsToAnalyze.map((section) => () =>
      generateSingleSectionInsight(
        section.id, section.name,
        getSectionContent(cvData, section.id),
        jobAnalysis, jobDescText,
      )
    );
    const rawResults = await runCapped(tasks, 2);

    const insights: SectionInsight[] = rawResults.filter((r): r is SectionInsight => r !== null);

    if (insights.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate insights for any section. Please try again.' },
        { status: 500 }
      );
    }

    insightsCache.set(cacheKey, insights);

    return NextResponse.json({ success: true, data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
