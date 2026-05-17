import { NextRequest, NextResponse } from 'next/server';
import { callAIRaceForTask, type AIMessage } from '@/lib/ai-provider';
import { aiQueue } from '@/lib/request-queue';
import { extractJSON } from '@/lib/json-utils';
import {
  COVER_LETTER_SYSTEM_PROMPT,
  COVER_LETTER_FORMATS,
  type ParsedCV,
  type JobAnalysis,
  type CoverLetterData,
  type CoverLetterFormatId,
} from '@/lib/cv-types';
import { sanitizeCoverLetterData } from '@/lib/text-cleaning';

export const runtime = 'nodejs';
export const maxDuration = 45;

interface GenerateCoverLetterRequest {
  cvData: ParsedCV;
  jobAnalysis: JobAnalysis;
  jobDescText: string;
  formatId: CoverLetterFormatId;
  modelId?: string;
}

function isValidCoverLetterData(obj: unknown): obj is CoverLetterData {
  if (!obj || typeof obj !== 'object') return false;
  const d = obj as Record<string, unknown>;
  return (
    typeof d.recipientName === 'string' &&
    typeof d.recipientTitle === 'string' &&
    typeof d.companyAddress === 'string' &&
    typeof d.date === 'string' &&
    typeof d.greeting === 'string' &&
    typeof d.openingParagraph === 'string' &&
    Array.isArray(d.bodyParagraphs) &&
    d.bodyParagraphs.every((p: unknown) => typeof p === 'string') &&
    typeof d.closingParagraph === 'string' &&
    typeof d.signOff === 'string' &&
    typeof d.applicantName === 'string' &&
    typeof d.applicantContact === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateCoverLetterRequest = await request.json();
    const { cvData, jobAnalysis, jobDescText, formatId } = body;

    if (!cvData || typeof cvData !== 'object') {
      return NextResponse.json(
        { success: false, error: 'cvData is required and must be an object' },
        { status: 400 }
      );
    }

    if (!jobAnalysis || typeof jobAnalysis !== 'object') {
      return NextResponse.json(
        { success: false, error: 'jobAnalysis is required and must be an object' },
        { status: 400 }
      );
    }

    if (!jobDescText || typeof jobDescText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'jobDescText is required and must be a string' },
        { status: 400 }
      );
    }

    if (!formatId || typeof formatId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'formatId is required and must be a string' },
        { status: 400 }
      );
    }

    const format = COVER_LETTER_FORMATS.find((f) => f.id === formatId);
    if (!format) {
      return NextResponse.json(
        { success: false, error: `Invalid formatId: ${formatId}. Must be one of: ${COVER_LETTER_FORMATS.map((f) => f.id).join(', ')}` },
        { status: 400 }
      );
    }

    const messages: AIMessage[] = [
      { role: 'system', content: COVER_LETTER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ cvData, jobAnalysis, jobDescText, toneInstruction: format.tone }),
      },
    ];

    const { content: rawContent, model: usedModel } = await aiQueue.enqueue(
      () => callAIRaceForTask('cover_letter', messages, 3, 0.5),
      'normal',
    );

    const rawJson = extractJSON(rawContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson ?? rawContent.trim());
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : 'JSON parse error';
      console.error('[generate-cover-letter] Failed to parse AI response as JSON:', message);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response as JSON. Please try again.' },
        { status: 500 }
      );
    }

    if (!isValidCoverLetterData(parsed)) {
      console.error('[generate-cover-letter] AI response missing required fields:', JSON.stringify(parsed).substring(0, 300));
      return NextResponse.json(
        { success: false, error: 'AI response does not contain all required cover letter fields' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sanitizeCoverLetterData(parsed as CoverLetterData),
      model: usedModel,
    });
  } catch (error: unknown) {
    console.error('[generate-cover-letter] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
