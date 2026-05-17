/**
 * extract-file/route.ts — Upload CV File → Extract Text → Parse to Structured CV Data
 *
 * Speed optimisations in this version:
 *  • PDF path: native extraction + OpenAI OCR preflight fire in PARALLEL (Promise.race)
 *    instead of sequential try→fail→try.
 *  • parseCvWithRetry: uses callAIRace (parallel model race) instead of a sequential
 *    model loop with blocking sleep() delays between attempts.
 *  • Removed all await new Promise(r => setTimeout(r, N)) delays inside retry loops.
 *  • Built-in regex fallback (parseBuiltIn) runs immediately if every AI call fails,
 *    so the endpoint never times out entirely.
 *  • ?fast=1 query param skips OCR and goes straight to the built-in parser for
 *    instant (< 1 s) previews while the full parse loads in the background.
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

import { aiQueue } from '@/lib/request-queue';
import { extractionCache, hashContent } from '@/lib/response-cache';
import { callAIRaceForTask, callAIVision, hasAnyProviderCredentials } from '@/lib/ai-provider';
import { checkRateLimit, resolveClientIp } from '@/lib/rate-limit';
import { CV_PARSE_SYSTEM_PROMPT, type ParsedCV } from '@/lib/cv-types';
import { sanitizeGeneratedText, sanitizeParsedCV } from '@/lib/text-cleaning';
import { extractJSON, fixCommonJSONIssues } from '@/lib/json-utils';

// =============================================================================
// Constants
// =============================================================================

const ALLOWED_MIME_TYPES = [
  'application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.docx'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_TEXT_LENGTH = 20;
const MAX_TEXT_FOR_LLM = 12_000;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_OCR_IMAGE_DIMENSION = 1024;
const MAX_OCR_IMAGE_BYTES = 50_000;
const MIN_PDF_NATIVE_FALLBACK_LEN = MIN_TEXT_LENGTH;

// =============================================================================
// Text Quality Helpers
// =============================================================================

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
  const enRe = /\b(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|has|have|from|with|that|this|will|been|each|make|like|long|look|many|some|them|than|call|come|made|find|back|only|also|new|just|over|such|take|year|your|good|work|first|well|way|even|experience|education|skills|university|company|developer|manager|engineer|project|team)\b/i;
  const zhRe = /的|了|是|在|我|有|和|人|这|中|大|为|上|个|国|不|到|说|时|会|出|对|也|可|能|学|工|经|验|技|能|项|目|发|展|管|理|教|育|专|业/;
  const euRe = /\b(le|la|les|de|des|et|est|un|une|pour|dans|par|sur|avec|der|die|das|und|ist|ein|eine|für|mit|auf|von|sich|nicht|los|las|y|que|por|con|para)\b/i;
  const arRe = /في|من|على|إلى|عن|مع|هذا|هذه|التي|الذي|كان|قد|لا|أن|إذا|ما|كل|بعد|بين|حتى|عند|أو/;
  const commonWordCount = Math.max(
    (trimmed.match(enRe) || []).length, (trimmed.match(zhRe) || []).length,
    (trimmed.match(euRe) || []).length, (trimmed.match(arRe) || []).length,
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
    .replace(/[\uFFFD\u0000]/g, '')
    .replace(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasCvSignal(text: string): boolean {
  return /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}|\b(experience|education|skills|projects|linkedin|github|summary|profile|work)\b/i.test(text);
}

function validateExtractedText(text: string): { valid: boolean; reason?: string } {
  const trimmed = normalizeExtractedText(text);
  if (trimmed.length === 0)              return { valid: false, reason: 'Extracted text is empty.' };
  if (trimmed.length < MIN_TEXT_LENGTH)  return { valid: false, reason: `Extracted text is too short (${trimmed.length} chars).` };
  const readability = textReadabilityScore(trimmed);
  if (readability < 0.12)                return { valid: false, reason: 'Extracted text appears garbled or unreadable.' };
  if (readability < 0.2 && !hasCvSignal(trimmed)) return { valid: false, reason: 'Extracted text appears garbled or unreadable.' };
  const controlChars = (trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  if (controlChars / trimmed.length > 0.05) return { valid: false, reason: 'Extracted text contains too many control characters.' };
  return { valid: true };
}

// =============================================================================
// JSON Extraction / Repair — shared utils imported from @/lib/json-utils
// =============================================================================

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
      fullName:  String(pi.fullName  || ''),
      location:  String(pi.location  || ''),
      email:     String(pi.email     || ''),
      phone:     String(pi.phone     || ''),
      linkedin:  String(pi.linkedin  || ''),
      github:    String(pi.github    || ''),
      website:   String(pi.website   || ''),
    },
    personalStatement:
      typeof data.personalStatement === 'string' ? data.personalStatement
      : typeof data.summary === 'string' ? data.summary
      : typeof data.objective === 'string' ? data.objective
      : typeof data.profile  === 'string' ? data.profile : '',
    projects:        Array.isArray(data.projects)       ? data.projects.filter((p: unknown)       => p && typeof p === 'object') : [],
    workExperience:  Array.isArray(data.workExperience) ? data.workExperience.filter((w: unknown)  => w && typeof w === 'object')
                   : Array.isArray(data.experience)     ? data.experience.filter((w: unknown)      => w && typeof w === 'object')
                   : Array.isArray(data.work_experience)? data.work_experience.filter((w: unknown) => w && typeof w === 'object') : [],
    education:       Array.isArray(data.education)      ? data.education.filter((e: unknown)       => e && typeof e === 'object') : [],
    skills:          Array.isArray(data.skills)         ? data.skills.filter((s: unknown)          => s && typeof s === 'object') : [],
    certifications:  Array.isArray(data.certifications) ? data.certifications.filter((c: unknown)  => c && typeof c === 'object') : [],
  };
}

// =============================================================================
// Built-in fast regex parser (instant — no AI needed)
// =============================================================================

function pickFirstMatch(text: string, re: RegExp): string { return text.match(re)?.[0]?.trim() || ''; }
function cleanLine(line: string): string { return line.replace(/^[\s\-•*]+/, '').trim(); }

function parseSectionBlocks(cvText: string): Record<string, string[]> {
  const lines = cvText.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  const sectionMap: Record<string, string[]> = { header:[], summary:[], experience:[], education:[], skills:[], projects:[], certifications:[] };
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
    const h = headingToKey.find(h => h.re.test(line));
    if (h) { current = h.key; continue; }
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
  const fullName = topLines.find(line => {
    if (line.length < 3 || line.length > 60) return false;
    if (/@|https?:\/\//i.test(line)) return false;
    if (/\d{3,}/.test(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5;
  }) || '';
  const location = topLines.find(line => !/@|https?:\/\//i.test(line) && !/\d{3,}/.test(line) && /,/.test(line)) || '';
  const personalStatement = sections.summary.slice(0, 4).join(' ').trim();
  const skillTokens = sections.skills.join(' | ').split(/[|,•]/).map(s => cleanLine(s)).filter(s => s.length > 1).slice(0, 40);
  const skills = skillTokens.length ? [{ category: 'Core Skills', skills: skillTokens.join(', ') }] : [];
  const workExperience: ParsedCV['workExperience'] = [];
  let currentWork: ParsedCV['workExperience'][number] | null = null;
  for (const rawLine of sections.experience) {
    const line = rawLine.trim(); if (!line) continue;
    const isBullet = /^[-•*]\s+/.test(rawLine);
    const hasDate  = /(20\d{2}|19\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
    if (!currentWork || (!isBullet && hasDate && currentWork.title)) {
      if (currentWork) workExperience.push(currentWork);
      currentWork = { dateRange: hasDate ? line : '', title: hasDate ? '' : cleanLine(line), subtitle: '', bullets: [] };
      continue;
    }
    if (isBullet) currentWork.bullets.push(cleanLine(rawLine));
    else if (!currentWork.title) currentWork.title = cleanLine(line);
    else if (!currentWork.subtitle) currentWork.subtitle = cleanLine(line);
    else currentWork.bullets.push(cleanLine(line));
  }
  if (currentWork) workExperience.push(currentWork);
  const education: ParsedCV['education'] = sections.education.filter(Boolean).slice(0, 6).map(line => ({
    dateRange: pickFirstMatch(line, /(20\d{2}|19\d{2})(\s*[-–]\s*(20\d{2}|19\d{2}|present|current))?/i),
    degree: cleanLine(line), institution: '',
  }));
  const projects: ParsedCV['projects'] = sections.projects.filter(Boolean).slice(0, 8).map(line => ({
    category: 'Project', title: cleanLine(line).slice(0, 80), description: cleanLine(line),
  }));
  const certifications: ParsedCV['certifications'] = sections.certifications.filter(Boolean).slice(0, 10).map(line => ({ name: cleanLine(line) }));
  return sanitizeParsedCV({ personalInfo: { fullName, location, email, phone, linkedin, github, website }, personalStatement, projects, workExperience, education, skills, certifications });
}

// =============================================================================
// PDF Text Extraction
// =============================================================================

function decodePDFString(raw: string): string {
  let result = '', i = 0;
  while (i < raw.length) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const next = raw[i+1];
      switch (next) {
        case 'n': result += '\n'; i += 2; break; case 'r': result += '\r'; i += 2; break;
        case 't': result += '\t'; i += 2; break; case 'f': result += '\f'; i += 2; break;
        case '(': result += '(';  i += 2; break; case ')': result += ')';  i += 2; break;
        case '\\': result += '\\'; i += 2; break;
        default:
          if (next >= '0' && next <= '7') {
            let octal = '';
            for (let j = 1; j <= 3 && i+j < raw.length && raw[i+j] >= '0' && raw[i+j] <= '7'; j++) octal += raw[i+j];
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
    const byte = parseInt(hex.substring(i, i+2), 16);
    if (!isNaN(byte) && byte > 0) result += String.fromCharCode(byte);
  }
  return result;
}

function parsePDFString(content: string, pos: number): { text: string; endPos: number } | null {
  if (pos >= content.length) return null;
  if (content[pos] === '(') {
    let depth = 1, i = pos + 1, raw = '';
    while (i < content.length && depth > 0) {
      if (content[i] === '\\') { raw += content[i]; if (i+1 < content.length) { raw += content[i+1]; i += 2; } else i++; }
      else if (content[i] === '(') { depth++; raw += '('; i++; }
      else if (content[i] === ')') { depth--; if (depth > 0) raw += ')'; i++; }
      else { raw += content[i]; i++; }
    }
    return { text: decodePDFString(raw), endPos: i };
  }
  if (content[pos] === '<') {
    const end = content.indexOf('>', pos + 1);
    if (end === -1) return null;
    return { text: decodeHexPDFString(content.substring(pos+1, end)), endPos: end + 1 };
  }
  return null;
}

function parseNum(content: string, pos: number): { value: number; endPos: number } | null {
  const m = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(content.substring(pos));
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
    if (ch === '(' || ch === '<') { const p = parsePDFString(content, pos); if (p) { stack.push(p.text); pos = p.endPos; continue; } }
    if (ch === '[') {
      let depth = 1, i = pos + 1; const items: (string | number)[] = [];
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
    if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9') || ch === '.') { const n = parseNum(content, pos); if (n) { stack.push(n.value); pos = n.endPos; continue; } }
    if (/[A-Za-z*]/.test(ch)) {
      const tok = readToken(content, pos);
      if (!tok) { pos++; continue; }
      pos = tok.endPos;
      switch (tok.token) {
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
        default: stack.length = 0; break;
      }
      continue;
    }
    pos++;
  }
  elements.sort((a, b) => { const yd = b.y - a.y; if (Math.abs(yd) > LT) return yd; return a.x - b.x; });
  const lines: string[] = []; let curLine = '', curY = NaN;
  for (const el of elements) {
    if (isNaN(curY) || Math.abs(el.y - curY) > 3) { if (curLine.trim()) lines.push(curLine.trim()); curLine = el.text; curY = el.y; }
    else curLine += ' ' + el.text;
  }
  if (curLine.trim()) lines.push(curLine.trim());
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim(); if (!t) continue;
    const isHeader = t === t.toUpperCase() && t.length >= 2 && t.length <= 60 && /[A-Z]/.test(t) && !/@\./.test(t);
    if (isHeader && result.length > 0 && result[result.length-1] !== '') result.push('');
    result.push(t);
  }
  return result.join('\n');
}

async function decompressStream(rawBytes: Uint8Array): Promise<Uint8Array> {
  if (rawBytes.length >= 2 && rawBytes[0] === 0x78) {
    try { return new Uint8Array(await inflateAsync(Buffer.from(rawBytes))); } catch { /* */ }
    try { return new Uint8Array(await inflateRawAsync(Buffer.from(rawBytes))); } catch { /* */ }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule: any = cjsRequire('pdf-parse');
    const pdfParseFn = typeof pdfParseModule === 'function' ? pdfParseModule
      : typeof pdfParseModule?.default === 'function' ? pdfParseModule.default : null;
    if (pdfParseFn) {
      const parsed = await pdfParseFn(Buffer.from(buffer));
      primaryText = (parsed?.text || '').trim();
    }
  } catch (e) {
    console.warn('[extract-file] pdf-parse failed:', e instanceof Error ? e.message : e);
  }
  if (primaryText.length >= MIN_TEXT_LENGTH) return primaryText;
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const ctx = pdfDoc.context;
    const fallbackTexts: string[] = [];
    for (const page of pdfDoc.getPages()) {
      const contentsEntry = page.node.get(PDFName.of('Contents'));
      if (!contentsEntry) continue;
      const refs: unknown[] = contentsEntry instanceof PDFArray
        ? Array.from({ length: contentsEntry.size() }, (_, i) => contentsEntry.get(i)).filter(Boolean)
        : [contentsEntry];
      for (const ref of refs) {
        try {
          const stream = ctx.lookup(ref as PDFRef);
          if (!stream) continue;
          const bytes = await resolveStreamBytes(stream, ctx);
          if (!bytes || bytes.length === 0) continue;
          const text = extractTextFromContentStream(bytes).trim();
          if (text) fallbackTexts.push(text);
        } catch { /* */ }
      }
    }
    return fallbackTexts.join('\n\n').trim() || primaryText;
  } catch { return primaryText; }
}

