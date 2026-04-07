import { NextRequest, NextResponse } from 'next/server';
import { callAIWithFallback } from '@/lib/ai-provider';
import type { CVScore, ParsedCV, JobAnalysis } from '@/lib/cv-types';

const CV_SCORE_SYSTEM_PROMPT = `You are an ATS (Applicant Tracking System) simulation engine and CV scoring expert. Evaluate this CV against the job description and provide a comprehensive scoring breakdown.

SCORING CRITERIA (weighted):
1. KEYWORD MATCH (25%): Are the top job keywords present in the CV? Check both explicit and implicit keyword usage.
2. EXPERIENCE RELEVANCE (25%): Does the candidate's experience align with the job's core requirements? Consider years, scope, and domain.
3. ACHIEVEMENT QUALITY (20%): Are bullet points quantified with measurable outcomes (%, numbers, scale, $)? Do they start with strong action verbs?
4. SKILLS COVERAGE (15%): Are required skills present in the CV? Are they prominent enough for ATS detection?
5. FORMAT & STRUCTURE (10%): Is the CV clean, professional, and ATS-friendly? Proper section ordering?
6. EDUCATION (5%): Does the candidate meet minimum educational requirements?

EVALUATION RULES:
- Be objective and data-driven — score based on evidence, not assumptions
- overallScore: Weighted composite of all criteria (0-100)
- atsScore: Simulated ATS pass probability (0-100) — how likely this CV passes automated screening
- keywordMatch: Split job keywords into matched (found in CV) and missing (not found)
- sectionScores: Score each major CV section individually with specific feedback
- weakBullets: Identify specific bullet points that are vague, passive, or unquantified (quote the actual bullet text)
- strengths: List 3-5 specific things the CV does well
- suggestions: List 3-5 actionable improvements ordered by impact

Return ONLY valid JSON matching this exact structure:
{
  "overallScore": 0-100,
  "atsScore": 0-100,
  "keywordMatch": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"]
  },
  "sectionScores": [
    { "section": "Personal Statement", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Work Experience", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Education", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Skills", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Projects", "score": 0-100, "feedback": "Specific feedback..." }
  ],
  "weakBullets": ["Exact text of weak bullet 1", "Exact text of weak bullet 2"],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

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

    const userPrompt = buildScorePrompt(cvData, jobAnalysis, jobDescText);

    const { content: responseText, model: usedModel } = await callAIWithFallback(
      [
        { role: 'system', content: CV_SCORE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      'glm-4-plus',
      'complex'
    );

    let cvScore: CVScore;
    try {
      const cleanResponse = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(cleanResponse) as CVScore;

      // Validate required fields
      if (typeof parsed.overallScore !== 'number' || typeof parsed.atsScore !== 'number') {
        throw new Error('Missing overallScore or atsScore');
      }

      if (!parsed.keywordMatch || !Array.isArray(parsed.keywordMatch.matched) || !Array.isArray(parsed.keywordMatch.missing)) {
        throw new Error('Invalid keywordMatch structure');
      }

      if (!Array.isArray(parsed.sectionScores)) {
        throw new Error('Missing sectionScores array');
      }

      // Clamp scores to 0-100
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
      console.error('Raw response:', responseText);
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid format for CV scoring. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cvScore,
      model: usedModel,
    });
  } catch (error: unknown) {
    console.error('Score CV error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
