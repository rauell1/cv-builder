/**
 * API paths that use the stricter AI rate limiter in middleware.
 * Must match routes that are LLM-heavy or high-cost; update when adding new AI endpoints.
 */
export const AI_RATE_LIMIT_PATHS = [
  '/api/extract-file',
  '/api/parse-cv',
  '/api/analyze-job',
  '/api/restructure-cv',
  '/api/generate-insights',
  '/api/generate-cover-letter',
  '/api/score-cv',
  '/api/enhance-achievements',
  '/api/ai-chat',
] as const;

export type AIRateLimitPath = (typeof AI_RATE_LIMIT_PATHS)[number];

export function isAIRateLimitPath(pathname: string): boolean {
  return (AI_RATE_LIMIT_PATHS as readonly string[]).includes(pathname);
}
