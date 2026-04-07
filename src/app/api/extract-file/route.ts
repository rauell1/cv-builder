/**
 * extract-file/route.ts — Upload CV File → Extract Text → Parse to Structured CV Data
 *
 * Supports: PDF (native text + OCR fallback), DOCX (mammoth), PNG/JPG (VLM OCR)
 *
 * Pipeline:
 *   1. Rate limit check (per-IP, 5 req/min)
 *   2. Validate uploaded file (type, size, extension)
 *   3. Extract raw text (format-specific)
 *   4. Validate extracted text (garbled detection, min length)
 *   5. Parse text via LLM → structured CV JSON (with retry)
 *   6. Return both raw text + parsed CV data
 */

/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, PDFName, PDFArray, PDFRef } from 'pdf-lib';
import mammoth from 'mammoth';
import zlib from 'zlib';
import { exec } from 'child_process';
import { promisify } from 'util';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');
const cjsRequire = createRequire(import.meta.url);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const execAsync = promisify(exec);
const inflateAsync = promisify(zlib.inflate);
const inflateRawAsync = promisify(zlib.inflateRaw);

// ---- Project infrastructure ----
import { aiQueue } from '@/lib/request-queue';
import { extractionCache, hashContent } from '@/lib/response-cache';
import { callAIWithFallback, callAIVision } from '@/lib/ai-provider';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { CV_PARSE_SYSTEM_PROMPT, type ParsedCV } from '@/lib/cv-types';
import { sanitizeGeneratedText, sanitizeParsedCV } from '@/lib/text-cleaning';

// =============================================================================
// Constants
// =============================================================================

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.docx'];

/** 20 MB max upload */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Minimum extracted text length to consider extraction successful */
const MIN_TEXT_LENGTH = 20;

/** Maximum text length to send to LLM (truncate beyond this) */
const MAX_TEXT_FOR_LLM = 12_000;

/** Timeout for the entire request (file processing can be slow) */
const REQUEST_TIMEOUT_MS = 60_000;

const MAX_OCR_IMAGE_DIMENSION = 1024;
const MAX_OCR_IMAGE_BYTES = 50_000; // 50KB target
const MIN_PDF_NATIVE_FALLBACK_LEN = MIN_TEXT_LENGTH;

// =============================================================================
// Text Quality Validation
// =============================================================================

/**
 * Returns a readability score 0–1. Scores < 0.2 indicate garbled text.
 * Multi-language aware (CJK, Cyrillic, Arabic, Latin).
 */
function textReadabilityScore(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  const trimmed = text.trim();
  const len = trimmed.length;

  const alphaCount = (trimmed.match(/\p{L}/gu) || []).length;
  const alphaRatio = alphaCount / len;

  const words = trimmed.match(/[\p{L}\p{N}]{2,}/gu) || [];
  const wordCount = words.length;
  const wordDensity = wordCount / (len / 5);

  const controlChars = (trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  const controlRatio = controlChars / len;

  const longTokens = words.filter(w => w.length > 30).length;
  const longTokenRatio = longTokens / Math.max(wordCount, 1);

  // Multi-language common word signals
  const enRe = /\b(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|has|have|from|with|that|this|will|been|each|make|like|long|look|many|some|them|than|call|come|made|find|back|only|also|new|just|over|such|take|year|your|good|work|first|well|way|even|experience|education|skills|university|company|developer|manager|engineer|project|team)\b/i;
  const zhRe = /的|了|是|在|我|有|和|人|这|中|大|为|上|个|国|不|到|说|时|会|出|对|也|可|能|学|工|经|验|技|能|项|目|发|展|管|理|教|育|专|业/;
  const euRe = /\b(le|la|les|de|des|et|est|un|une|pour|dans|par|sur|avec|der|die|das|und|ist|ein|eine|für|mit|auf|von|sich|nicht|los|las|y|que|por|con|para)\b/i;
  const arRe = /في|من|على|إلى|عن|مع|هذا|هذه|التي|الذي|كان|قد|لا|أن|إذا|ما|كل|بعد|بين|حتى|عند|أو/;

  const commonWordCount = Math.max(
    (trimmed.match(enRe) || []).length,
    (trimmed.match(zhRe) || []).length,
    (trimmed.match(euRe) || []).length,
    (trimmed.match(arRe) || []).length,
  );
  const commonWordRatio = commonWordCount / Math.max(wordCount, 1);

  let score = 0;
  score += Math.min(alphaRatio / 0.5, 1) * 0.3;
  score += Math.min(wordDensity / 0.8, 1) * 0.2;
  score += Math.max(0, 1 - controlRatio * 20) * 0.15;
  score += Math.max(0, 1 - longTokenRatio * 5) * 0.15;
  score += Math.min(commonWordRatio * 3, 1) * 0.2;

  return Math.max(0, Math.min(1, score));
}

function normalizeExtractedText(text: string): string {
  if (!text) return '';

  return sanitizeGeneratedText(text)
    // Remove replacement characters and null bytes
    .replace(/[\uFFFD\u0000]/g, '')
    // Remove ALL box drawing characters (common OCR artifacts)
    .replace(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g, ' ')
    // Remove excessive whitespace but preserve single line breaks
    .replace(/[ \t]{2,}/g, ' ')
    // Remove multiple consecutive blank lines (keep max 2 line breaks)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasCvSignal(text: string): boolean {
  return /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}|\b(experience|education|skills|projects|linkedin|github|summary|profile|work)\b/i.test(text);
}

/**
 * Validate extracted text before sending to LLM.
 * Returns { valid, reason } — valid=false means the text should NOT go to LLM.
 */