// =============================================================================
// PDF OCR Fallback — pdftoppm + VLM
// =============================================================================

async function ocrFallbackForPDF(buffer: ArrayBuffer, pageCount: number): Promise<string> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cv-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const prefix  = path.join(tmpDir, 'page');
  try {
    await fsPromises.writeFile(pdfPath, Buffer.from(buffer));
    const MAX_PAGES = 5;
    const pagesToProcess = Math.min(pageCount, MAX_PAGES);
    try {
      const cmd = pagesToProcess < pageCount
        ? `pdftoppm -png -r 100 -f 1 -l ${pagesToProcess} "${pdfPath}" "${prefix}"`
        : `pdftoppm -png -r 100 "${pdfPath}" "${prefix}"`;
      await execAsync(cmd, { timeout: 20000 });
    } catch (e) {
      throw new Error(`Failed to convert PDF to images: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
    const files = await fsPromises.readdir(tmpDir);
    const pageFiles = files.filter(f => f.startsWith('page') && f.endsWith('.png')).sort();
    if (pageFiles.length === 0) throw new Error('Could not convert PDF pages to images.');

    // Process all pages in parallel (up to 3 at once) for speed
    const pageTexts: string[] = new Array(pageFiles.length).fill('');
    const semaphore = 3;
    for (let start = 0; start < pageFiles.length; start += semaphore) {
      const batch = pageFiles.slice(start, start + semaphore);
      await Promise.all(batch.map(async (filename, batchIdx) => {
        const i = start + batchIdx;
        for (let attempt = 0; attempt <= 1; attempt++) {
          try {
            let imgBuf = await fsPromises.readFile(path.join(tmpDir, filename));
            if (imgBuf.length > MAX_OCR_IMAGE_BYTES) {
              imgBuf = Buffer.from(await sharp(imgBuf)
                .resize(MAX_OCR_IMAGE_DIMENSION, MAX_OCR_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 70 }).toBuffer());
            }
            const dataUrl = `data:image/jpeg;base64,${imgBuf.toString('base64')}`;
            const text = await aiQueue.enqueue(
              () => callAIVision([{ role: 'user', content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: `Extract ALL text from page ${i+1} of this CV in reading order. Return plain text only. No commentary.` },
              ] }], 'glm-4v-flash', 30_000),
              'high', 35_000,
            );
            pageTexts[i] = text?.trim() || '';
            break;
          } catch (e) {
            console.warn(`[extract-file] OCR page ${i+1} attempt ${attempt+1} failed:`, e instanceof Error ? e.message : e);
            // No sleep — just retry immediately
          }
        }
      }));
    }
    const combined = pageTexts.filter(t => t && t !== '[empty page]').join('\n\n');
    if (!combined.trim()) throw new Error('Vision model could not extract any text from this PDF.');
    return combined
      .replace(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g, ' ')
      .replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    try {
      const files = await fsPromises.readdir(tmpDir);
      await Promise.all(files.map(f => fsPromises.unlink(path.join(tmpDir, f))));
      await fsPromises.rmdir(tmpDir);
    } catch { /* */ }
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
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: uploadForm,
    });
    if (!uploadRes.ok) return '';
    const uploaded = await uploadRes.json();
    uploadedFileId = uploaded?.id || null;
    if (!uploadedFileId) return '';
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [{ role: 'user', content: [
          { type: 'input_file', file_id: uploadedFileId },
          { type: 'input_text', text: 'Extract all readable text from this CV/resume PDF in natural reading order. Return plain text only. No markdown.' },
        ] }],
        max_output_tokens: 4000,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const text = (data?.output_text || '').trim();
    if (text) return text;
    const fragments: string[] = [];
    for (const item of (Array.isArray(data?.output) ? data.output : [])) {
      for (const part of (Array.isArray(item?.content) ? item.content : [])) {
        if (typeof part?.text === 'string') fragments.push(part.text);
      }
    }
    return fragments.join('\n').trim();
  } catch { return ''; }
  finally {
    if (uploadedFileId) {
      fetch(`https://api.openai.com/v1/files/${uploadedFileId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => { /* cleanup, best-effort */ });
    }
  }
}

