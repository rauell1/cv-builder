import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIRace,
  getNextRotatingModel,
  hasAnyProviderCredentials,
  autoSelectModel,
} from '@/lib/ai-provider';
import { CV_PARSE_SYSTEM_PROMPT, type ParsedCV } from '@/lib/cv-types';
import { aiQueue } from '@/lib/request-queue';
import { parsingCache, hashContent } from '@/lib/response-cache';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { sanitizeParsedCV } from '@/lib/text-cleaning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Increase to 45 s – gives the race + sequential fallback enough headroom
export const maxDuration = 45;

const MAX_CV_LENGTH = 50_000;

// ---------------------------------------------------------------------------
// Robust JSON extraction (unchanged – already correct)
// ---------------------------------------------------------------------------

function extractJSON(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = codeBlockRe.exec(text);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (candidate.startsWith('{')) return candidate;
  }
  let depth = 0, start = -1;
  let inString = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape)          { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{')      { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return text.substring(start, i + 1); }
  }
  return null;
}

function fixCommonJSONIssues(json: string): string {
  return json
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/'([^']+)'\s*:/g, '"$1":')
    .replace(/:\s*'([^']*?)'/g, ': "$1"')
    .replace(/[\[,]\s*'([^']*?)'/g, (match) => match.replace(/'/g, '"'));
}

function fixUnescapedNewlinesInStrings(json: string): string {
  let result = '', inString = false, escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape)          { result += ch; escape = false; continue; }
    if (ch === '\\' && inString) { result += ch; escape = true; continue; }
    if (ch === '"')      { inString = !inString; result += ch; continue; }
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

function safeJSONParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* */ }
  try { return JSON.parse(fixCommonJSONIssues(raw)); } catch { /* */ }
  try { return JSON.parse(fixUnescapedNewlinesInStrings(raw)); } catch { /* */ }
  try { return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(raw))); } catch { /* */ }
  try {
    const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(cleaned)));
  } catch { /* */ }
  throw new Error(`Failed to parse JSON after 5 strategies. Raw (first 300 chars): ${raw.substring(0, 300)}`);
}

function validateAndNormalize(obj: unknown): ParsedCV {
  if (!obj || typeof obj !== 'object') throw new Error('Response is not a valid object');
  const data = obj as Record<string, unknown>;
  if (!data.personalInfo || typeof data.personalInfo !== 'object') throw new Error('Missing personalInfo field');
  const pi = data.personalInfo as Record<string, unknown>;
  if (!pi.fullName || typeof pi.fullName !== 'string' || !pi.fullName.trim()) {
    const possibleName = pi.name || pi.full_name || pi.firstName || pi.first_name || '';
    if (typeof possibleName === 'string' && possibleName.trim()) {
      pi.fullName = possibleName.trim();
    } else {
      throw new Error('Missing required personalInfo.fullName field');
    }
  }
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
      typeof data.personalStatement === 'string' ? data.personalStatement :
      typeof data.summary === 'string'           ? data.summary :
      typeof data.objective === 'string'         ? data.objective :
      typeof data.profile === 'string'           ? data.profile : '',
    projects:       Array.isArray(data.projects)       ? data.projects.filter((p: unknown) => p && typeof p === 'object')       : [],
    workExperience: Array.isArray(data.workExperience) ? data.workExperience.filter((w: unknown) => w && typeof w === 'object') :
                    Array.isArray(data.experience)     ? data.experience.filter((w: unknown) => w && typeof w === 'object')     :
                    Array.isArray(data.work_experience)? data.work_experience.filter((w: unknown) => w && typeof w === 'object'): [],
    education:       Array.isArray(data.education)      ? data.education.filter((e: unknown) => e && typeof e === 'object')      : [],
    skills:          Array.isArray(data.skills)         ? data.skills.filter((s: unknown) => s && typeof s === 'object')         : [],
    certifications:  Array.isArray(data.certifications) ? data.certifications.filter((c: unknown) => c && typeof c === 'object') : [],
  };
  return sanitizeParsedCV(parsedCv);
}

