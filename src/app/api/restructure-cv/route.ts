import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIWithFallback,
  getNextRotatingModel,
  estimateComplexity,
  DEFAULT_TEXT_MODEL,
} from '@/lib/ai-provider';
import {
  CV_RESTRUCTURE_SYSTEM_PROMPT,
  type ParsedCV,
} from '@/lib/cv-types';
import { sanitizeParsedCV } from '@/lib/text-cleaning';
import { resolveClientIp } from '@/lib/rate-limit';
import { getVisitorIdFromRequest } from '@/lib/visitor';
import { getRequestGeo } from '@/lib/geo';
import { logGenerationEvent } from '@/lib/generation-log';
import { cleanPlainText, parseOptionalSessionId } from '@/lib/request-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Robust JSON extraction from LLM responses
// ---------------------------------------------------------------------------

function extractJSON(text: string): string | null {
  // Strategy 1: Look for ```json ... ``` code blocks
  const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = codeBlockRe.exec(text);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (candidate.startsWith('{')) return candidate;
  }

  // Strategy 2: Find the first { ... } balanced pair
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

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
  const requestStart = Date.now();
  const ip = resolveClientIp(request);
  const visitorId = getVisitorIdFromRequest(request);
  const geo = getRequestGeo(request);
  try {
    const body = await request.json();
    const { parsedCv, jobAnalysis, modelId } = body;
    const sessionId = parseOptionalSessionId(body.sessionId);
    const jobDescText = typeof body.jobDescText === 'string'
      ? cleanPlainText(body.jobDescText)
      : body.jobDescText;

    if (!parsedCv || !parsedCv.personalInfo) {
      return NextResponse.json(
        { success: false, error: 'parsedCv with personalInfo is required' },
        { status: 400 }
      );
    }

    if (!jobAnalysis || !jobAnalysis.jobTitle) {
      return NextResponse.json(
        { success: false, error: 'jobAnalysis with jobTitle is required' },
        { status: 400 }
      );
    }

    if (!jobDescText || typeof jobDescText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'jobDescText is required and must be a string' },
        { status: 400 }
      );
    }

    const cvLength = JSON.stringify(parsedCv).length;
    const jobLength = jobDescText.length;
    const totalBullets = (parsedCv.workExperience || []).reduce(
      (sum, exp) => sum + (exp.bullets?.length || 0),
      0
    );
    const projectCount = (parsedCv.projects || []).length;
    const complexity = estimateComplexity(cvLength, jobLength, totalBullets, projectCount);

    const requestedModel = modelId || getNextRotatingModel(DEFAULT_TEXT_MODEL);

    const messages = [
      { role: 'system' as const, content: CV_RESTRUCTURE_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `## CURRENT CV:\n${JSON.stringify(parsedCv, null, 2)}\n\n## JOB DESCRIPTION:\n${jobDescText}\n\n## JOB ANALYSIS:\n${JSON.stringify(jobAnalysis, null, 2)}\n\nPlease restructure the CV above to best match this job description. Return the restructured CV as JSON.`,
      },
    ];

    // Call AI with cascading fallback
    const { content: responseText, model: usedModel } = await callAIWithFallback(
      messages,
      requestedModel,
      complexity
    );

    // Parse the JSON response using robust extractor
    let restructuredCv: ParsedCV;
    try {
      const rawJson = extractJSON(responseText);
      if (!rawJson) throw new Error('No JSON object found in response');

      const fixed = fixCommonJSONIssues(rawJson);
      restructuredCv = JSON.parse(fixed) as ParsedCV;
      restructuredCv.personalInfo = sanitizeParsedCV(parsedCv).personalInfo;
      restructuredCv.projects = restructuredCv.projects || [];
      restructuredCv.workExperience = restructuredCv.workExperience || [];
      restructuredCv.education = restructuredCv.education || [];
      restructuredCv.skills = restructuredCv.skills || [];
      restructuredCv = sanitizeParsedCV(restructuredCv);
    } catch (parseError) {
      console.error('Failed to parse LLM JSON response for restructuring:', parseError);
      console.error('Raw response:', responseText);
      void logGenerationEvent({
        type: 'restructure-cv',
        success: false,
        model: usedModel,
        errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
        durationMs: Date.now() - requestStart,
        ip,
        visitorId,
        country: geo.country,
        region: geo.region,
        city: geo.city,
      });
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid response format for CV restructuring. Please try again.' },
        { status: 500 }
      );
    }

    // Anonymous sessions may only be updated by the visitor that created them.
    if (sessionId) {
      try {
        await db.cVSession.updateMany({
          where: { id: sessionId, visitorId },
          data: {
            tailoredCv: JSON.stringify(restructuredCv),
            modelUsed: usedModel,
            step: 4,
            updatedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.warn('Could not save session:', dbError);
      }
    }

    void logGenerationEvent({
      type: 'restructure-cv',
      success: true,
      model: usedModel,
      durationMs: Date.now() - requestStart,
      ip,
      visitorId,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
    return NextResponse.json({
      success: true,
      data: restructuredCv,
      model: usedModel,
      complexity,
    });
  } catch (error: unknown) {
    console.error('Restructure CV error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    void logGenerationEvent({
      type: 'restructure-cv',
      success: false,
      errorMessage: message,
      durationMs: Date.now() - requestStart,
      ip,
      visitorId,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
