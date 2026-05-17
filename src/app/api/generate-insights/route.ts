import { NextRequest, NextResponse } from 'next/server';
import { callAIRaceForTask } from '@/lib/ai-provider';
import { aiQueue } from '@/lib/request-queue';
import {
  SECTION_INSIGHT_SYSTEM_PROMPT,
  type ParsedCV,
  type JobAnalysis,
  type SectionInsight,
} from '@/lib/cv-types';

export const runtime = 'nodejs';
export const maxDuration = 45;

// All supported section IDs with their display names
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
  const relevantContext = `
=== TARGET JOB INFORMATION ===
Job Title: ${jobAnalysis.jobTitle}
Company: ${jobAnalysis.company}
Industry: ${jobAnalysis.industry}
Experience Level: ${jobAnalysis.experienceLevel}
Job Summary: ${jobAnalysis.summary}

Key Requirements:
${jobAnalysis.keyRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Preferred Skills:
${jobAnalysis.preferredSkills.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Important Keywords:
${jobAnalysis.keywords.join(', ')}
`.trim();

  return `
Please analyze the "${sectionName}" section of this CV against the target job.

=== CV SECTION: ${sectionName.toUpperCase()} ===
${sectionContent}

${relevantContext}

=== FULL JOB DESCRIPTION (for context) ===
${jobDescText}

Analyze this "${sectionName}" section and provide your insights as a JSON object. Set "sectionId" to "${sectionId}" and "sectionName" to "${sectionName}".`.trim();
}

function isValidSectionInsight(obj: unknown): obj is SectionInsight {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return (
    typeof record.sectionId === 'string' &&
    typeof record.sectionName === 'string' &&
    typeof record.score === 'number' &&
    Array.isArray(record.strengths) &&
    Array.isArray(record.weaknesses) &&
    Array.isArray(record.suggestions) &&
    ['high', 'medium', 'low'].includes(record.priority as string) &&
    typeof record.improved === 'boolean'
  );
}

async function generateSingleSectionInsight(
  sectionId: SectionId,
  sectionName: string,
  sectionContent: string,
  jobAnalysis: JobAnalysis,
  jobDescText: string
): Promise<SectionInsight | null> {
  const userPrompt = buildSectionPrompt(sectionId, sectionName, sectionContent, jobAnalysis, jobDescText);
  const messages = [
    { role: 'system' as const, content: SECTION_INSIGHT_SYSTEM_PROMPT },
    { role: 'user'   as const, content: userPrompt },
  ];

  try {
    const { content: responseText } = await aiQueue.enqueue(
      () => callAIRaceForTask('score', messages, 2, 0.4),
      'normal',
    );

    if (!responseText) {
      console.warn(`Empty response for section: ${sectionId}`);
      return null;
    }

    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!isValidSectionInsight(parsed)) {
      console.warn(`Invalid insight structure for section: ${sectionId}`, parsed);
      return null;
    }

    parsed.sectionId = sectionId;
    parsed.sectionName = sectionName;
    return parsed as SectionInsight;
  } catch (error) {
    console.error(`Failed to generate insight for section "${sectionId}":`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvData, jobAnalysis, jobDescText, sectionId } = body;

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

    let sectionsToAnalyze: (typeof ALL_SECTIONS)[number][];

    if (sectionId && typeof sectionId === 'string') {
      const matchedSection = ALL_SECTIONS.find((s) => s.id === sectionId);
      if (!matchedSection) {
        return NextResponse.json(
          { success: false, error: `Invalid sectionId "${sectionId}". Must be one of: ${ALL_SECTIONS.map((s) => s.id).join(', ')}` },
          { status: 400 }
        );
      }
      sectionsToAnalyze = [matchedSection];
    } else {
      sectionsToAnalyze = [...ALL_SECTIONS];
    }

    const insightPromises = sectionsToAnalyze.map((section) =>
      generateSingleSectionInsight(
        section.id,
        section.name,
        getSectionContent(cvData, section.id),
        jobAnalysis,
        jobDescText
      )
    );

    const results = await Promise.allSettled(insightPromises);

    const insights: SectionInsight[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        insights.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn(`Section "${sectionsToAnalyze[i].id}" insight rejected:`, result.reason);
      }
    }

    if (insights.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate insights for any section. Please try again.' },
        { status: 500 }
      );
    }

    if (insights.length < sectionsToAnalyze.length) {
      const failedSections = sectionsToAnalyze
        .filter((_, idx) => {
          const result = results[idx];
          return !result || result.status === 'rejected' || (result.status === 'fulfilled' && !result.value);
        })
        .map((s) => s.id);
      console.warn(`Partial success: ${insights.length}/${sectionsToAnalyze.length} insights. Missing: ${failedSections.join(', ')}`);
    }

    return NextResponse.json({ success: true, data: insights });
  } catch (error: unknown) {
    console.error('Generate insights error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