// =============================================================================
// Gemini inline-PDF OCR — no binary deps, works on Vercel Lambda
// Requires GOOGLE_AI_API_KEY. Gemini can read PDF bytes directly via inline_data.
// =============================================================================

async function extractPdfTextWithGemini(buffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return '';
  try {
    const base64Pdf = Buffer.from(buffer).toString('base64');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
              { text: 'Extract ALL text from this CV/resume PDF exactly as written, in natural reading order. Return plain text only — no markdown, no commentary, no reformatting.' },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(35_000),
      },
    );
    if (!res.ok) {
      console.warn('[extract-file] Gemini PDF OCR HTTP error:', res.status);
      return '';
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (e) {
    console.warn('[extract-file] Gemini PDF OCR error:', e instanceof Error ? e.message : e);
    return '';
  }
}

// =============================================================================
// Image OCR
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
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const text = await aiQueue.enqueue(
        () => callAIVision([{ role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: 'Extract ALL text from this CV document image exactly as it appears, in reading order. Return plain text only. No boxes, borders, or commentary.' },
        ] }], 'glm-4v-flash', 10_000),
        'high', 12_000,
      );
      if (text && text.trim() && !text.includes('[unable to read]')) return text;
    } catch (e) {
      console.warn(`[extract-file] Image OCR attempt ${attempt+1} failed:`, e instanceof Error ? e.message : e);
    }
  }
  throw new Error('Vision model could not extract readable text from the image.');
}

