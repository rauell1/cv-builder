import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  callAIRaceForTask,
  hasAnyProviderCredentials,
  pickBestModelForTask,
  AIModelFailedError,
} from '@/lib/ai-provider';
import { CV_PARSE_SYSTEM_PROMPT, type ParsedCV } from '@/lib/cv-types';
import { extractJSON, safeJSONParse } from '@/lib/json-utils';
import { aiQueue } from '@/lib/request-queue';
import { parsingCache, hashContent } from '@/lib/response-cache';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { sanitizeParsedCV } from '@/lib/text-cleaning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_CV_LENGTH = 50_000;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateAndNormalize(obj: unknown): ParsedCV {
  if (!obj || typeof obj !== 'object') throw new Error('Not a valid object');
  const data = obj as Record<string, unknown>;
  if (!data.personalInfo || typeof data.personalInfo !== 'object') throw new Error('Missing personalInfo');
  const pi = data.personalInfo as Record<string, unknown>;
  if (!pi.fullName || typeof pi.fullName !== 'string' || !pi.fullName.trim()) {
    const alt = pi.name || pi.full_name || pi.firstName || pi.first_name || '';
    if (typeof alt === 'string' && alt.trim()) pi.fullName = alt.trim();
    else throw new Error('Missing personalInfo.fullName');
  }
  return {
    personalInfo: {
      fullName: String(pi.fullName || ''), location: String(pi.location || ''),
      email: String(pi.email || ''), phone: String(pi.phone || ''),
      linkedin: String(pi.linkedin || ''), github: String(pi.github || ''), website: String(pi.website || ''),
    },
    personalStatement:
      typeof data.personalStatement === 'string' ? data.personalStatement
      : typeof data.summary === 'string' ? data.summary
      : typeof data.objective === 'string' ? data.objective
      : typeof data.profile === 'string' ? data.profile : '',
    projects:       Array.isArray(data.projects)       ? data.projects.filter((p: unknown) => p && typeof p === 'object') : [],
    workExperience: Array.isArray(data.workExperience) ? data.workExperience.filter((w: unknown) => w && typeof w === 'object')
                  : Array.isArray(data.experience)     ? data.experience.filter((w: unknown) => w && typeof w === 'object')
                  : Array.isArray(data.work_experience)? data.work_experience.filter((w: unknown) => w && typeof w === 'object') : [],
    education:      Array.isArray(data.education)      ? data.education.filter((e: unknown) => e && typeof e === 'object') : [],
    skills:         Array.isArray(data.skills)         ? data.skills.filter((s: unknown) => s && typeof s === 'object') : [],
    certifications: Array.isArray(data.certifications) ? data.certifications.filter((c: unknown) => c && typeof c === 'object') : [],
  };
}

