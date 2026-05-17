/**
 * Shared JSON extraction and repair utilities for LLM responses.
 * Used by parse-cv, analyze-job, and restructure-cv routes to avoid duplication.
 */

/** Extract the first JSON object from an LLM response that may contain prose or code fences. */
export function extractJSON(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const codeMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(text);
  if (codeMatch) {
    const c = codeMatch[1].trim();
    if (c.startsWith('{')) return c;
  }
  let depth = 0, start = -1, inString = false, escape = false;
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

/** Fix common LLM JSON output issues: trailing commas, single-quoted keys/values. */
export function fixCommonJSONIssues(json: string): string {
  return json
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/'([^']+)'\s*:/g, '"$1":')
    .replace(/:\s*'([^']*?)'/g, ': "$1"')
    .replace(/[\[,]\s*'([^']*?)'/g, (m) => m.replace(/'/g, '"'));
}

/** Escape literal newlines/tabs inside JSON string values that LLMs sometimes emit. */
export function fixUnescapedNewlinesInStrings(json: string): string {
  let result = '', inString = false, escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) { result += ch; escape = false; continue; }
    if (ch === '\\' && inString) { result += ch; escape = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }
    result += ch;
  }
  return result;
}

/**
 * Progressively-lenient JSON.parse with automatic repair passes.
 * Throws only when all repair strategies are exhausted.
 */
export function safeJSONParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* */ }
  try { return JSON.parse(fixCommonJSONIssues(raw)); } catch { /* */ }
  try { return JSON.parse(fixUnescapedNewlinesInStrings(raw)); } catch { /* */ }
  try { return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(raw))); } catch { /* */ }
  const stripped = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  try { return JSON.parse(fixCommonJSONIssues(fixUnescapedNewlinesInStrings(stripped))); } catch { /* */ }
  throw new Error(`JSON parse failed. Raw (first 300 chars): ${raw.substring(0, 300)}`);
}
