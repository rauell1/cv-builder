import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callAIWithFallback, getNextRotatingModel } from '@/lib/ai-provider';
import { CV_PARSE_SYSTEM_PROMPT, type ParsedCV } from '@/lib/cv-types';
import { aiQueue } from '@/lib/request-queue';
import { parsingCache, hashContent } from '@/lib/response-cache';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { sanitizeParsedCV } from '@/lib/text-cleaning';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CV_LENGTH = 50_000; // 50 KB max raw CV text
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Robust JSON extraction from LLM responses
// ---------------------------------------------------------------------------

/**
 * Extract the first valid JSON object from an LLM response string.
 *
 * Handles:
 *   - ```json ... ``` code blocks (with or without language tag)
 *   - Raw JSON anywhere in the text
 *   - Text before/after the JSON (conversational prefixes like "Here is...")
 *   - Properly tracks string state to avoid matching braces inside strings
 */
function extractJSON(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // Strategy 1: Look for ```json ... ``` code blocks
  const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = codeBlockRe.exec(text);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (candidate.startsWith('{')) return candidate;
  }

  // Strategy 2: Find the first { ... } balanced pair using character-level scanning.
  // Properly handles strings, escapes, and nested objects/arrays.
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.substring(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Fix common JSON formatting issues that LLMs produce:
 *   - Trailing commas before } or ]
 *   - Single-quoted keys and values (safe for simple cases)
 */
function fixCommonJSONIssues(json: string): string {
  return json
    // Remove trailing commas before } or ]
    .replace(/,\s*([\]}])/g, '$1')
    // Fix single-quoted keys: 'key': → "key":
    .replace(/'([^']+)'\s*:/g, '"$1":')
    // Fix single-quoted string values after : or , or [
    .replace(/:\s*'([^']*?)'/g, ': "$1"')
    .replace(/[\[,]\s*'([^']*?)'/g, (match) => match.replace(/'/g, '"'));
}

/**
 * Fix unescaped newlines/CR/TAB inside JSON string values using
 * character-level scanning (safe — does NOT use destructive regex).
 *
 * This avoids the original implementation's bug where a lazy [\s\S]*? regex
 * could match across multiple string fields and corrupt the JSON.
 */
function fixUnescapedNewlinesInStrings(json: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    // Inside a string, escape literal control characters
    if (inString) {
      switch (ch) {
        case '\n': result += '\\n'; continue;
        case '\r': result += '\\r'; continue;
        case '\t': result += '\\t'; continue;
      }
    }

    result += ch;
  }

  return result;
}

/**
 * Parse a JSON string with aggressive multi-strategy fix-and-retry logic.
 * Returns the parsed object or throws a descriptive error.
 */
function safeJSONParse(raw: string): unknown {
  // Strategy 1: Direct parse (most common success path)
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  // Strategy 2: Fix trailing commas + single quotes
  try {
    return JSON.parse(fixCommonJSONIssues(raw));
  } catch {
    // fall through
  }

  // Strategy 3: Fix unescaped newlines in strings (character-level, safe)
  try {
    return JSON.parse(fixUnescapedNewlinesInStrings(raw));
  } catch {
    // fall through
  }

  // Strategy 4: Apply both fixes
  try {
    return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(raw)));
  } catch {
    // fall through
  }

  // Strategy 5: Remove control characters + both fixes
  try {
    const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(cleaned)));
  } catch {
    // fall through
  }

  throw new Error(
    `Failed to parse JSON after 5 strategies. ` +
    `Raw (first 300 chars): ${raw.substring(0, 300)}`
  );
}

/**
 * Validate that the parsed object has the minimum required ParsedCV structure.
 * Returns a normalized version with default values for missing optional fields.
 */
function validateAndNormalize(obj: unknown): ParsedCV {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Response is not a valid object');
  }

  const data = obj as Record<string, unknown>;

  // Validate personalInfo
  if (!data.personalInfo || typeof data.personalInfo !== 'object') {
    throw new Error('Missing personalInfo field');
  }
  const pi = data.personalInfo as Record<string, unknown>;

  // fullName is the only truly required personalInfo field
  if (!pi.fullName || typeof pi.fullName !== 'string' || !pi.fullName.trim()) {
    const possibleName =
      pi.name || pi.full_name || pi.firstName || pi.first_name || '';
    if (typeof possibleName === 'string' && possibleName.trim()) {
      pi.fullName = possibleName.trim();
    } else {
      throw new Error('Missing required personalInfo.fullName field');
    }
  }

  // Build normalized ParsedCV with defaults for missing fields
  const parsedCv: ParsedCV = {
    personalInfo: {
      fullName: String(pi.fullName || ''),
      location: String(pi.location || ''),
      email: String(pi.email || ''),
      phone: String(pi.phone || ''),
      linkedin: String(pi.linkedin || ''),
      github: String(pi.github || ''),
      website: String(pi.website || ''),
    },
    personalStatement:
      typeof data.personalStatement === 'string'
        ? data.personalStatement
        : typeof data.summary === 'string'
          ? data.summary
          : typeof data.objective === 'string'
            ? data.objective
            : typeof data.profile === 'string'
              ? data.profile
              : '',
    projects: Array.isArray(data.projects)
      ? data.projects.filter((p: unknown) => p && typeof p === 'object')
      : [],
    workExperience: Array.isArray(data.workExperience)
      ? data.workExperience.filter((w: unknown) => w && typeof w === 'object')
      : Array.isArray(data.experience)
        ? data.experience.filter((w: unknown) => w && typeof w === 'object')
        : Array.isArray(data.work_experience)
          ? data.work_experience.filter(
              (w: unknown) => w && typeof w === 'object'
            )
          : [],
    education: Array.isArray(data.education)
      ? data.education.filter((e: unknown) => e && typeof e === 'object')
      : [],
    skills: Array.isArray(data.skills)
      ? data.skills.filter((s: unknown) => s && typeof s === 'object')
      : [],
    certifications: Array.isArray(data.certifications)
      ? data.certifications.filter((c: unknown) => c && typeof c === 'object')
      : [],
  };

  return sanitizeParsedCV(parsedCv);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract, parse, and validate a ParsedCV from raw LLM text.
 * Returns the ParsedCV on success, or null if any step fails.
 */
