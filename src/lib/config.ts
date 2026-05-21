/**
 * Centralized configuration constants for the AI CV Builder application.
 *
 * All tunable values live here. If you need to change a limit, timeout,
 * or threshold, do it here — not scattered across the codebase.
 */

export const AI_CONFIG = {
  /** Default temperature for structured output tasks (CV parsing, restructuring, insights) */
  STRUCTURED_TEMPERATURE: 0.5,
  /** Default temperature for chat and cover letter generation tasks */
  CHAT_TEMPERATURE: 0.7,
  /** Default max tokens for providers that require explicit limits (Anthropic) */
  MAX_TOKENS_DEFAULT: 4096,
  /** Higher max tokens for complex restructuring tasks */
  MAX_TOKENS_RESTRUCTURE: 8192,
  /** Timeout in ms for AI API calls (covers GLM, OpenAI, Anthropic, Google) */
  AI_CALL_TIMEOUT_MS: 60_000,
  /** Timeout in ms for VLM file extraction (PDF/image OCR) — can be slower */
  VLM_CALL_TIMEOUT_MS: 90_000,
} as const;

export const INPUT_LIMITS = {
  /** Minimum allowed temperature value */
  MIN_TEMPERATURE: 0,
  /** Maximum allowed temperature value */
  MAX_TEMPERATURE: 2,
  /** Maximum number of messages allowed in a single AI request */
  MAX_CHAT_MESSAGES: 50,
} as const;

/**
 * Rate limit tiers — each defines max requests per time window.
 * Used by `src/lib/api-rate-limit.ts` → `checkRateLimit()`.
 */
export const RATE_LIMIT = {
  /** General fallback tier */
  DEFAULT: { maxRequests: 30, windowMs: 60_000 },
  /** AI-powered endpoints (parse-cv, analyze-job, restructure-cv, generate-insights, ai-chat, generate-cover-letter) */
  AI_ENDPOINT: { maxRequests: 10, windowMs: 60_000 },
  /** File upload endpoint (extract-file) */
  FILE_UPLOAD: { maxRequests: 5, windowMs: 60_000 },
  /** PDF / resource-intensive generation endpoints */
  PDF_GENERATION: { maxRequests: 10, windowMs: 60_000 },
} as const;

/**
 * Data retention — how long to keep session data before auto-cleanup.
 */
export const DATA_RETENTION = {
  /** Auto-delete sessions older than this (in days) */
  SESSION_MAX_AGE_DAYS: 30,
} as const;