function validateExtractedText(text: string): { valid: boolean; reason?: string } {
  const trimmed = normalizeExtractedText(text);
  if (trimmed.length === 0) return { valid: false, reason: 'Extracted text is empty.' };
  if (trimmed.length < MIN_TEXT_LENGTH) return { valid: false, reason: `Extracted text is too short (${trimmed.length} chars). Minimum ${MIN_TEXT_LENGTH} characters required.` };

  const readability = textReadabilityScore(trimmed);
  if (readability < 0.12) return { valid: false, reason: 'Extracted text appears garbled or unreadable.' };
  if (readability < 0.2 && !hasCvSignal(trimmed)) {
    return { valid: false, reason: 'Extracted text appears garbled or unreadable.' };
  }

  // Check for excessive control characters
  const controlChars = (trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  if (controlChars / trimmed.length > 0.05) return { valid: false, reason: 'Extracted text contains too many control characters.' };

  return { valid: true };
}

// =============================================================================
// Robust JSON Extraction from LLM Response
// =============================================================================

/**
 * Extract the first valid JSON object from an LLM response string.
 * Handles ```json code blocks and raw JSON with balanced-brace scanning.
 */
function extractJSON(text: string): string | null {
  // Strategy 1: ```json ... ``` code blocks
  const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = codeBlockRe.exec(text);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (candidate.startsWith('{')) return candidate;
  }

  // Strategy 2: Balanced-brace scanning
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
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) return text.substring(start, i + 1);
    }
  }

  return null;
}

/**
 * Fix common LLM JSON output issues.
 */
function fixJSONIssues(json: string): string {
  return json
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/(?<=:\s*|[\[,]\s*)'([^']*)'(?=\s*[,}\]:])/g, '"$1"')
    .replace(/(?<=:\s*")([\s\S]*?)(?="\s*[,}])/g, (match) =>
      match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    );
}

/**
 * Validate and normalize parsed CV object to ParsedCV interface.
 */
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

  return {
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
      typeof data.personalStatement === 'string' ? data.personalStatement
      : typeof data.summary === 'string' ? data.summary
      : typeof data.objective === 'string' ? data.objective
      : typeof data.profile === 'string' ? data.profile
      : '',
    projects: Array.isArray(data.projects) ? data.projects.filter((p: unknown) => p && typeof p === 'object') : [],
    workExperience:
      Array.isArray(data.workExperience) ? data.workExperience.filter((w: unknown) => w && typeof w === 'object')
      : Array.isArray(data.experience) ? data.experience.filter((w: unknown) => w && typeof w === 'object')
      : Array.isArray(data.work_experience) ? data.work_experience.filter((w: unknown) => w && typeof w === 'object')
      : [],
    education: Array.isArray(data.education) ? data.education.filter((e: unknown) => e && typeof e === 'object') : [],
    skills: Array.isArray(data.skills) ? data.skills.filter((s: unknown) => s && typeof s === 'object') : [],
    certifications: Array.isArray(data.certifications) ? data.certifications.filter((c: unknown) => c && typeof c === 'object') : [],
  };
}

// =============================================================================
// PDF Text Extraction — Full operator-based parser (pdf-lib internals)
// =============================================================================

function decodePDFString(raw: string): string {
  let result = ''; let i = 0;
  while (i < raw.length) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      switch (next) {
        case 'n': result += '\n'; i += 2; break;
        case 'r': result += '\r'; i += 2; break;
        case 't': result += '\t'; i += 2; break;
        case 'f': result += '\f'; i += 2; break;
        case '(': result += '(';  i += 2; break;
        case ')': result += ')';  i += 2; break;
        case '\\': result += '\\'; i += 2; break;
        default:
          if (next >= '0' && next <= '7') {
            let octal = '';
            for (let j = 1; j <= 3 && i + j < raw.length && raw[i + j] >= '0' && raw[i + j] <= '7'; j++) octal += raw[i + j];
            result += String.fromCharCode(parseInt(octal, 8));
            i += octal.length + 1;
          } else { result += next; i += 2; }
      }
    } else { result += raw[i]; i++; }
  }
  return result;
}

function decodeHexPDFString(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (!isNaN(byte) && byte > 0) result += String.fromCharCode(byte);
  }
  return result;
}

function parsePDFString(content: string, pos: number): { text: string; endPos: number } | null {
  if (pos >= content.length) return null;
  if (content[pos] === '(') {
    let depth = 1, i = pos + 1, raw = '';
    while (i < content.length && depth > 0) {
      if (content[i] === '\\') { raw += content[i]; if (i + 1 < content.length) { raw += content[i + 1]; i += 2; } else i++; }
      else if (content[i] === '(') { depth++; raw += '('; i++; }
      else if (content[i] === ')') { depth--; if (depth > 0) raw += ')'; i++; }
      else { raw += content[i]; i++; }
    }
    return { text: decodePDFString(raw), endPos: i };
  }
  if (content[pos] === '<') {
    const end = content.indexOf('>', pos + 1);
    if (end === -1) return null;
    return { text: decodeHexPDFString(content.substring(pos + 1, end)), endPos: end + 1 };
  }
  return null;
}

function parseNum(content: string, pos: number): { value: number; endPos: number } | null {
  const re = /^[+-]?(\d+\.?\d*|\.\d+)/;
  const m = re.exec(content.substring(pos));
  if (!m) return null;
  return { value: parseFloat(m[0]), endPos: pos + m[0].length };
}

function skipWS(content: string, pos: number): number {
  while (pos < content.length) {
    if (/\s/.test(content[pos])) pos++;
    else if (content[pos] === '%') { while (pos < content.length && content[pos] !== '\n' && content[pos] !== '\r') pos++; }
    else break;
  }
  return pos;
}

function readToken(content: string, pos: number): { token: string; endPos: number } | null {
  if (pos >= content.length) return null;
  const start = pos;
  while (pos < content.length && !/[\s()<>[\]{}\/%]/.test(content[pos])) pos++;
  if (pos === start) return null;
  return { token: content.substring(start, pos), endPos: pos };
}

interface TextElement { text: string; y: number; x: number; }