function tryParseResponse(text: string): ParsedCV | null {
  try {
    if (!text || typeof text !== 'string') return null;
    const rawJson = extractJSON(text);
    if (!rawJson) return null;
    return validateAndNormalize(safeJSONParse(rawJson));
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Built-in fast regex parser (instant — no AI needed)
// ---------------------------------------------------------------------------

function pickFirst(text: string, re: RegExp): string { return text.match(re)?.[0]?.trim() || ''; }
function cleanLine(line: string): string { return line.replace(/^[\s\-•*]+/, '').trim(); }

function parseSectionBlocks(cvText: string): Record<string, string[]> {
  const lines = cvText.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  const sectionMap: Record<string, string[]> = { header:[], summary:[], experience:[], education:[], skills:[], projects:[], certifications:[] };
  const headingToKey: Array<{re:RegExp;key:keyof typeof sectionMap}> = [
    { re: /^(summary|profile|objective|personal\s+statement)$/i, key: 'summary' },
    { re: /^(experience|work\s+experience|employment|professional\s+experience)$/i, key: 'experience' },
    { re: /^(education|academic\s+background)$/i, key: 'education' },
    { re: /^(skills|technical\s+skills|core\s+competencies)$/i, key: 'skills' },
    { re: /^(projects|project\s+experience)$/i, key: 'projects' },
    { re: /^(certifications|licenses|certificates)$/i, key: 'certifications' },
  ];
  let current: keyof typeof sectionMap = 'header';
  for (const line of lines) {
    const h = headingToKey.find(h => h.re.test(line));
    if (h) { current = h.key; continue; }
    sectionMap[current].push(line);
  }
  return sectionMap;
}

function parseBuiltIn(cvText: string): ParsedCV {
  const sections = parseSectionBlocks(cvText);
  const topLines = sections.header.slice(0, 12);
  const email    = pickFirst(cvText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phone    = pickFirst(cvText, /(\+?\d[\d\s().-]{7,}\d)/g);
  const linkedin = pickFirst(cvText, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w\-./?=&%]+/gi);
  const github   = pickFirst(cvText, /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-./?=&%]+/gi);
  const website  = pickFirst(cvText, /https?:\/\/(?!.*linkedin\.com)(?!.*github\.com)[^\s]+/gi);
  const fullName = topLines.find(l => { if (l.length < 3 || l.length > 60 || /@|https?:/i.test(l) || /\d{3,}/.test(l)) return false; const w = l.split(/\s+/).filter(Boolean); return w.length >= 2 && w.length <= 5; }) || '';
  const location = topLines.find(l => !/@|https?:/i.test(l) && !/\d{3,}/.test(l) && /,/.test(l)) || '';
  const personalStatement = sections.summary.slice(0, 4).join(' ').trim();
  const skillTokens = sections.skills.join(' | ').split(/[|,•]/).map(s => cleanLine(s)).filter(s => s.length > 1).slice(0, 40);
  const skills = skillTokens.length ? [{ category: 'Core Skills', skills: skillTokens.join(', ') }] : [];
  const workExperience: ParsedCV['workExperience'] = [];
  let cw: ParsedCV['workExperience'][number] | null = null;
  for (const raw of sections.experience) {
    const line = raw.trim(); if (!line) continue;
    const isBullet = /^[-•*]\s+/.test(raw);
    const hasDate  = /(20\d{2}|19\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
    if (!cw || (!isBullet && hasDate && cw.title)) { if (cw) workExperience.push(cw); cw = { dateRange: hasDate ? line : '', title: hasDate ? '' : cleanLine(line), subtitle: '', bullets: [] }; continue; }
    if (isBullet) cw.bullets.push(cleanLine(raw)); else if (!cw.title) cw.title = cleanLine(line); else if (!cw.subtitle) cw.subtitle = cleanLine(line); else cw.bullets.push(cleanLine(line));
  }
  if (cw) workExperience.push(cw);
  const education: ParsedCV['education'] = sections.education.filter(Boolean).slice(0, 6).map(l => ({ dateRange: pickFirst(l, /(20\d{2}|19\d{2})(\s*[-–]\s*(20\d{2}|19\d{2}|present|current))?/i), degree: cleanLine(l), institution: '' }));
  const projects: ParsedCV['projects'] = sections.projects.filter(Boolean).slice(0, 8).map(l => ({ category: 'Project', title: cleanLine(l).slice(0, 80), description: cleanLine(l) }));
  const certifications: ParsedCV['certifications'] = sections.certifications.filter(Boolean).slice(0, 10).map(l => ({ name: cleanLine(l) }));
  return sanitizeParsedCV({ personalInfo: { fullName, location, email, phone, linkedin, github, website }, personalStatement, projects, workExperience, education, skills, certifications });
}

// ---------------------------------------------------------------------------
// Core parsing — races fast parsing models in parallel for maximum speed.
// ALWAYS returns a result — never throws. Falls back to built-in parser on
// any AI failure so the user is never stuck.
// ---------------------------------------------------------------------------

interface ParseResult {
  parsedCv: ParsedCV;
  usedModel: string;
  source: 'ai' | 'builtin';
  warning?: string;
}

async function parseCvCore(cvText: string): Promise<ParseResult> {
  const t0 = Date.now();

  // ── Garbled-text gate ────────────────────────────────────────────────────
  // PDFs with custom font encoding produce mostly non-letter chars (symbols, numbers).
  // Sending this to AI burns 45s and always times out. Detect it early and skip to built-in.
  const alphaChars = (cvText.match(/\p{L}/gu) || []).length;
  const alphaRatio = alphaChars / Math.max(cvText.length, 1);
  const hasCvKeywords = /email|phone|experience|education|skills|university|linkedin|resume|curriculum|work history/i.test(cvText);
  if (alphaRatio < 0.20 && !hasCvKeywords) {
    console.warn(`[parse-cv] Garbled text (alphaRatio=${alphaRatio.toFixed(3)}) — skipping AI, using built-in`);
    return {
      parsedCv: parseBuiltIn(cvText),
      usedModel: 'builtin',
      source: 'builtin',
      warning: 'The extracted text appears garbled (PDF with custom font encoding). For accurate results, convert the PDF to an image or paste the text directly.',
    };
  }

  if (!hasAnyProviderCredentials()) {
    console.warn('[parse-cv] No AI credentials – using built-in parser');
    return { parsedCv: parseBuiltIn(cvText), usedModel: 'builtin', source: 'builtin' };
  }

  // ── AI attempt ──────────────────────────────────────────────────────────
  try {
    // Race Mistral (NVIDIA free) vs gpt-5.4 (Pekpik) — independent rate limits
    const aiResult = await callAIRaceForTask(
      'parse',
      [
        { role: 'system', content: CV_PARSE_SYSTEM_PROMPT },
        { role: 'user',   content: cvText },
      ],
      2,   // race 2 models: Mistral + Pekpik gpt-5.4
      0.1, // low temperature = deterministic JSON
    );

    console.warn(`[parse-cv] AI race responded in ${Date.now() - t0}ms (model: ${aiResult.model})`);

    const parsedCv = tryParseResponse(aiResult.content);
    if (parsedCv) return { parsedCv, usedModel: aiResult.model, source: 'ai' };

    // JSON unparseable – single strict-prompt retry (no sleep)
    console.warn('[parse-cv] Race JSON unparseable, trying strict retry...');
    try {
      const primaryModel = pickBestModelForTask('parse');
      const retryResult = await callAIRaceForTask(
        'parse',
        [
          { role: 'system', content: 'You are a CV parser. Return ONLY valid raw JSON starting with {. No markdown.' },
          { role: 'user',   content: `Parse this CV into JSON:\n\n${cvText.substring(0, 10_000)}` },
        ],
        2,
        0.1,
        primaryModel,
      );
      const retryCv = tryParseResponse(retryResult.content);
      if (retryCv) {
        console.warn(`[parse-cv] Strict retry succeeded with ${retryResult.model} (${Date.now()-t0}ms)`);
        return { parsedCv: retryCv, usedModel: retryResult.model, source: 'ai' };
      }
    } catch (retryErr) {
      console.warn('[parse-cv] Strict retry threw:', retryErr instanceof Error ? retryErr.message : String(retryErr));
    }

    // AI returned text but we could not parse JSON — fall through to built-in
    console.warn(`[parse-cv] AI response not parseable after ${Date.now()-t0}ms — using built-in parser`);
  } catch (aiErr) {
    // Includes AIModelFailedError (all providers exhausted), network errors, etc.
    // Log the real reason server-side but NEVER surface it to the browser.
    if (aiErr instanceof AIModelFailedError) {
      console.error(
        '[parse-cv] AIModelFailedError — diagnostics:',
        JSON.stringify(aiErr.diagnostics, null, 2),
      );
    } else {
      console.error('[parse-cv] AI call threw:', aiErr instanceof Error ? aiErr.message : String(aiErr));
    }
  }

  // ── Built-in fallback (always succeeds) ─────────────────────────────────
  console.warn(`[parse-cv] All AI attempts failed after ${Date.now()-t0}ms — using built-in parser`);
  return {
    parsedCv: parseBuiltIn(cvText),
    usedModel: 'builtin',
    source: 'builtin',
    warning: 'AI parsing unavailable — used fast built-in parser. Results may be less structured.',
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestStart = Date.now();

  const ip = resolveClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip, 'ai');
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please try again in ${retryAfter} seconds.` },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request format.' }, { status: 400 }); }

  const rawCvText = body.cvText;
  const sessionId = body.sessionId as string | undefined;

  if (!rawCvText || typeof rawCvText !== 'string') {
    return NextResponse.json({ success: false, error: 'cvText is required and must be a string.' }, { status: 400 });
  }

  const cvText = rawCvText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

  if (cvText.length < 20) return NextResponse.json({ success: false, error: 'CV text is too short.' }, { status: 400 });
  if (cvText.length > MAX_CV_LENGTH) return NextResponse.json({ success: false, error: `CV text too long (${cvText.length.toLocaleString()} chars). Max ${MAX_CV_LENGTH.toLocaleString()}.` }, { status: 400 });

  // Cache check (instant)
  const cacheKey = hashContent(cvText.trim());
  const cached = parsingCache.get(cacheKey) as { parsedCv: ParsedCV; usedModel: string } | null;
  if (cached) {
    console.warn('[parse-cv] Cache hit');
    if (sessionId) {
      db.cVSession.upsert({
        where: { id: sessionId },
        update: { parsedCv: JSON.stringify(cached.parsedCv), modelUsed: cached.usedModel, step: 2, updatedAt: new Date() },
        create: { rawCvText: cvText, parsedCv: JSON.stringify(cached.parsedCv), modelUsed: cached.usedModel, step: 2 },
      }).catch(() => { /* non-critical */ });
    }
    return NextResponse.json({ success: true, data: cached.parsedCv, model: cached.usedModel, cached: true, processingTime: Date.now() - requestStart });
  }

  // parseCvCore never throws — it always returns a result
  const { parsedCv, usedModel, source, warning } = await aiQueue.add(() => parseCvCore(cvText), 'high');
  const processingTime = Date.now() - requestStart;
  console.warn(`[parse-cv] Done in ${processingTime}ms via ${source} (${usedModel})`);

  // Non-blocking writes
  parsingCache.set(cacheKey, { parsedCv, usedModel });
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
    ...(warning ? { warning } : {}),
  });
}