function tryParseResponse(text: string): ParsedCV | null {
  try {
    if (!text || typeof text !== 'string') return null;
    const rawJson = extractJSON(text);
    if (!rawJson) return null;
    const obj = safeJSONParse(rawJson);
    return validateAndNormalize(obj);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Built-in fast regex parser (instant – no AI needed)
// ---------------------------------------------------------------------------

function pickFirstMatch(text: string, re: RegExp): string {
  return text.match(re)?.[0]?.trim() || '';
}

function cleanLine(line: string): string {
  return line.replace(/^[\s\-•*]+/, '').trim();
}

function parseSectionBlocks(cvText: string): Record<string, string[]> {
  const lines = cvText.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const sectionMap: Record<string, string[]> = {
    header: [], summary: [], experience: [], education: [], skills: [], projects: [], certifications: [],
  };
  const headingToKey: Array<{ re: RegExp; key: keyof typeof sectionMap }> = [
    { re: /^(summary|profile|objective|personal\s+statement)$/i, key: 'summary' },
    { re: /^(experience|work\s+experience|employment\s+history|professional\s+experience)$/i, key: 'experience' },
    { re: /^(education|academic\s+background)$/i, key: 'education' },
    { re: /^(skills|technical\s+skills|core\s+competencies)$/i, key: 'skills' },
    { re: /^(projects|project\s+experience)$/i, key: 'projects' },
    { re: /^(certifications|licenses|certificates)$/i, key: 'certifications' },
  ];
  let current: keyof typeof sectionMap = 'header';
  for (const line of lines) {
    const maybeHeading = headingToKey.find((h) => h.re.test(line));
    if (maybeHeading) { current = maybeHeading.key; continue; }
    sectionMap[current].push(line);
  }
  return sectionMap;
}

function parseBuiltIn(cvText: string): ParsedCV {
  const sections = parseSectionBlocks(cvText);
  const topLines = sections.header.slice(0, 12);
  const email    = pickFirstMatch(cvText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phone    = pickFirstMatch(cvText, /(\+?\d[\d\s().-]{7,}\d)/g);
  const linkedin = pickFirstMatch(cvText, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w\-./?=&%]+/gi);
  const github   = pickFirstMatch(cvText, /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-./?=&%]+/gi);
  const website  = pickFirstMatch(cvText, /https?:\/\/(?!.*linkedin\.com)(?!.*github\.com)[^\s]+/gi);
  const fullName = topLines.find((line) => {
    if (line.length < 3 || line.length > 60) return false;
    if (/@|https?:\/\//i.test(line)) return false;
    if (/\d{3,}/.test(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5;
  }) || '';
  const location = topLines.find((line) =>
    !/@|https?:\/\//i.test(line) && !/\d{3,}/.test(line) && /,/.test(line)
  ) || '';
  const personalStatement = sections.summary.slice(0, 4).join(' ').trim();
  const skillsText = sections.skills.join(' | ');
  const skillTokens = skillsText.split(/[|,•]/).map((s) => cleanLine(s)).filter((s) => s.length > 1).slice(0, 40);
  const skills = skillTokens.length ? [{ category: 'Core Skills', skills: skillTokens.join(', ') }] : [];
  const workExperience: ParsedCV['workExperience'] = [];
  let currentWork: ParsedCV['workExperience'][number] | null = null;
  for (const rawLine of sections.experience) {
    const line = rawLine.trim();
    if (!line) continue;
    const isBullet = /^[-•*]\s+/.test(rawLine);
    const hasDate  = /(20\d{2}|19\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
    if (!currentWork || (!isBullet && hasDate && currentWork.title)) {
      if (currentWork) workExperience.push(currentWork);
      currentWork = { dateRange: hasDate ? line : '', title: hasDate ? '' : cleanLine(line), subtitle: '', bullets: [] };
      continue;
    }
    if (isBullet)               currentWork.bullets.push(cleanLine(rawLine));
    else if (!currentWork.title)   currentWork.title = cleanLine(line);
    else if (!currentWork.subtitle) currentWork.subtitle = cleanLine(line);
    else                           currentWork.bullets.push(cleanLine(line));
  }
  if (currentWork) workExperience.push(currentWork);
  const education: ParsedCV['education'] = sections.education.filter(Boolean).slice(0, 6).map((line) => ({
    dateRange: pickFirstMatch(line, /(20\d{2}|19\d{2})(\s*[-–]\s*(20\d{2}|19\d{2}|present|current))?/i),
    degree: cleanLine(line),
    institution: '',
  }));
  const projects: ParsedCV['projects'] = sections.projects.filter(Boolean).slice(0, 8).map((line) => ({
    category: 'Project',
    title: cleanLine(line).slice(0, 80),
    description: cleanLine(line),
  }));
  const certifications: ParsedCV['certifications'] = sections.certifications.filter(Boolean).slice(0, 10).map((line) => ({ name: cleanLine(line) }));
  return sanitizeParsedCV({ personalInfo: { fullName, location, email, phone, linkedin, github, website }, personalStatement, projects, workExperience, education, skills, certifications });
}

// ---------------------------------------------------------------------------
// Core parsing – uses race + fallback for speed
// ---------------------------------------------------------------------------

interface ParseResult {
  parsedCv: ParsedCV;
  usedModel: string;
  source: 'ai' | 'builtin';
}

async function parseCvCore(cvText: string): Promise<ParseResult> {
  const t0 = Date.now();

  if (!hasAnyProviderCredentials()) {
    console.warn('[parse-cv] No AI credentials – using built-in parser');
    return { parsedCv: parseBuiltIn(cvText), usedModel: 'builtin', source: 'builtin' };
  }

  // Pick the best fast model for simple CV extraction
  const primaryModel = autoSelectModel('simple');

  // Race top-2 fast models in parallel – whoever answers first wins
  const aiResult = await callAIRace(
    [
      { role: 'system', content: CV_PARSE_SYSTEM_PROMPT },
      { role: 'user',   content: cvText },
    ],
    primaryModel,
    'simple',
    2, // race 2 concurrent models
    0.1 // low temperature = more deterministic JSON
  );

  const { content: responseText, model: usedModel } = aiResult;
  console.warn(`[parse-cv] AI responded in ${Date.now() - t0}ms (model: ${usedModel})`);

  const parsedCv = tryParseResponse(responseText);
  if (parsedCv) return { parsedCv, usedModel, source: 'ai' };

  // AI responded but JSON was unparseable – try one more model then fall back to built-in
  console.warn('[parse-cv] AI JSON parse failed, trying one retry...');
  try {
    const retryResult = await callAIRace(
      [
        {
          role: 'system',
          content:
            'You are a CV parser. Return ONLY valid raw JSON. No markdown fences, no explanation. ' +
            'The response must start with { and end with }.',
        },
        {
          role: 'user',
          content:
            `Parse this CV into JSON:\n\n${cvText.substring(0, 10_000)}`,
        },
      ],
      primaryModel,
      'simple',
      2,
      0.1
    );
    const retryCv = tryParseResponse(retryResult.content);
    if (retryCv) {
      console.warn(`[parse-cv] Retry succeeded with ${retryResult.model} (${Date.now() - t0}ms)`);
      return { parsedCv: retryCv, usedModel: retryResult.model, source: 'ai' };
    }
  } catch (retryErr) {
    console.warn('[parse-cv] Retry threw:', retryErr instanceof Error ? retryErr.message : String(retryErr));
  }

  // All AI attempts failed – use the fast built-in parser as a last resort
  console.warn(`[parse-cv] All AI attempts failed after ${Date.now() - t0}ms – using built-in parser`);
  return { parsedCv: parseBuiltIn(cvText), usedModel: 'builtin', source: 'builtin' };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestStart = Date.now();

  // --- Rate limiting ---
  const ip = resolveClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip, 'ai');
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please try again in ${retryAfter} seconds.` },
      { status: 429 }
    );
  }

  // --- Parse request body ---
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request format. Please send valid JSON.' },
      { status: 400 }
    );
  }

  const rawCvText = body.cvText;
  const sessionId = body.sessionId as string | undefined;

  if (!rawCvText || typeof rawCvText !== 'string') {
    return NextResponse.json(
      { success: false, error: 'cvText is required and must be a string.' },
      { status: 400 }
    );
  }

  const cvText = rawCvText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (cvText.length < 20) {
    return NextResponse.json(
      { success: false, error: 'CV text is too short. Please provide at least 20 characters.' },
      { status: 400 }
    );
  }

  if (cvText.length > MAX_CV_LENGTH) {
    return NextResponse.json(
      { success: false, error: `CV text is too long (${cvText.length.toLocaleString()} chars). Max is ${MAX_CV_LENGTH.toLocaleString()}.` },
      { status: 400 }
    );
  }

  // --- Cache check (instant) ---
  const cacheKey = hashContent(cvText.trim());
  const cached = parsingCache.get(cacheKey) as { parsedCv: ParsedCV; usedModel: string } | null;

  if (cached) {
    console.warn('[parse-cv] Cache hit:', cacheKey.substring(0, 12));
    // Fire-and-forget DB persist (non-blocking)
    if (sessionId) {
      db.cVSession.upsert({
        where: { id: sessionId },
        update: { parsedCv: JSON.stringify(cached.parsedCv), modelUsed: cached.usedModel, step: 2, updatedAt: new Date() },
        create: { rawCvText: cvText, parsedCv: JSON.stringify(cached.parsedCv), modelUsed: cached.usedModel, step: 2 },
      }).catch(() => { /* non-critical */ });
    }
    return NextResponse.json({
      success: true,
      data: cached.parsedCv,
      model: cached.usedModel,
      cached: true,
      processingTime: Date.now() - requestStart,
    });
  }

  // --- Parse via AI (queued to prevent concurrency overload) ---
  try {
    const { parsedCv, usedModel, source } = await aiQueue.add(() => parseCvCore(cvText));

    const processingTime = Date.now() - requestStart;
    console.warn(`[parse-cv] Done in ${processingTime}ms via ${source} (${usedModel})`);

    // Cache result (non-blocking write)
    parsingCache.set(cacheKey, { parsedCv, usedModel });

    // Persist to DB (non-blocking – don't await)
    if (sessionId) {
      db.cVSession.upsert({
        where: { id: sessionId },
        update: { parsedCv: JSON.stringify(parsedCv), modelUsed: usedModel, step: 2, updatedAt: new Date() },
        create: { rawCvText: cvText, parsedCv: JSON.stringify(parsedCv), modelUsed: usedModel, step: 2 },
      }).catch((dbErr: unknown) => {
        console.warn('[parse-cv] DB save failed (non-critical):', dbErr instanceof Error ? dbErr.message : String(dbErr));
      });
    }

    return NextResponse.json({
      success: true,
      data: parsedCv,
      model: usedModel,
      source,
      processingTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[parse-cv] Fatal error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