// =============================================================================
// Utilities
// =============================================================================

function getExt(filename: string): string { const d = filename.lastIndexOf('.'); return d >= 0 ? filename.substring(d).toLowerCase() : ''; }
type FileType = 'pdf' | 'txt' | 'image' | 'docx' | 'unknown';
function categorizeType(ext: string): FileType {
  switch (ext) { case '.pdf': return 'pdf'; case '.txt': return 'txt'; case '.docx': return 'docx'; case '.png': case '.jpg': case '.jpeg': case '.webp': return 'image'; default: return 'unknown'; }
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
function calcConfidence(text: string, method: 'native'|'ocr'|'direct'): number {
  let c = method === 'ocr' ? 65 : method === 'direct' ? 95 : 80;
  if (text.split(/\s+/).filter(w=>w).length > 200) c += 5;
  if (text.split(/\s+/).filter(w=>w).length > 500) c += 5;
  if (/[\w.-]+@[\w.-]+\.\w{2,}/.test(text)) c += 3;
  if (/(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) c += 3;
  const boxChars = (text.match(/[│┃┆┊┈┄┐┘└┌├┤┬┴┼╭╮╯╰╱╲═║╔╗╚╝╠╣╦╩╬╟╢╤╧╪╞╡╥╨╫┏┓┗┛┣┫┳┻╋▪▫]/g) || []).length;
  if (boxChars > 0) c -= Math.min(30, boxChars * 2);
  return Math.max(0, Math.min(100, c));
}

// =============================================================================
// Quality Report
// =============================================================================

interface QualityReport {
  hasEmail: boolean; hasPhone: boolean; hasEducation: boolean; hasExperience: boolean;
  hasSkills: boolean; hasProjects: boolean; wordCount: number; characterCount: number;
  sectionCount: number; missingSections: string[]; qualityScore: number; suggestions: string[];
}

function buildQualityReport(text: string): QualityReport {
  const t = text.trim();
  const hasEmail      = /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/.test(t);
  const hasPhone      = /\+?[\d][\d\s().-]*[\d]/.test(t) && (t.match(/\d/g) || []).length >= 7;
  const hasEducation  = /\b(education|degree|bachelor|master|phd|diploma|university|college|school|studied)\b/i.test(t);
  const hasExperience = /\b(experience|work|employment|career|job|position|role|company|employer)\b/i.test(t);
  const hasSkills     = /\b(skills|technologies|tools|languages|frameworks|competencies|expertise)\b/i.test(t);
  const hasProjects   = /\b(projects?|portfolio|github|repository|built|developed|created)\b/i.test(t);
  const words = t.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const MAX_SECTION_COUNT = 12;
  const sectionHeaderRe = /^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|PROFILE|OBJECTIVE|CERTIFICATIONS|LANGUAGES|REFERENCES|WORK|EMPLOYMENT|ACHIEVEMENTS|AWARDS|PUBLICATIONS|INTERESTS|CONTACT|PERSONAL)\b/i;
  const capsHeaderRe = /^[A-Z][A-Z\s]{3,}$/;
  const sectionCount = Math.min(t.split('\n').filter(l => sectionHeaderRe.test(l.trim()) || capsHeaderRe.test(l.trim())).length, MAX_SECTION_COUNT);
  const missingSections: string[] = [];
  if (!hasEmail)      missingSections.push('email');
  if (!hasPhone)      missingSections.push('phone');
  if (!hasExperience) missingSections.push('experience');
  if (!hasEducation)  missingSections.push('education');
  if (!hasSkills)     missingSections.push('skills');
  let score = 0;
  if (hasEmail) score += 15; if (hasPhone) score += 10; if (hasExperience) score += 20;
  if (hasEducation) score += 20; if (hasSkills) score += 15; if (hasProjects) score += 5;
  if (wordCount >= 150) score += 5; if (wordCount >= 300) score += 5; if (sectionCount >= 3) score += 5;
  const suggestions: string[] = [];
  if (!hasEmail)      suggestions.push('Missing email address.');
  if (!hasPhone)      suggestions.push('Missing phone number.');
  if (!hasExperience) suggestions.push('Work experience section not detected.');
  if (!hasEducation)  suggestions.push('Education section not detected.');
  if (!hasSkills)     suggestions.push('Skills section not detected.');
  if (!hasProjects)   suggestions.push('Consider adding a projects section.');
  if (wordCount < 150) suggestions.push('CV text seems short — aim for 150+ words.');
  return { hasEmail, hasPhone, hasEducation, hasExperience, hasSkills, hasProjects,
    wordCount, characterCount: t.length, sectionCount, missingSections,
    qualityScore: Math.min(100, score), suggestions };
}

// =============================================================================
// LLM CV Parsing — PARALLEL RACE (replaces slow sequential loop)
// =============================================================================

interface ParseResult { parsedCv: ParsedCV; usedModel: string; }

async function parseCvWithRetry(cvText: string): Promise<ParseResult> {
  const truncText = cvText.length > MAX_TEXT_FOR_LLM ? cvText.substring(0, MAX_TEXT_FOR_LLM) : cvText;

  if (!hasAnyProviderCredentials()) {
    return { parsedCv: parseBuiltIn(cvText), usedModel: 'builtin' };
  }

  const messages = [
    { role: 'system' as const, content: CV_PARSE_SYSTEM_PROMPT },
    { role: 'user'   as const, content: truncText },
  ];

  // OPTIMISATION: race 3 parse-optimised models in parallel — first valid JSON wins.
  try {
    const aiResult = await callAIRaceForTask('parse', messages, 3, 0.1);
    const rawJson = extractJSON(aiResult.content);
    if (rawJson) {
      try {
        const parsedCv = validateAndNormalize(JSON.parse(fixCommonJSONIssues(rawJson)));
        return { parsedCv: sanitizeParsedCV(parsedCv), usedModel: aiResult.model };
      } catch { /* fall through to retry */ }
    }
  } catch (e) {
    console.warn('[extract-file] callAIRaceForTask failed, falling back to built-in:', e instanceof Error ? e.message : e);
  }

  // Strict-prompt retry (single shot, no sleep)
  try {
    const retryResult = await callAIRaceForTask(
      'parse',
      [
        { role: 'system', content: 'You are a CV parser. Return ONLY valid raw JSON starting with {. No markdown.' },
        { role: 'user',   content: `Parse this CV:\n\n${truncText.substring(0, 8_000)}` },
      ],
      2, 0.1,
    );
    const rawJson2 = extractJSON(retryResult.content);
    if (rawJson2) {
      const parsedCv = validateAndNormalize(JSON.parse(fixCommonJSONIssues(rawJson2)));
      return { parsedCv: sanitizeParsedCV(parsedCv), usedModel: retryResult.model };
    }
  } catch { /* fall through */ }

  // Ultimate fallback: instant built-in regex parser (never fails)
  console.warn('[extract-file] All AI attempts failed — using built-in parser');
  return { parsedCv: parseBuiltIn(cvText), usedModel: 'builtin' };
}

// =============================================================================
// POST Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const ip = resolveClientIp(request);
    const { allowed, retryAfter } = checkRateLimit(ip, 'file-upload');
    if (!allowed) return NextResponse.json({ success: false, error: `Too many upload requests. Wait ${retryAfter}s.` }, { status: 429 });

    let formData: FormData;
    try { formData = await request.formData(); } catch {
      return NextResponse.json({ success: false, error: 'Failed to read uploaded file. Please retry.' }, { status: 400 });
    }

    // fast=1 → skip OCR, return built-in parse immediately for instant preview
    const fastMode   = request.nextUrl.searchParams.get('fast') === '1' || formData.get('fast') === '1';
    const shouldParse = request.nextUrl.searchParams.get('parse') === '1' || formData.get('parse') === '1';
    const file = formData.get('file');

    if (!file || !(file instanceof File)) return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ success: false, error: `File too large. Max ${MAX_FILE_SIZE / (1024*1024)} MB.` }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ success: false, error: 'Uploaded file is empty.' }, { status: 400 });

    const ext = getExt(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) return NextResponse.json({ success: false, error: `Unsupported extension "${ext}".` }, { status: 400 });
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) console.warn(`[extract-file] Unexpected MIME "${file.type}", proceeding by extension.`);

    const fileBuffer = await file.arrayBuffer();

    // Cache check
    let cacheKey: string | null = null;
    if (fileBuffer.byteLength <= 5 * 1024 * 1024) {
      const header = new Uint8Array(fileBuffer, 0, Math.min(4096, fileBuffer.byteLength));
      const footerStart = Math.max(0, fileBuffer.byteLength - 4096);
      const footer = new Uint8Array(fileBuffer, footerStart, Math.min(4096, fileBuffer.byteLength - footerStart));
      cacheKey = hashContent(`${file.name}:${fileBuffer.byteLength}:${Buffer.from(header).toString('hex')}:${Buffer.from(footer).toString('hex')}`);
      const cached = extractionCache.get(cacheKey);
      if (cached) { console.log('[extract-file] Cache hit:', file.name); return NextResponse.json({ ...(cached as Record<string,unknown>), cached: true }); }
    }

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
        const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
        extractedText = result.value;
        if (!extractedText.trim()) return NextResponse.json({ success: false, error: 'Could not extract text from DOCX.' }, { status: 422 });
        extractionMethod = 'native';
        break;
      }
      case 'pdf': {
        const t0 = Date.now();
        let pageCount = 0;

        // --- Step A: native extraction ---
        try {
          const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
          extractedText = await extractTextFromPDF(fileBuffer);
          console.log(`[extract-file] Native PDF: ${extractedText.trim().length} chars in ${Date.now()-t0}ms`);
        } catch (e) { console.error('[extract-file] Native PDF error:', e); }

        const nativeLen    = extractedText.trim().length;
        const readability  = textReadabilityScore(extractedText);
        const garbledRatio = (extractedText.match(/[\uFFFD□■▢▣◻◼]/g) || []).length / Math.max(1, extractedText.length);
        const needsOcr     = nativeLen < MIN_TEXT_LENGTH || readability < 0.2 || garbledRatio > 0.02;

        if (needsOcr && !fastMode) {
          // --- Step B: race OpenAI + Gemini (inline PDF) + pdftoppm — first valid winner ---
          console.warn(`[extract-file] Needs OCR (native=${nativeLen}c, readability=${readability.toFixed(2)}), racing 3 OCR methods...`);
          try {
            const ocrText = await Promise.any([
              extractPdfTextWithOpenAI(fileBuffer).then(t => {
                if (!t || t.trim().length < MIN_TEXT_LENGTH) throw new Error('OpenAI OCR empty');
                console.log('[extract-file] OpenAI PDF OCR succeeded');
                return t;
              }),
              extractPdfTextWithGemini(fileBuffer).then(t => {
                if (!t || t.trim().length < MIN_TEXT_LENGTH) throw new Error('Gemini OCR empty');
                console.log('[extract-file] Gemini inline PDF OCR succeeded');
                return t;
              }),
              ocrFallbackForPDF(fileBuffer, pageCount || 1),
            ]);
            extractedText   = ocrText;
            extractionMethod = 'ocr';
            warning          = 'Text extracted via AI OCR. Please review for accuracy.';
            console.log(`[extract-file] OCR race won in ${Date.now()-t0}ms`);
          } catch (ocrErr) {
            console.error('[extract-file] All OCR methods failed:', ocrErr);
            // If native text is also unreadable, reject rather than pass garbage to the AI
            if (nativeLen < MIN_PDF_NATIVE_FALLBACK_LEN || readability < 0.15) {
              return NextResponse.json({
                success: false,
                error: 'This PDF uses custom font encoding that prevents automated text extraction. Please:\n• Convert your PDF to a PNG/JPG image and upload it, or\n• Open the PDF, select all (Ctrl+A), copy, and paste the text directly.',
                hint: 'pdf_encoding_issue',
              }, { status: 422 });
            }
            warning = 'OCR was unavailable. Proceeding with native text — please review carefully and consider pasting text directly for better results.';
          }
        } else if (needsOcr && fastMode) {
          warning = 'Fast mode: OCR skipped. If text looks incomplete, retry without ?fast=1.';
        }
        break;
      }
      case 'image': {
        try {
          extractedText    = await extractTextFromImage(fileBuffer);
          extractionMethod = 'ocr';
          warning          = 'Text extracted using AI-powered OCR. Please review for accuracy.';
        } catch (ocrErr) {
          return NextResponse.json({ success: false, error: `Failed to read image. ${ocrErr instanceof Error ? ocrErr.message : ''} Try a clearer image or paste text directly.` }, { status: 422 });
        }
        break;
      }
      default: return NextResponse.json({ success: false, error: `Unsupported file type "${ext}".` }, { status: 400 });
    }

    extractedText = normalizeExtractedText(extractedText);

    const validation = validateExtractedText(extractedText);
    if (!validation.valid) {
      const canProceed = fileType === 'pdf' && extractedText.trim().length >= MIN_PDF_NATIVE_FALLBACK_LEN;
      if (!canProceed) return NextResponse.json({ success: false, error: validation.reason }, { status: 422 });
      warning = warning || 'Text quality appears low. Please review before final download.';
    }

    // Fast mode: return built-in parse immediately
    if (fastMode && shouldParse) {
      const parsedCv = parseBuiltIn(extractedText);
      const response = {
        success: true, text: extractedText, fileType, fileName: file.name,
        extractionMethod, confidence: calcConfidence(extractedText, extractionMethod),
        detectedLanguage: detectLanguage(extractedText), qualityReport: buildQualityReport(extractedText),
        data: sanitizeParsedCV(parsedCv), model: 'builtin', fastMode: true,
        ...(warning ? { warning } : {}),
      };
      if (cacheKey) extractionCache.set(cacheKey, response);
      return NextResponse.json(response);
    }

    let parsedCv: ParsedCV | null = null;
    let usedModel = '';
    let llmError: string | undefined;

    if (shouldParse) {
      try {
        const parseResult = await aiQueue.add(() => parseCvWithRetry(extractedText), 'high');
        parsedCv  = sanitizeParsedCV(parseResult.parsedCv);
        usedModel = parseResult.usedModel;
      } catch (err) {
        llmError = err instanceof Error ? err.message : 'LLM parsing failed';
        console.error('[extract-file] Parsing failed:', llmError);
      }
    }

    const qualityReport = buildQualityReport(extractedText);
    const response: Record<string, unknown> = {
      success: true, text: extractedText, fileType, fileName: file.name,
      extractionMethod, confidence: calcConfidence(extractedText, extractionMethod),
      detectedLanguage: detectLanguage(extractedText), qualityReport,
    };
    if (warning)  response.warning = warning;
    if (parsedCv) { response.data = parsedCv; response.model = usedModel; }
    else if (shouldParse) { response.parseError = llmError || 'CV parsing failed'; response.partialSuccess = true; }

    if (cacheKey) extractionCache.set(cacheKey, response);
    console.log(`[extract-file] Done in ${Date.now()-requestStart}ms, model: ${usedModel||'none'}`);
    return NextResponse.json(response);

  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'Request timed out. Try a smaller file or paste text directly.' }, { status: 504 });
    }
    console.error('[extract-file] Unhandled error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 500 });
  } finally {
    clearTimeout(timeoutTimer);
  }
}
