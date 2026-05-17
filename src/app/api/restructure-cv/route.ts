import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIRaceForTask,
  estimateComplexity,
  pickBestModelForTask,
} from '@/lib/ai-provider';
import {
  CV_RESTRUCTURE_SYSTEM_PROMPT,
  type ParsedCV,
} from '@/lib/cv-types';
import { extractJSON, fixCommonJSONIssues } from '@/lib/json-utils';
import { aiQueue } from '@/lib/request-queue';
import { sanitizeParsedCV } from '@/lib/text-cleaning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request JSON.' }, { status: 400 });
  }

  const { parsedCv, jobAnalysis, jobDescText, sessionId, modelId } = body as {
    parsedCv: ParsedCV;
    jobAnalysis: Record<string, unknown>;
    jobDescText: string;
    sessionId?: string;
    modelId?: string;
  };

  if (!parsedCv?.personalInfo) {
    return NextResponse.json({ success: false, error: 'parsedCv with personalInfo is required' }, { status: 400 });
  }
  if (!jobAnalysis?.jobTitle) {
    return NextResponse.json({ success: false, error: 'jobAnalysis with jobTitle is required' }, { status: 400 });
  }
  if (!jobDescText || typeof jobDescText !== 'string') {
    return NextResponse.json({ success: false, error: 'jobDescText is required and must be a string' }, { status: 400 });
  }

  // Complexity detection
  const cvLength     = JSON.stringify(parsedCv).length;
  const jobLength    = jobDescText.length;
  const totalBullets = (parsedCv.workExperience || []).reduce((s, e) => s + (e.bullets?.length || 0), 0);
  const projectCount = (parsedCv.projects || []).length;
  const complexity   = estimateComplexity(cvLength, jobLength, totalBullets, projectCount);

  // Model selection: respect UI hint → otherwise use task-optimised quality model
  const hintModel = typeof modelId === 'string' && modelId ? modelId : undefined;
  const primaryModel = hintModel ?? pickBestModelForTask('restructure');

  const messages = [
    { role: 'system' as const, content: CV_RESTRUCTURE_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content:
        `## CURRENT CV:\n${JSON.stringify(parsedCv, null, 2)}\n\n` +
        `## JOB DESCRIPTION:\n${jobDescText}\n\n` +
        `## JOB ANALYSIS:\n${JSON.stringify(jobAnalysis, null, 2)}\n\n` +
        `Please restructure the CV above to best match this job description. Return the restructured CV as JSON.`,
    },
  ];

  // Race 2 models for all complexity levels (was inverted: complex→1, simple→2)
  // For complex tasks quality matters more, so we race 2 quality models simultaneously.
  const raceCount = 2;

  const { content: responseText, model: usedModel } = await aiQueue.add(
    () => callAIRaceForTask('restructure', messages, raceCount, 0.3, primaryModel),
    'normal',
  );

  console.warn(`[restructure-cv] AI responded in ${Date.now() - t0}ms (model: ${usedModel}, complexity: ${complexity})`);

  // Parse the JSON response
  let restructuredCv: ParsedCV;
  try {
    const rawJson = extractJSON(responseText);
    if (!rawJson) throw new Error('No JSON object found in response');
    const fixed = fixCommonJSONIssues(rawJson);
    restructuredCv = JSON.parse(fixed) as ParsedCV;
    // Always preserve personal info from the original CV
    restructuredCv.personalInfo   = sanitizeParsedCV(parsedCv).personalInfo;
    restructuredCv.projects        = restructuredCv.projects       || [];
    restructuredCv.workExperience  = restructuredCv.workExperience || [];
    restructuredCv.education       = restructuredCv.education      || [];
    restructuredCv.skills          = restructuredCv.skills         || [];
    restructuredCv = sanitizeParsedCV(restructuredCv);
  } catch (parseError) {
    console.error('[restructure-cv] JSON parse failed:', parseError);
    return NextResponse.json(
      { success: false, error: 'AI returned an invalid response format. Please try again.' },
      { status: 500 }
    );
  }

  // Non-blocking DB write (don't await – let response fly immediately)
  if (sessionId) {
    db.cVSession.upsert({
      where: { id: sessionId },
      update: { tailoredCv: JSON.stringify(restructuredCv), modelUsed: usedModel, step: 4, updatedAt: new Date() },
      create: { tailoredCv: JSON.stringify(restructuredCv), modelUsed: usedModel, step: 4 },
    }).catch((dbErr: unknown) => {
      console.warn('[restructure-cv] DB save failed (non-critical):', dbErr instanceof Error ? dbErr.message : String(dbErr));
    });
  }

  return NextResponse.json({
    success: true,
    data: restructuredCv,
    model: usedModel,
    complexity,
    processingTime: Date.now() - t0,
  });
}