function extractTextFromContentStream(streamBytes: Uint8Array): string {
  const content = new TextDecoder('latin1').decode(streamBytes);
  const elements: TextElement[] = [];
  let tx = 0, ty = 0, tl = 0;
  const LT = 2;

  function newLine() { ty -= tl || 12; tx = 0; }
  function pushText(text: string) { const t = text.trim(); if (t) elements.push({ text: t, x: tx, y: ty }); }

  let pos = 0;
  const stack: (number | string)[] = [];

  while (pos < content.length) {
    pos = skipWS(content, pos);
    if (pos >= content.length) break;
    const ch = content[pos];

    if (ch === '(' || ch === '<') {
      const p = parsePDFString(content, pos);
      if (p) { stack.push(p.text); pos = p.endPos; continue; }
    }
    if (ch === '[') {
      let depth = 1, i = pos + 1;
      const items: (string | number)[] = [];
      while (i < content.length && depth > 0) {
        i = skipWS(content, i); if (i >= content.length) break;
        if (content[i] === ']') { depth--; i++; continue; }
        if (content[i] === '[') { depth++; i++; continue; }
        if (content[i] === '(' || content[i] === '<') { const p = parsePDFString(content, i); if (p) { items.push(p.text); i = p.endPos; continue; } }
        const n = parseNum(content, i); if (n) { items.push(n.value); i = n.endPos; continue; }
        i++;
      }
      stack.push(items as unknown as string); pos = i; continue;
    }
    if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9') || ch === '.') {
      const n = parseNum(content, pos);
      if (n) { stack.push(n.value); pos = n.endPos; continue; }
    }
    if (/[A-Za-z*]/.test(ch)) {
      const tok = readToken(content, pos);
      if (!tok) { pos++; continue; }
      pos = tok.endPos;
      const op = tok.token;
      switch (op) {
        case 'Tm': if (stack.length >= 6) { const v = stack.splice(-6) as number[]; tx = v[4]; ty = v[5]; } else stack.length = 0; break;
        case 'Td': if (stack.length >= 2) { const v = stack.splice(-2) as number[]; tx += v[0]; ty += v[1]; } else stack.length = 0; break;
        case 'TD': if (stack.length >= 2) { const v = stack.splice(-2) as number[]; tl = -v[1]; tx += v[0]; ty += v[1]; } else stack.length = 0; break;
        case 'T*': newLine(); break;
        case 'TL': if (stack.length >= 1) tl = stack.pop() as number; else stack.length = 0; break;
        case 'Tf': if (stack.length >= 2) stack.splice(-2); else stack.length = 0; break;
        case 'Tj': if (stack.length >= 1) pushText(String(stack.pop())); else stack.length = 0; break;
        case 'TJ': { if (stack.length >= 1) { const a = stack.pop(); if (Array.isArray(a)) { let b = ''; for (const it of a) if (typeof it === 'string') b += it; pushText(b); } else if (typeof a === 'string') pushText(a); } else stack.length = 0; break; }
        case "'": newLine(); if (stack.length >= 1) pushText(String(stack.pop())); else stack.length = 0; break;
        case '"': if (stack.length >= 3) { const t = String(stack.pop()); stack.pop(); stack.pop(); newLine(); pushText(t); } else stack.length = 0; break;
        case 'Tw': case 'Tc': case 'Ts': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'BT': stack.length = 0; tx = 0; ty = 0; break;
        case 'ET': stack.length = 0; break;
        case 'cm': if (stack.length >= 6) stack.splice(-6); else stack.length = 0; break;
        case 'q': case 'Q': stack.length = 0; break;
        case 're': if (stack.length >= 4) stack.splice(-4); else stack.length = 0; break;
        case 'rg': case 'RG': if (stack.length >= 3) stack.splice(-3); else stack.length = 0; break;
        case 'g': case 'G': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'k': case 'K': if (stack.length >= 4) stack.splice(-4); else stack.length = 0; break;
        case 'cs': case 'CS': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'sc': case 'scn': case 'SC': case 'SCN': stack.length = 0; break;
        case 'w': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'J': case 'j': case 'M': case 'd': case 'ri': case 'i': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'm': if (stack.length >= 2) stack.splice(-2); else stack.length = 0; break;
        case 'l': case 'v': case 'y': if (stack.length >= 2) stack.splice(-2); else stack.length = 0; break;
        case 'c': if (stack.length >= 6) stack.splice(-6); else stack.length = 0; break;
        case 'S': case 's': case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*': case 'n': case 'h': case 'W': case 'W*': stack.length = 0; break;
        case 'Do': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        case 'Tz': if (stack.length >= 1) stack.pop(); else stack.length = 0; break;
        default: stack.length = 0; break;
      }
      continue;
    }
    pos++;
  }

  elements.sort((a, b) => { const yd = b.y - a.y; if (Math.abs(yd) > LT) return yd; return a.x - b.x; });
  const lines: string[] = [];
  let curLine = '', curY = NaN;
  for (const el of elements) {
    if (isNaN(curY) || Math.abs(el.y - curY) > 3) { if (curLine.trim()) lines.push(curLine.trim()); curLine = el.text; curY = el.y; }
    else curLine += ' ' + el.text;
  }
  if (curLine.trim()) lines.push(curLine.trim());

  // Add blank lines before ALL-CAPS headers
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim(); if (!t) continue;
    const isHeader = t === t.toUpperCase() && t.length >= 2 && t.length <= 60 && /[A-Z]/.test(t) && !/[@.]/.test(t);
    if (isHeader && result.length > 0 && result[result.length - 1] !== '') result.push('');
    result.push(t);
  }
  return result.join('\n');
}