function tryParseResponse(text: string): ParsedCV | null {
  try {
    if (!text || typeof text !== 'string') return null;

    const rawJson = extractJSON(text);
    if (!rawJson) return null;

    const obj = safeJSONParse(rawJson);
    return validateAndNormalize(obj);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core parsing function (extracted for queueing)
// ---------------------------------------------------------------------------

interface ParseResult {
  parsedCv: ParsedCV;
  usedModel: string;
}

async function parseCvCore(cvText: string): Promise<ParseResult> {
  const t0 = Date.now();
  const startModel = getNextRotatingModel('glm-4-flash');

  // --- Attempt 1: Primary call with fast fallback (glm-4-flash → glm-4-plus) ---
  const aiResult = await callAIWithFallback(
    [
      { role: 'system', content: CV_PARSE_SYSTEM_PROMPT },
      { role: 'user', content: cvText },
    ],
    startModel,
    'simple'
  );
  const { content: responseText, model: usedModel } = aiResult;
  console.warn(
    `[parse-cv] Primary LLM call completed in ${Date.now() - t0}ms (model: ${usedModel})`
  );

  // Try to parse the primary response
  let parsedCv = tryParseResponse(responseText);
  if (parsedCv) {
    console.warn(
      `[parse-cv] Parse succeeded on attempt 1 (${Date.now() - t0}ms)`
    );
    return { parsedCv, usedModel };
  }

  // --- Self-healing: retries across multiple providers ---
  const retryModels = [
    'gpt-4o-mini',
    'claude-haiku-4-20250414',
    'gemini-2.5-flash',
    'glm-4-plus',
    'glm-4-long',
  ] as const;

  for (let retry = 0; retry < retryModels.length && !parsedCv; retry++) {
    const retryModel = retryModels[retry] || 'glm-4-plus';
    console.warn(
      `[parse-cv] Retry ${retry + 1}/${MAX_RETRIES} with model ${retryModel}...`
    );

    try {
      const retryPrompt = `${CV_PARSE_SYSTEM_PROMPT}

CRITICAL: You MUST return ONLY a raw JSON object.
- No markdown code fences (no \`\`\`)
- No explanatory text before or after
- The response must start with { and end with }
- Ensure all string values with line breaks use \\n escape sequences

CV TEXT TO PARSE:
${cvText.substring(0, 10000)}`;

      const retryResult = await callAIWithFallback(
        [
          {
            role: 'system',
            content:
              'You are a CV parser. Return ONLY valid JSON matching the exact structure specified. ' +
              'Never leave required fields (fullName, email, phone) empty if they exist in the text. ' +
              'No markdown fences, no explanation. Just the JSON object.',
          },
          { role: 'user', content: retryPrompt },
        ],
        retryModel
      );

      const retryContent = retryResult.content;
      if (retryContent) {
        parsedCv = tryParseResponse(retryContent);
        if (parsedCv) {
          console.warn(
            `[parse-cv] Parse succeeded on retry ${retry + 1} with ${retryResult.model} (${Date.now() - t0}ms)`
          );
          return { parsedCv, usedModel: retryResult.model };
        }
        console.warn(
          `[parse-cv] Retry ${retry + 1}: model responded but JSON parse failed. ` +
            `Response preview (300 chars): ${retryContent.substring(0, 300)}`
        );
      } else {
        console.warn(
          `[parse-cv] Retry ${retry + 1}: model ${retryModel} returned null/empty`
        );
      }
    } catch (retryErr) {
      console.warn(
        `[parse-cv] Retry ${retry + 1} threw:`,
        retryErr instanceof Error ? retryErr.message : String(retryErr)
      );
    }
  }

  // All attempts exhausted
  console.error(
    `[parse-cv] All parse attempts failed after ${Date.now() - t0}ms. ` +
      `Last response (500 chars): ${(responseText || '').substring(0, 500)}`
  );
  throw new Error(
    'AI returned an invalid response format. Please try again, or paste your CV in a different format.'
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // --- Rate limiting ---
    const ip = resolveClientIp(request);
    const { allowed, retryAfter } = checkRateLimit(ip, 'ai');
    if (!allowed) {
      clearTimeout(timeoutTimer);
      return NextResponse.json(
        {
          success: false,
          error: `Too many requests. Please try again in ${retryAfter} seconds.`,
        },
        { status: 429 }
      );
    }

    // --- Parse request body ---
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      clearTimeout(timeoutTimer);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format. Please send valid JSON.',
        },
        { status: 400 }
      );
    }

    const rawCvText = body.cvText;
    const sessionId = body.sessionId as string | undefined;

    // --- Input validation ---
    if (!rawCvText || typeof rawCvText !== 'string') {
      clearTimeout(timeoutTimer);
      return NextResponse.json(
        {
          success: false,
          error: 'cvText is required and must be a string.',
        },
        { status: 400 }
      );
    }

    // Sanitize control characters (null bytes, etc.)
    const cvText = rawCvText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();

    if (cvText.length < 20) {
      clearTimeout(timeoutTimer);
      return NextResponse.json(
        {
          success: false,
          error:
            'CV text is too short. Please provide a more complete CV (at least 20 characters).',
        },
        { status: 400 }
      );
    }

    if (cvText.length > MAX_CV_LENGTH) {
      clearTimeout(timeoutTimer);
      return NextResponse.json(
        {
          success: false,
          error: `CV text is too long (${cvText.length.toLocaleString()} characters). Maximum is ${MAX_CV_LENGTH.toLocaleString()} characters.`,
        },
        { status: 400 }
      );
    }

    // --- Check cache first ---
    const cacheKey = hashContent(cvText.trim());
    const cached = parsingCache.get(cacheKey) as
      | { parsedCv: ParsedCV; usedModel: string }
      | null;

    if (cached) {
      console.warn(
        '[parse-cv] Cache hit for CV text hash:',
        cacheKey.substring(0, 12)
      );
      clearTimeout(timeoutTimer);

      // Still persist to DB if sessionId provided
      if (sessionId) {
        try {
          await db.cVSession.upsert({
            where: { id: sessionId },
            update: {
              parsedCv: JSON.stringify(cached.parsedCv),
              modelUsed: cached.usedModel,
              step: 2,
              updatedAt: new Date(),
            },
            create: {
              rawCvText: cvText,
              parsedCv: JSON.stringify(cached.parsedCv),
              modelUsed: cached.usedModel,
              step: 2,
            },
          });
        } catch {
          // DB save failure should not block cached response
        }
      }

      return NextResponse.json({
        success: true,
        data: cached.parsedCv,
        model: cached.usedModel,
        sessionId: sessionId || undefined,
        cached: true,
        parseTimeMs: Date.now() - requestStart,
      });
    }

    // --- Enqueue in AI queue (limits concurrency for 1000+ users) ---
    const { parsedCv, usedModel } = await aiQueue.enqueue(
      () => parseCvCore(cvText),
      'high',
      25_000 // 25s timeout covers primary (~1-3s) + up to 2 retries
    );

    // --- Cache the result ---
    parsingCache.set(cacheKey, { parsedCv, usedModel });

    // Save/update session in Prisma (non-blocking — DB failure should not block response)
    let sessionIdResponse: string | undefined;
    try {
      let session;
      if (sessionId) {
        session = await db.cVSession.upsert({
          where: { id: sessionId },
          update: {
            rawCvText: cvText,
            parsedCv: JSON.stringify(parsedCv),
            modelUsed: usedModel,
            step: 2,
            updatedAt: new Date(),
          },
          create: {
            rawCvText: cvText,
            parsedCv: JSON.stringify(parsedCv),
            modelUsed: usedModel,
            step: 2,
          },
        });
      } else {
        session = await db.cVSession.create({
          data: {
            rawCvText: cvText,
            parsedCv: JSON.stringify(parsedCv),
            modelUsed: usedModel,
            step: 2,
          },
        });
      }
      sessionIdResponse = session.id;
    } catch (dbError) {
      console.warn('[parse-cv] DB save failed (non-blocking):', dbError);
      sessionIdResponse = sessionId;
    }

    console.warn(
      `[parse-cv] Total request time: ${Date.now() - requestStart}ms`
    );
    clearTimeout(timeoutTimer);
    return NextResponse.json({
      success: true,
      data: parsedCv,
      model: usedModel,
      sessionId: sessionIdResponse,
      cached: false,
      parseTimeMs: Date.now() - requestStart,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutTimer);
    console.error('[parse-cv] Error:', error);

    // Handle abort / timeout
    if (
      error instanceof Error &&
      (error.message.includes('timed out') || error.name === 'AbortError')
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Request timed out. The server may be busy — please try again in a few seconds.',
        },
        { status: 504 }
      );
    }

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
