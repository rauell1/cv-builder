import type { ParsedCV, JobAnalysis, SectionInsight, CVFormatId, CoverLetterData, CoverLetterFormatId, CVScore, AchievementEnhancement } from './cv-types';

interface ApiSuccess<T> {
  success: true;
  data: T;
  model: string;
  sessionId?: string;
  complexity?: string;
}

interface ApiError {
  success: false;
  error: string;
  missingKey?: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ParseCvResult {
  data: ParsedCV;
  sessionId?: string;
  model: string;
  cached?: boolean;
  parseTimeMs?: number;
}

export async function parseCv(cvText: string, sessionId?: string): Promise<ParseCvResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s timeout for provider fallback chains

  try {
    const response = await fetch('/api/parse-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvText, sessionId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Parse failed (HTTP ${response.status})`;
      try {
        const bodyText = await response.text();
        if (bodyText) {
          try {
            const errorData = JSON.parse(bodyText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Parse failed (HTTP ${response.status}): ${bodyText.substring(0, 300)}`;
          }
        }
      } catch { }
      throw new Error(errorMessage);
    }

    const result = await response.json() as ApiResponse<ParsedCV> & { cached?: boolean; parseTimeMs?: number };
    if (!result.success) throw new Error(result.error);
    return {
      data: result.data,
      sessionId: result.sessionId,
      model: result.model,
      cached: result.cached,
      parseTimeMs: result.parseTimeMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('CV parsing timed out. The server may be busy — please try again.');
    }
    throw err;
  }
}

export async function analyzeJob(jobDescText: string): Promise<JobAnalysis> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000); // 20s timeout

  try {
    const response = await fetch('/api/analyze-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Job analysis failed (HTTP ${response.status})`;
      try {
        const bodyText = await response.text();
        if (bodyText) {
          try {
            const errorData = JSON.parse(bodyText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Job analysis failed (HTTP ${response.status}): ${bodyText.substring(0, 300)}`;
          }
        }
      } catch { }
      throw new Error(errorMessage);
    }

    const result: ApiResponse<JobAnalysis> = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Job analysis timed out. The server may be busy — please try again.');
    }
    throw err;
  }
}

export async function restructureCv(
  parsedCv: ParsedCV,
  jobAnalysis: JobAnalysis,
  jobDescText: string,
  modelId?: string
): Promise<{ cv: ParsedCV; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120s timeout (AI restructuring can be slow for complex CVs)

  try {
    const response = await fetch('/api/restructure-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parsedCv, jobAnalysis, jobDescText, modelId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to restructure CV' }));
      throw new Error(error.error || 'Failed to restructure CV');
    }

    const result: ApiResponse<ParsedCV> = await response.json();
    if (!result.success) throw new Error(result.error);
    return { cv: result.data, model: result.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('CV restructuring timed out. The server may be busy — please try again.');
    }
    throw err;
  }
}

export async function generatePdf(cvData: ParsedCV, format: CVFormatId = 'europass'): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvData, format }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
      throw new Error(error.error || 'Failed to generate PDF');
    }

    return response.blob();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('PDF generation timed out. Please try again.');
    }
    throw err;
  }
}

export async function generatePythonScript(cvData: ParsedCV): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvData }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate script' }));
      throw new Error(error.error || 'Failed to generate Python script');
    }

    return response.blob();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Script generation timed out. Please try again.');
    }
    throw err;
  }
}

export interface ExtractFileResult {
  text: string;
  fileType: string;
  fileName: string;
  warning?: string;
  data?: ParsedCV;
  model?: string;
  parseError?: string;
  partialSuccess?: boolean;
  extractionMethod: 'native' | 'ocr' | 'direct';
  confidence: number;
  detectedLanguage: string;
  qualityReport: {
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
  };
}

export interface ExtractFileOptions {
  fast?: boolean;
  parse?: boolean;
  timeoutMs?: number;
}

/**
 * Sleep helper for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an HTTP status code is a transient gateway error that can be retried.
 */
function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Check if an error is a network-level failure (not an HTTP error).
 * fetch() throws a TypeError when the network is unreachable, DNS fails, or
 * the server refuses the connection.
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  if (err instanceof TypeError && err.message.includes('network')) return true;
  if (err instanceof TypeError && err.message.includes('Failed to fetch')) return true;
  return false;
}

/**
 * Upload a file and extract its text content.
 * Includes retry logic with exponential backoff for:
 * - Transient gateway errors (502/503/504)
 * - Network-level failures (server unreachable, connection refused)
 */
export async function extractFile(file: File, options: ExtractFileOptions = {}): Promise<ExtractFileResult> {
  // Client-side file size validation (10 MB hard limit)
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size > TEN_MB) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum file size is 10 MB. Please try pasting your CV text directly instead.`
    );
  }

  const formData = new FormData();
  formData.append('file', file);

  const fast = options.fast ?? false;
  const parse = options.parse ?? false;
  const timeoutMs = options.timeoutMs ?? 45_000;

  const MAX_RETRIES = 2;
  const RETRY_DELAYS = [1000, 3000]; // 1s, 3s — fast retries

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`/api/extract-file?fast=${fast ? '1' : '0'}&parse=${parse ? '1' : '0'}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;

        // Read the response body as text first (can only consume body once)
        let errorMessage = `Upload failed (HTTP ${status})`;
        try {
          const bodyText = await response.text();
          if (bodyText) {
            try {
              const errorData = JSON.parse(bodyText);
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = `Upload failed (HTTP ${status}): ${bodyText.substring(0, 200)}`;
            }
          }
        } catch {
          // Couldn't read response body at all
        }

        // For gateway errors, retry with backoff
        if (isRetryableStatus(status) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
          console.warn(`[extractFile] Gateway ${status} on attempt ${attempt + 1}. Retry in ${delay / 1000}s...`);
          lastError = new Error(errorMessage);
          await sleep(delay);
          continue;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result as ExtractFileResult;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Upload timed out. The file may be too large or the server is busy. Please try pasting your CV text directly.');
      }

      // Network-level error (server unreachable, connection refused) — retry with backoff
      if (isNetworkError(err) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        console.warn(`[extractFile] Network error on attempt ${attempt + 1}. Retry in ${delay / 1000}s...`);
        lastError = new Error('NETWORK_ERROR');
        await sleep(delay);
        continue;
      }

      // Check if the error message indicates a gateway error
      const msg = err instanceof Error ? err.message : '';
      if ((msg.includes('HTTP 502') || msg.includes('HTTP 503') || msg.includes('HTTP 504')) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        console.warn(`[extractFile] Gateway error on attempt ${attempt + 1}. Retry in ${delay / 1000}s...`);
        lastError = err instanceof Error ? err : new Error(msg);
        await sleep(delay);
        continue;
      }

      // Non-retryable error — throw immediately
      throw err;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Upload failed after multiple attempts. Please try pasting your CV text directly.');
}

export async function generateInsights(
  cvData: ParsedCV,
  jobAnalysis: JobAnalysis,
  jobDescText: string,
  sectionId?: string
): Promise<SectionInsight[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120s timeout (up to 6 parallel AI calls)

  try {
    const response = await fetch('/api/generate-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvData, jobAnalysis, jobDescText, sectionId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate insights' }));
      throw new Error(error.error || 'Failed to generate AI insights');
    }

    const result: ApiResponse<SectionInsight[]> = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Insight generation timed out. Please try again.');
    }
    throw err;
  }
}

export async function generateCoverLetter(
  cvData: ParsedCV,
  jobAnalysis: JobAnalysis,
  jobDescText: string,
  formatId: CoverLetterFormatId,
  modelId?: string
): Promise<{ coverLetter: CoverLetterData; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch('/api/generate-cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvData, jobAnalysis, jobDescText, formatId, modelId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate cover letter' }));
      throw new Error(error.error || 'Failed to generate cover letter');
    }

    const result: ApiResponse<CoverLetterData> = await response.json();
    if (!result.success) throw new Error(result.error);
    return { coverLetter: result.data, model: result.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Cover letter generation timed out. Please try again.');
    }
    throw err;
  }
}

export async function generateCoverLetterPdf(
  coverLetter: CoverLetterData,
  formatId: CoverLetterFormatId
): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch('/api/generate-cover-letter-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverLetter, formatId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate cover letter PDF' }));
      throw new Error(error.error || 'Failed to generate cover letter PDF');
    }

    return response.blob();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Cover letter PDF generation timed out. Please try again.');
    }
    throw err;
  }
}

export interface AiChatResponse {
  success: boolean;
  content: string;
  model: string;
  provider: string;
}

export async function aiChat(
  messages: { role: string; content: string }[],
  model: string,
  temperature: number = 0.7
): Promise<AiChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, temperature }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'AI request failed' }));
      throw new Error(error.missingKey ? `Missing API key: ${error.missingKey}` : (error.error || 'AI request failed'));
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI chat timed out. Please try again.');
    }
    throw err;
  }
}

export async function enhanceAchievements(
  bullets: string[],
  jobContext?: string
): Promise<{ enhancement: AchievementEnhancement; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch('/api/enhance-achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bullets, jobContext }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to enhance achievements' }));
      throw new Error(error.error || 'Failed to enhance achievements');
    }

    const result: ApiResponse<AchievementEnhancement> = await response.json();
    if (!result.success) throw new Error(result.error);
    return { enhancement: result.data, model: result.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Achievement enhancement timed out. Please try again.');
    }
    throw err;
  }
}

export async function scoreCv(
  cvData: ParsedCV,
  jobAnalysis: JobAnalysis,
  jobDescText: string
): Promise<{ score: CVScore; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch('/api/score-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvData, jobAnalysis, jobDescText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to score CV' }));
      throw new Error(error.error || 'Failed to score CV');
    }

    const result: ApiResponse<CVScore> = await response.json();
    if (!result.success) throw new Error(result.error);
    return { score: result.data, model: result.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('CV scoring timed out. Please try again.');
    }
    throw err;
  }
}