async function decompressStream(rawBytes: Uint8Array): Promise<Uint8Array> {
  if (rawBytes.length >= 2 && rawBytes[0] === 0x78) {
    try { return new Uint8Array(await inflateAsync(Buffer.from(rawBytes))); } catch {
      try { return new Uint8Array(await inflateRawAsync(Buffer.from(rawBytes))); } catch { /* fall through */ }
    }
  }
  return rawBytes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveStreamBytes(stream: any, _ctx: any): Promise<Uint8Array | undefined> {
  if (typeof stream.getContents === 'function') {
    const raw = stream.getContents();
    if (raw && raw.length > 0) return decompressStream(raw);
  }
  if (typeof stream.get === 'function') {
    const filter = stream.get(PDFName.of('Filter'));
    if (!filter && typeof stream.toString === 'function') {
      const str = stream.toString();
      if (str && str.length > 10) {
        const si = str.indexOf('stream');
        if (si !== -1) {
          const after = str.indexOf('\n', si) + 1;
          const end = str.indexOf('\nendstream', after);
          if (end > after) return decompressStream(new Uint8Array(Buffer.from(str.substring(after, end), 'latin1')));
        }
      }
    }
  }
  return undefined;
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  let primaryText = '';
  try {
    // Use stable pdf-parse v1 function API in Node runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule: any = cjsRequire('pdf-parse');
    const pdfParseFn =
      typeof pdfParseModule === 'function'
        ? pdfParseModule
        : typeof pdfParseModule?.default === 'function'
          ? pdfParseModule.default
          : null;

    if (pdfParseFn) {
      const parsed = await pdfParseFn(Buffer.from(buffer));
      primaryText = (parsed?.text || '').trim();
    }
  } catch (e) {
    console.warn('[extract-file] pdf-parse CJS extraction failed:', e instanceof Error ? e.message : e);
  }

  if (primaryText.length >= MIN_TEXT_LENGTH) {
    return primaryText;
  }

  // Fallback to low-level content stream extraction for PDFs that pdfjs fails to decode.
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const ctx = pdfDoc.context;
    const fallbackTexts: string[] = [];

    for (const page of pages) {
      const contentsEntry = page.node.get(PDFName.of('Contents'));
      if (!contentsEntry) continue;

      const refs: unknown[] = [];
      if (contentsEntry instanceof PDFArray) {
        for (let i = 0; i < contentsEntry.size(); i++) {
          const r = contentsEntry.get(i);
          if (r) refs.push(r);
        }
      } else {
        refs.push(contentsEntry);
      }

      for (const ref of refs) {
        try {
          const stream = ctx.lookup(ref as PDFRef);
          if (!stream) continue;
          const bytes = await resolveStreamBytes(stream, ctx);
          if (!bytes || bytes.length === 0) continue;
          const text = extractTextFromContentStream(bytes).trim();
          if (text) fallbackTexts.push(text);
        } catch (e) {
          console.warn('[extract-file] fallback stream read error:', e instanceof Error ? e.message : e);
        }
      }
    }

    const fallbackText = fallbackTexts.join('\n\n').trim();
    return fallbackText || primaryText;
  } catch (e) {
    console.warn('[extract-file] fallback PDF extractor failed:', e instanceof Error ? e.message : e);
    return primaryText;
  }
}

// =============================================================================
// PDF OCR Fallback — pdftoppm + VLM
// =============================================================================

async function ocrFallbackForPDF(buffer: ArrayBuffer, pageCount: number): Promise<string> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cv-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const prefix = path.join(tmpDir, 'page');

  try {
    await fsPromises.writeFile(pdfPath, Buffer.from(buffer));

    const MAX_PAGES = 5;
    const pagesToProcess = Math.min(pageCount, MAX_PAGES);

    try {
      if (pagesToProcess < pageCount) {
        await execAsync(`pdftoppm -png -r 100 -f 1 -l ${pagesToProcess} "${pdfPath}" "${prefix}"`, { timeout: 20000 });
      } else {
        await execAsync(`pdftoppm -png -r 100 "${pdfPath}" "${prefix}"`, { timeout: 20000 });
      }
    } catch (e) {
      throw new Error(`Failed to convert PDF to images: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    const files = await fsPromises.readdir(tmpDir);
    const pageFiles = files.filter(f => f.startsWith('page') && f.endsWith('.png')).sort();
    if (pageFiles.length === 0) throw new Error('Could not convert PDF pages to images.');

    const pageTexts: string[] = [];
    for (let i = 0; i < pageFiles.length; i++) {
      let pageText = '';
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          let imgBuf = await fsPromises.readFile(path.join(tmpDir, pageFiles[i]));
          if (imgBuf.length > MAX_OCR_IMAGE_BYTES) {
            imgBuf = Buffer.from(await sharp(imgBuf).resize(MAX_OCR_IMAGE_DIMENSION, MAX_OCR_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer());
          }
          const dataUrl = `data:image/jpeg;base64,${imgBuf.toString('base64')}`;
          const text = await aiQueue.enqueue(
            () => callAIVision([{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                {
                  type: 'text',
                  text: `You are reading page ${i + 1} of a CV/resume document. Extract ALL text exactly as it appears, preserving the document structure and formatting.

CRITICAL INSTRUCTIONS:
- Extract text in reading order (top to bottom, left to right)
- Preserve section headers (e.g., "EXPERIENCE", "EDUCATION", "SKILLS")
- Keep bullet points and job descriptions together
- Maintain line breaks between sections
- Do NOT add boxes, borders, or formatting characters
- Do NOT add any commentary or explanations
- Return ONLY the extracted text

If the page is empty or contains only images, return: [empty page]`
                }
              ]
            }], 'glm-4v-flash', 30_000),
            'normal', 35_000
          );
          pageText = text?.trim() || '';
          console.log(`[extract-file] OCR page ${i + 1}/${pageFiles.length} OK (attempt ${attempt + 1})`);
          break;
        } catch (e) {
          console.warn(`[extract-file] OCR page ${i + 1} attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          else pageText = '';
        }
      }
      pageTexts.push(pageText);
    }

    const combined = pageTexts.filter(t => t && t !== '[empty page]').join('\n\n');
    if (!combined.trim()) throw new Error('Vision model could not extract any text from this PDF.');

    // Post-OCR cleanup: remove any box characters the model might have added
    const cleaned = combined
      .replace(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  } finally {
    try {
      const files = await fsPromises.readdir(tmpDir);
      await Promise.all(files.map(f => fsPromises.unlink(path.join(tmpDir, f))));
      await fsPromises.rmdir(tmpDir);
    } catch { /* best-effort */ }
  }
}

