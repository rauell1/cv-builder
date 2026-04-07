import { NextRequest, NextResponse } from 'next/server';
import {
  callAIWithFallback,
  getNextRotatingModel,
  getProvider,
  getRequiredEnvKey,
  type AIMessage,
} from '@/lib/ai-provider';
import {
  COVER_LETTER_SYSTEM_PROMPT,
  COVER_LETTER_FORMATS,
  type ParsedCV,
  type JobAnalysis,
  type CoverLetterData,
  type CoverLetterFormatId,
} from '@/lib/cv-types';
import { sanitizeCoverLetterData } from '@/lib/text-cleaning';

interface GenerateCoverLetterRequest {
  cvData: ParsedCV;
  jobAnalysis: JobAnalysis;
  jobDescText: string;
  formatId: CoverLetterFormatId;
  modelId?: string;
}

// ===== JSON Parsing Helpers =====

function parseAIResponseJSON(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.substring(firstNewline + 1);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();
  }

  return JSON.parse(cleaned);
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

// ===== POST Handler =====

export async function POST(request: NextRequest) {
  try {
    const body: GenerateCoverLetterRequest = await request.json();
    const { cvData, jobAnalysis, jobDescText, formatId, modelId } = body;
    const requestedModel = modelId || getNextRotatingModel('glm-4-plus');

    // Validate required fields
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

    // Look up tone for the selected format
    const format = COVER_LETTER_FORMATS.find((f) => f.id === formatId);
    if (!format) {
      return NextResponse.json(
        { success: false, error: `Invalid formatId: ${formatId}. Must be one of: ${COVER_LETTER_FORMATS.map((f) => f.id).join(', ')}` },
        { status: 400 }
      );
    }

    const toneInstruction = format.tone;

    // Check API key availability for non-GLM providers
    const provider = getProvider(requestedModel);
    const requiredKey = getRequiredEnvKey(provider);
    if (requiredKey && !process.env[requiredKey]) {
      return NextResponse.json(
        {
          success: false,
          error: `The API key for the selected model is not configured. Please set the ${requiredKey} environment variable.`,
          missingKey: requiredKey,
        },
        { status: 400 }
      );
    }

    // Build messages
    const userMessage = JSON.stringify({
      cvData,
      jobAnalysis,
      jobDescText,
      toneInstruction,
    });

    const messages: AIMessage[] = [
      { role: 'system', content: COVER_LETTER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    // Call AI with fallback chain
    let rawContent: string;
    let usedModel: string;
    try {
      const result = await callAIWithFallback(messages, requestedModel, 'standard');
      rawContent = result.content;
      usedModel = result.model;
    } catch (providerError: unknown) {
      const message = providerError instanceof Error ? providerError.message : 'An error occurred with the AI provider';
      console.error(`[generate-cover-letter] provider error for model ${requestedModel}:`, message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }

    // Parse the AI response as JSON
    let parsed: unknown;
    try {
      parsed = parseAIResponseJSON(rawContent);
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : 'JSON parse error';
      console.error('[generate-cover-letter] Failed to parse AI response as JSON:', message);
      console.error('[generate-cover-letter] Raw response (first 500 chars):', rawContent.substring(0, 500));
      return NextResponse.json(
        { success: false, error: `Failed to parse AI response as JSON: ${message}` },
        { status: 500 }
      );
    }

    // Validate the parsed response structure
    if (!isValidCoverLetterData(parsed)) {
      console.error('[generate-cover-letter] AI response missing required CoverLetterData fields:', JSON.stringify(parsed).substring(0, 300));
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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
