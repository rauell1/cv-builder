import type { CoverLetterData, ParsedCV } from './cv-types';

const MARKDOWN_BOLD_RE = /\*\*(.*?)\*\*/g;
const MARKDOWN_UNDERSCORE_BOLD_RE = /__(.*?)__/g;
const LONG_DASH_RE = /[\u2012\u2013\u2014\u2015]/g;
const NB_HYPHEN_RE = /\u2011/g;
const MULTI_SPACE_RE = /[ \t]{2,}/g;

export function sanitizeGeneratedText(input: string): string {
  if (!input) return '';

  return input
    .replace(MARKDOWN_BOLD_RE, '$1')
    .replace(MARKDOWN_UNDERSCORE_BOLD_RE, '$1')
    .replace(LONG_DASH_RE, '-')
    .replace(NB_HYPHEN_RE, '-')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(MULTI_SPACE_RE, ' ').trimEnd())
    .join('\n')
    .trim();
}

export function sanitizeObjectStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeGeneratedText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObjectStrings(item)) as T;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(obj)) {
      cleaned[key] = sanitizeObjectStrings(fieldValue);
    }
    return cleaned as T;
  }

  return value;
}

export function sanitizeParsedCV(cv: ParsedCV): ParsedCV {
  return sanitizeObjectStrings(cv);
}

export function sanitizeCoverLetterData(coverLetter: CoverLetterData): CoverLetterData {
  return sanitizeObjectStrings(coverLetter);
}