async function extractPdfTextWithOpenAI(buffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return '';

  let uploadedFileId: string | null = null;

  try {
    const uploadForm = new FormData();
    uploadForm.append('purpose', 'user_data');
    uploadForm.append('file', new Blob([Buffer.from(buffer)], { type: 'application/pdf' }), 'cv.pdf');

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      console.warn('[extract-file] OpenAI file upload error:', await uploadRes.text());
      return '';
    }

    const uploaded = await uploadRes.json();
    uploadedFileId = uploaded?.id || null;
    if (!uploadedFileId) {
      console.warn('[extract-file] OpenAI file upload did not return a file id.');
      return '';
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file_id: uploadedFileId,
              },
              {
                type: 'input_text',
                text: 'Extract all readable text from this CV/resume PDF in natural reading order. Return plain text only with line breaks between sections. No markdown, no commentary.',
              },
            ],
          },
        ],
        max_output_tokens: 4000,
      }),
    });

    if (!res.ok) {
      console.warn('[extract-file] OpenAI PDF OCR error:', await res.text());
      return '';
    }

    const data = await res.json();
    const text = (data?.output_text || '').trim();
    if (text) return text;

    // Fallback parser for responses payload shapes without output_text.
    const fragments: string[] = [];
    const output = Array.isArray(data?.output) ? data.output : [];
    for (const item of output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const part of content) {
        if (typeof part?.text === 'string') {
          fragments.push(part.text);
        }
      }
    }

    return fragments.join('\n').trim();
  } catch (err) {
    console.warn('[extract-file] OpenAI PDF OCR failed:', err instanceof Error ? err.message : err);
    return '';
  } finally {
    if (uploadedFileId) {
      try {
        await fetch(`https://api.openai.com/v1/files/${uploadedFileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
      } catch (cleanupErr) {
        console.warn('[extract-file] OpenAI file cleanup failed:', cleanupErr instanceof Error ? cleanupErr.message : cleanupErr);
      }
    }
  }
}

// =============================================================================
// Image OCR via VLM
// =============================================================================

async function compressImageForOCR(buffer: ArrayBuffer): Promise<Buffer> {
  const input = Buffer.from(buffer);
  let quality = 80;
  let output = await sharp(input).resize(MAX_OCR_IMAGE_DIMENSION, MAX_OCR_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  while (output.length > MAX_OCR_IMAGE_BYTES && quality > 30) {
    quality -= 10;
    output = await sharp(input).resize(MAX_OCR_IMAGE_DIMENSION, MAX_OCR_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  }
  return output;
}

async function extractTextFromImage(buffer: ArrayBuffer): Promise<string> {
  const compressed = await compressImageForOCR(buffer);
  const dataUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
  let lastErr: Error | null = null;

  // Try up to 2 times with improved prompts
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const text = await aiQueue.enqueue(
        () => callAIVision([{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            {
              type: 'text',
              text: `Extract ALL text from this document image exactly as it appears, preserving the document structure.

CRITICAL INSTRUCTIONS:
- Read text in natural order (top to bottom, left to right)
- Preserve section headers exactly (e.g., "WORK EXPERIENCE", "EDUCATION", "SKILLS", "SUMMARY", "RESPONSIBILITIES", "QUALIFICATIONS")
- Keep job titles, company names, and dates together
- Maintain bullet points and descriptions under their respective positions
- Include all contact information (email, phone, LinkedIn, GitHub, etc.)
- Preserve line breaks between sections
- Do NOT add boxes, borders, tables, or any formatting characters like │ ─ ┼ ║ ═
- Do NOT add explanations or commentary
- Return ONLY the extracted text as plain text

If you cannot read any text, return: [unable to read]`
            }
          ]
        }], 'glm-4v-flash', 10_000),
        'normal', 12_000
      );
      if (text && text.trim() && !text.includes('[unable to read]')) return text;
      lastErr = new Error('Vision model returned no usable text.');
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`[extract-file] Image OCR attempt ${attempt + 1} failed:`, lastErr.message);
      // Wait before retry
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr || new Error('Vision model could not extract readable text from the image.');
}

// =============================================================================
// Utility helpers
// =============================================================================

function getExt(filename: string): string {
  const d = filename.lastIndexOf('.');
  return d >= 0 ? filename.substring(d).toLowerCase() : '';
}

type FileType = 'pdf' | 'txt' | 'image' | 'docx' | 'unknown';
function categorizeType(ext: string): FileType {
  switch (ext) {
    case '.pdf': return 'pdf';
    case '.txt': return 'txt';
    case '.docx': return 'docx';
    case '.png': case '.jpg': case '.jpeg': case '.webp': return 'image';
    default: return 'unknown';
  }
}

function detectLanguage(text: string): string {
  const s = text.substring(0, 2000); const l = s.length; if (l === 0) return 'en';
  if ((s.match(/[\u4e00-\u9fff]/g) || []).length / l > 0.1) return 'zh';
  if (((s.match(/[\u3040-\u30ff]/g) || []).length + (s.match(/[\u4e00-\u9fff]/g) || []).length) / l > 0.1) return 'ja';
  if ((s.match(/[\uac00-\ud7af]/g) || []).length / l > 0.1) return 'ko';
  if ((s.match(/[\u0600-\u06ff]/g) || []).length / l > 0.05) return 'ar';
  if ((s.match(/[\u0400-\u04ff]/g) || []).length / l > 0.1) return 'ru';
  return 'en';
}

function calcConfidence(text: string, method: 'native' | 'ocr' | 'direct'): number {
  let c = method === 'ocr' ? 65 : method === 'direct' ? 95 : 80;
  const wc = text.split(/\s+/).filter(w => w).length;
  if (wc > 200) c += 5; if (wc > 500) c += 5;
  if (/[\w.-]+@[\w.-]+\.\w{2,}/.test(text)) c += 3;
  if (/(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) c += 3;
  // Heavily penalize box drawing characters (indicates poor OCR)
  const boxChars = (text.match(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g) || []).length;
  if (boxChars > 0) c -= Math.min(30, boxChars * 2); // Penalty up to -30
  return Math.max(0, Math.min(100, c));
}

// =============================================================================
// Quality Report Builder
// =============================================================================

interface QualityReport {
  hasEmail: boolean;
  hasPhone: boolean;
  hasEducation: boolean;
  hasExperience: boolean;
  hasSkills: boolean;
  hasProjects: boolean;
  wordCount: number;
  characterCount: number;
  sectionCount: number;
  missingSections: string[];
  qualityScore: number;
  suggestions: string[];
}

function buildQualityReport(text: string): QualityReport {
  const t = text.trim();

  const hasEmail = /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/.test(t);
  // Match phone numbers with at least 7 digits (allowing separators like spaces, dashes, parens)
  const hasPhone = /\+?[\d][\d\s().-]*[\d]/.test(t) && (t.match(/\d/g) || []).length >= 7;
  const hasEducation = /\b(education|degree|bachelor|master|phd|diploma|university|college|school|studied)\b/i.test(t);
  const hasExperience = /\b(experience|work|employment|career|job|position|role|company|employer)\b/i.test(t);
  const hasSkills = /\b(skills|technologies|tools|languages|frameworks|competencies|expertise)\b/i.test(t);
  const hasProjects = /\b(projects?|portfolio|github|repository|built|developed|created)\b/i.test(t);

  const words = t.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const characterCount = t.length;

  // Count distinct section headers (ALL-CAPS lines or common CV section keywords)
  // Capped at MAX_SECTION_COUNT to avoid inflating score from decorative caps text
  const MAX_SECTION_COUNT = 12;
  const lines = t.split('\n');
  const sectionHeaderRe = /^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|PROFILE|OBJECTIVE|CERTIFICATIONS|LANGUAGES|REFERENCES|WORK|EMPLOYMENT|ACHIEVEMENTS|AWARDS|PUBLICATIONS|INTERESTS|HOBBIES|CONTACT|PERSONAL)\b/i;
  const capsHeaderRe = /^[A-Z][A-Z\s]{3,}$/;
  const sectionLines = lines.filter(l => sectionHeaderRe.test(l.trim()) || capsHeaderRe.test(l.trim()));
  const sectionCount = Math.min(sectionLines.length, MAX_SECTION_COUNT);

  // Determine missing critical sections
  const missingSections: string[] = [];
  if (!hasEmail) missingSections.push('email');
  if (!hasPhone) missingSections.push('phone');
  if (!hasExperience) missingSections.push('experience');
  if (!hasEducation) missingSections.push('education');
  if (!hasSkills) missingSections.push('skills');

  // Compute quality score (0–100)
  let score = 0;
  if (hasEmail) score += 15;
  if (hasPhone) score += 10;
  if (hasExperience) score += 20;
  if (hasEducation) score += 20;
  if (hasSkills) score += 15;
  if (hasProjects) score += 5;
  if (wordCount >= 150) score += 5;
  if (wordCount >= 300) score += 5;
  if (sectionCount >= 3) score += 5;

  // Build suggestions
  const suggestions: string[] = [];
  if (!hasEmail) suggestions.push('Missing email address — add contact email for recruiter visibility.');
  if (!hasPhone) suggestions.push('Missing phone number — include a contact number to improve reachability.');
  if (!hasExperience) suggestions.push('Work experience section not detected — ensure it is clearly labelled.');
  if (!hasEducation) suggestions.push('Education section not detected — add your academic background.');
  if (!hasSkills) suggestions.push('Skills section not detected — list your technical and soft skills.');
  if (!hasProjects) suggestions.push('Consider adding a projects section to showcase your practical work.');
  if (wordCount < 150) suggestions.push('CV text seems short — a detailed CV (150+ words) improves matching accuracy.');

  return {
    hasEmail,
    hasPhone,
    hasEducation,
    hasExperience,
    hasSkills,
    hasProjects,
    wordCount,
    characterCount,
    sectionCount,
    missingSections,
    qualityScore: Math.min(100, score),
    suggestions,
  };
}

// =============================================================================
// LLM CV Parsing with Retry
// =============================================================================

interface ParseResult { parsedCv: ParsedCV; usedModel: string; responseText: string; }

async function parseCvWithRetry(cvText: string): Promise<ParseResult> {
  const truncText = cvText.length > MAX_TEXT_FOR_LLM ? cvText.substring(0, MAX_TEXT_FOR_LLM) : cvText;

  const retryModels = [
    'glm-4-flash',
    'gpt-4o-mini',
    'claude-haiku-4-20250414',
    'gemini-2.5-flash',
    'glm-4-plus',
  ] as const;

  // --- Attempt parsing with provider-aware fallbacks ---
  for (let attempt = 0; attempt < retryModels.length; attempt++) {
    const model = retryModels[attempt];
    console.log(`[extract-file] LLM parse attempt ${attempt + 1}/${retryModels.length} using ${model}`);

    try {
      const aiResult = await aiQueue.enqueue(
        () => callAIWithFallback(
          [
            { role: 'system', content: CV_PARSE_SYSTEM_PROMPT },
            { role: 'user', content: truncText },
          ],
          model
        ),
        'high',
        20_000
      );

      const responseText = aiResult.content;
      const usedModel = aiResult.model;

      if (!responseText) {
        console.warn(`[extract-file] LLM returned null on attempt ${attempt + 1}`);
        continue;
      }

      // Try to extract and parse JSON
      const rawJson = extractJSON(responseText);
      if (rawJson) {
        try {
          const fixed = fixJSONIssues(rawJson);
          const parsedCv = validateAndNormalize(JSON.parse(fixed));
          console.log(`[extract-file] LLM parse succeeded on attempt ${attempt + 1} with ${usedModel}`);
          return { parsedCv, usedModel, responseText };
        } catch (parseErr) {
          console.warn(`[extract-file] JSON parse failed on attempt ${attempt + 1}:`, parseErr instanceof Error ? parseErr.message : parseErr);
        }
      } else {
        console.warn(`[extract-file] No JSON found in LLM response on attempt ${attempt + 1}`);
      }

      // On attempt 0, try a stricter prompt retry immediately
      if (attempt === 0) {
        console.log('[extract-file] Trying stricter prompt retry...');
        try {
          const strictResponse = await aiQueue.enqueue(
            () => callAIWithFallback(
              [
                { role: 'system', content: 'You are a CV parser. Return ONLY valid JSON. Never leave fullName, email, or phone empty if they exist.' },
                { role: 'user', content: `You MUST extract information from this CV into EXACTLY this JSON structure. Do NOT leave fullName, email, or phone empty if they exist. Return ONLY the JSON.\n\n${CV_PARSE_SYSTEM_PROMPT}\n\nCV TEXT:\n${truncText}` },
              ],
              'glm-4-plus'
            ),
            'high',
            20_000
          );
          if (strictResponse?.content) {
            const rawJson2 = extractJSON(strictResponse.content);
            if (rawJson2) {
              try {
                const fixed2 = fixJSONIssues(rawJson2);
                const parsedCv = validateAndNormalize(JSON.parse(fixed2));
                console.log(`[extract-file] Strict prompt retry succeeded with ${strictResponse.model}`);
                return { parsedCv, usedModel: strictResponse.model, responseText: strictResponse.content };
              } catch { /* continue to next attempt */ }
            }
          }
        } catch { /* continue */ }
      }
    } catch (err) {
      console.warn(`[extract-file] LLM call error on attempt ${attempt + 1}:`, err instanceof Error ? err.message : err);
    }

    if (attempt < retryModels.length - 1) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error('Failed to parse CV data after multiple attempts. Please try again or paste your CV text directly.');
}

// =============================================================================
// POST Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const requestStart = Date.now();

  // --- AbortController for overall timeout ---
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // --- 1. Rate limit check ---
    const ip = resolveClientIp(request);
    const { allowed, retryAfter } = checkRateLimit(ip, 'file-upload');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Too many upload requests. Please wait ${retryAfter} seconds before trying again.` },
        { status: 429 }
      );
    }

    // --- 2. Parse FormData ---
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formErr) {
      console.error('[extract-file] Failed to parse multipart form data:', formErr);
      return NextResponse.json({ success: false, error: 'Failed to read uploaded file payload. Please retry the upload.' }, { status: 400 });
    }
    const fastMode = request.nextUrl.searchParams.get('fast') === '1' || formData.get('fast') === '1';
    const shouldParse = request.nextUrl.searchParams.get('parse') === '1' || formData.get('parse') === '1';
    const file = formData.get('file');
    console.log('[extract-file] Request received, file:', file instanceof File ? `${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})` : 'NOT a File');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided. Use the "file" field in FormData.' }, { status: 400 });
    }

    // --- 3. Validate file ---
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max: ${MAX_FILE_SIZE / (1024 * 1024)} MB.` }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: 'Uploaded file is empty.' }, { status: 400 });
    }

    const ext = getExt(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ success: false, error: `Unsupported extension "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 });
    }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      // Allow if extension matches (some browsers send wrong MIME)
      console.warn(`[extract-file] Unexpected MIME type "${file.type}" for "${file.name}", proceeding based on extension.`);
    }

    const fileBuffer = await file.arrayBuffer();

    // --- 4. Check extraction cache ---
    let cacheKey: string | null = null;
    if (fileBuffer.byteLength <= 5 * 1024 * 1024) {
      const header = new Uint8Array(fileBuffer, 0, Math.min(4096, fileBuffer.byteLength));
      const footerStart = Math.max(0, fileBuffer.byteLength - 4096);
      const footer = new Uint8Array(fileBuffer, footerStart, Math.min(4096, fileBuffer.byteLength - footerStart));
      cacheKey = hashContent(`${file.name}:${fileBuffer.byteLength}:${Buffer.from(header).toString('hex')}:${Buffer.from(footer).toString('hex')}`);
      const cached = extractionCache.get(cacheKey);
      if (cached) {
        console.log('[extract-file] Cache hit for:', file.name);
        return NextResponse.json({ ...(cached as Record<string, unknown>), cached: true });
      }
    }

    // --- 5. Extract text based on file type ---
    const fileType = categorizeType(ext);
    let extractedText = '';
    let warning: string | undefined;
    let extractionMethod: 'native' | 'ocr' | 'direct' = 'native';

    switch (fileType) {
      case 'txt': {
        extractedText = new TextDecoder().decode(fileBuffer);
        extractionMethod = 'direct';
        break;
      }

      case 'docx': {
        const buf = Buffer.from(fileBuffer);
        const result = await mammoth.extractRawText({ buffer: buf });
        extractedText = result.value;
        if (!extractedText.trim()) {
          return NextResponse.json({ success: false, error: 'Could not extract text from this DOCX. The file may be empty or corrupted.' }, { status: 422 });
        }
        extractionMethod = 'native';
        break;
      }

      case 'pdf': {
        const t0 = Date.now();
        let pageCount = 0;

        // Step A: Try native text extraction
        try {
          const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
          extractedText = await extractTextFromPDF(fileBuffer);
          console.log(`[extract-file] Native PDF extraction: ${extractedText.trim().length} chars in ${Date.now() - t0}ms`);
        } catch (e) {
          console.error('[extract-file] Native PDF extraction error:', e);
        }

        // Step B: Check if OCR is needed
        const nativeLen = extractedText.trim().length;
        const readability = textReadabilityScore(extractedText);
        const nonAscii = (extractedText.match(/[^\x00-\x7F]/g) || []).length;
        const nonAsciiRatio = nonAscii / Math.max(1, extractedText.length);
        const cvSignal = hasCvSignal(extractedText);
        const garbledMarkers = (extractedText.match(/[�□■▢▣◻◼]/g) || []).length;
        const garbledRatio = garbledMarkers / Math.max(1, extractedText.length);
        const needsOcr =
          nativeLen < MIN_TEXT_LENGTH ||
          (nativeLen >= MIN_TEXT_LENGTH && readability < 0.2) ||
          (nativeLen >= MIN_TEXT_LENGTH && garbledRatio > 0.02) ||
          (nativeLen >= MIN_TEXT_LENGTH && !cvSignal && nonAsciiRatio > 0.25);
        console.log(`[extract-file] PDF readability: ${readability.toFixed(3)}, textLen: ${nativeLen}, needsOcr: ${needsOcr}`);

        if (needsOcr && !fastMode) {
          console.warn(`[extract-file] PDF text extraction insufficient (${nativeLen} chars, readability ${readability.toFixed(2)}), using VLM OCR...`);
          const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
          const openAiPdfText = await extractPdfTextWithOpenAI(fileBuffer);
          if (openAiPdfText.trim().length >= MIN_TEXT_LENGTH) {
            extractedText = openAiPdfText;
            warning = 'Text was extracted via AI PDF OCR. Please review for accuracy.';
            extractionMethod = 'ocr';
            console.log(`[extract-file] OpenAI PDF OCR fallback: ${extractedText.trim().length} chars in ${Date.now() - t0}ms total`);
            break;
          }

          try {
            extractedText = await ocrFallbackForPDF(fileBuffer, pageCount || 1);
            warning = 'Text was extracted using AI-powered OCR. Please review for accuracy.';
            extractionMethod = 'ocr';
            console.log(`[extract-file] OCR fallback: ${extractedText.trim().length} chars in ${Date.now() - t0}ms total`);
          } catch (_ocrErr) {
            console.error('[extract-file] OCR fallback failed:', _ocrErr instanceof Error ? _ocrErr.message : _ocrErr);
            if (nativeLen < MIN_PDF_NATIVE_FALLBACK_LEN) {
              const missingOcrProviderHint = hasOpenAI
                ? ''
                : ' Scanned-PDF OCR requires OPENAI_API_KEY in deployment environment.';
              return NextResponse.json({
                success: false,
                error: `Could not extract text from this PDF. It may contain scanned images. Try: 1) Upload as PNG/JPG image, 2) Paste text directly, 3) Re-export as text PDF.${missingOcrProviderHint}`,
              }, { status: 422 });
            }
            warning = 'OCR fallback was unavailable. Proceeding with native extraction; please review text quality before parsing.';
          }
        } else if (needsOcr && fastMode) {
          warning = 'Fast mode skipped OCR to return quickly. If text looks incomplete, paste text directly or retry with a cleaner PDF.';
        }
        break;
      }

      case 'image': {
        try {
          extractedText = await extractTextFromImage(fileBuffer);
          warning = 'Text was extracted using AI-powered OCR. Please review for accuracy.';
          extractionMethod = 'ocr';
        } catch (ocrErr) {
          return NextResponse.json({
            success: false,
            error: `Failed to read text from image. ${ocrErr instanceof Error ? ocrErr.message : ''} Ensure the image is clear or paste text directly.`,
          }, { status: 422 });
        }
        break;
      }

      default: {
        return NextResponse.json({ success: false, error: `Unsupported file type "${ext}".` }, { status: 400 });
      }
    }

    extractedText = normalizeExtractedText(extractedText);

    // --- 6. Validate extracted text ---
    const validation = validateExtractedText(extractedText);
    if (!validation.valid) {
      const canProceedWithWarning =
        fileType === 'pdf' &&
        extractedText.trim().length >= MIN_PDF_NATIVE_FALLBACK_LEN;

      if (!canProceedWithWarning) {
        return NextResponse.json({ success: false, error: validation.reason }, { status: 422 });
      }

      warning = warning || 'Text quality appears low, but extraction returned usable content. Please review before final download.';
      console.warn('[extract-file] Proceeding despite low validation confidence for PDF:', validation.reason);
    }

    // --- 7. Parse extracted text via LLM → structured CV data ---
    let parsedCv: ParsedCV | null = null;
    let usedModel = '';
    let llmError: string | undefined;

    if (shouldParse) {
      try {
        const parseResult = await parseCvWithRetry(extractedText);
        parsedCv = sanitizeParsedCV(parseResult.parsedCv);
        usedModel = parseResult.usedModel;
      } catch (err) {
        llmError = err instanceof Error ? err.message : 'LLM parsing failed';
        console.error('[extract-file] LLM parsing failed:', llmError);
      }
    }

    // --- 8. Build response ---
    const qualityReport = buildQualityReport(extractedText);
    const response: Record<string, unknown> = {
      success: true,
      text: extractedText,
      fileType,
      fileName: file.name,
      extractionMethod,
      confidence: calcConfidence(extractedText, extractionMethod),
      detectedLanguage: detectLanguage(extractedText),
      qualityReport,
    };

    if (warning) response.warning = warning;
    if (parsedCv) {
      response.data = parsedCv;
      response.model = usedModel;
    } else if (shouldParse) {
      response.parseError = llmError || 'CV parsing failed';
      response.partialSuccess = true;
    }

    // --- 9. Cache result ---
    if (cacheKey) extractionCache.set(cacheKey, response);

    console.log(`[extract-file] Total request time: ${Date.now() - requestStart}ms, model: ${usedModel || 'none'}, parsed: ${!!parsedCv}`);

    return NextResponse.json(response);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'Request timed out. The file may be too large or complex. Try a smaller file or paste your CV text directly.' }, { status: 504 });
    }

    console.error('[extract-file] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    clearTimeout(timeoutTimer);
  }
}
