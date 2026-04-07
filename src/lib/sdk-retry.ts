/**
 * Retry utility for z-ai-web-dev-sdk calls.
 *
 * The SDK connects to an external endpoint that can experience transient
 * DNS timeouts and network issues. This module wraps SDK calls with
 * exponential backoff retry logic to handle these failures gracefully.
 */

interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000ms) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 10000ms) */
  maxDelay?: number;
  /** Whether to jitter the delay to avoid thundering herd (default: true) */
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitter: true,
};

function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  if (options.jitter) {
    // Add ±25% random jitter
    const jitterRange = cappedDelay * 0.25;
    return cappedDelay - jitterRange + Math.random() * jitterRange * 2;
  }
  return cappedDelay;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const cause = (error.cause as Error | undefined)?.message?.toLowerCase() ?? '';

  // DNS / network timeout errors from the SDK
  const retryablePatterns = [
    'dns',
    'timeout',
    'timed out',
    'econnrefused',
    'econnreset',
    'enotfound',
    'socket hang up',
    'network',
    'i/o timeout',
    'proxying request',
    'dial tcp',
    'lookup',
    'fetch failed',
    'epipe',
    'socket use closed',
  ];

  return retryablePatterns.some(
    (pattern) => message.includes(pattern) || cause.includes(pattern)
  );
}

/**
 * Execute an async function with retry logic and exponential backoff.
 * Only retries on transient network/DNS/timeout errors.
 *
 * @param fn        - The async function to execute
 * @param label     - A human-readable label for logging (e.g., "VLM PDF extraction")
 * @param options   - Retry configuration overrides
 * @returns         - The return value of the function on success
 * @throws          - The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options?: RetryOptions
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-network errors (auth errors, validation, etc.)
      if (!isRetryableError(error)) {
        console.error(`[${label}] Non-retryable error:`, error);
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        console.error(
          `[${label}] All ${config.maxRetries + 1} attempts failed:`,
          error
        );
        throw new Error(
          `AI service is temporarily unavailable after ${config.maxRetries + 1} attempts. ` +
          `This is usually a transient network issue. Please try again in 30–60 seconds.`
        );
      }

      const delay = calculateDelay(attempt, config);
      console.warn(
        `[${label}] Attempt ${attempt + 1} failed (retryable), ` +
        `retrying in ${Math.round(delay)}ms... Error: ${error instanceof Error ? error.message : String(error)}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
