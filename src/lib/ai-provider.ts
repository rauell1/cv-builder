/**
 * Centralized AI Provider Module
 *
 * Provides a single `callAI()` gateway for all LLM interactions.
 *
 * GLM models are supported via two methods (in priority order):
 *   1. z-ai-web-dev-sdk  — works automatically in the Z.ai development environment.
 *   2. Zhipu AI REST API — used when ZHIPU_API_KEY env var is set (for Vercel / external deployments).
 *
 * Usage:
 *   import { callAI } from '@/lib/ai-provider';
 *   const response = await callAI(messages, 'glm-4-plus');
 */

// ---- Lazy ZAI SDK instance (dynamic import avoids module-level side-effects at build time) ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _zai: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _zaiInitPromise: Promise<any> | null = null;

async function getZAI() {
  if (_zai) return _zai;
  if (_zaiInitPromise) return _zaiInitPromise;
  _zaiInitPromise = (async () => {
    // Dynamic import prevents the SDK from running module-level code during Next.js build.
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zai = await ZAI.create();
    return _zai;
  })();
  return _zaiInitPromise;
}

// ---- Type Exports ----

export type AIProvider = 'glm' | 'openai' | 'anthropic' | 'google';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
}

export type AIProviderFailureKind =
  | 'missing_key'
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'provider_error'
  | 'unknown_error';

export interface AIProviderFailureDiagnostic {
  provider: AIProvider;
  model: string;
  kind: AIProviderFailureKind;
  status?: number;
  message: string;
}

class AIProviderError extends Error {
  readonly diagnostic: AIProviderFailureDiagnostic;

  constructor(diagnostic: AIProviderFailureDiagnostic) {
    super(`[${diagnostic.provider}:${diagnostic.model}] ${diagnostic.kind}: ${diagnostic.message}`);
    this.name = 'AIProviderError';
    this.diagnostic = diagnostic;
  }
}

export class AIModelFailedError extends Error {
  readonly diagnostics: AIProviderFailureDiagnostic[];

  constructor(diagnostics: AIProviderFailureDiagnostic[]) {
    super('AI model failed. Please try again. Check that at least one provider API key is configured correctly.');
    this.name = 'AIModelFailedError';
    this.diagnostics = diagnostics;
  }
}

const PROVIDER_KEY_ALIASES: Record<AIProvider, string[]> = {
  glm: ['ZHIPU_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
  openai: ['OPENAI_API_KEY', 'OPENAI_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  google: ['GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
};

type ResolvedEnv = { value: string; source: string } | null;

function resolveEnvValue(key: string): ResolvedEnv {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  if (!env) return null;

  const candidates: { name: string; value: string | undefined }[] = [
    { name: key, value: env[key] },
    { name: `NEXT_PUBLIC_${key}`, value: env[`NEXT_PUBLIC_${key}`] },
    { name: key.toLowerCase(), value: env[key.toLowerCase()] },
    { name: `next_public_${key.toLowerCase()}`, value: env[`next_public_${key.toLowerCase()}`] },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const trimmed = candidate.value.trim();
    if (trimmed.length > 0) {
      return { value: trimmed, source: candidate.name };
    }
  }
  return null;
}

function readEnvValue(key: string): string | null {
  const resolved = resolveEnvValue(key);
  return resolved ? resolved.value : null;
}

export function getProviderApiKey(provider: AIProvider): string | null {
  const keys = PROVIDER_KEY_ALIASES[provider] || [];
  for (const key of keys) {
    const value = readEnvValue(key);
    if (value) return value;
  }
  return null;
}

export function getProviderKeyNames(provider: AIProvider): string[] {
  return PROVIDER_KEY_ALIASES[provider] || [];
}

export function hasAnyProviderCredentials(): boolean {
  return (
    Boolean(getProviderApiKey('glm')) ||
    Boolean(getProviderApiKey('openai')) ||
    Boolean(getProviderApiKey('anthropic')) ||
    Boolean(getProviderApiKey('google')) ||
    process.env.ZAI_SDK_FALLBACK === '1'
  );
}

export function getProviderCredentialStatus(): Record<AIProvider, boolean> {
  return {
    glm: Boolean(getProviderApiKey('glm') || process.env.ZAI_SDK_FALLBACK === '1'),
    openai: Boolean(getProviderApiKey('openai')),
    anthropic: Boolean(getProviderApiKey('anthropic')),
    google: Boolean(getProviderApiKey('google')),
  };
}

export function getProviderCredentialDetails(): {
  anyConfigured: boolean;
  status: Record<AIProvider, boolean>;
  sources: Record<AIProvider, string[]>;
  zaiSdkFallback: boolean;
} {
  const status = getProviderCredentialStatus();
  const sources = {} as Record<AIProvider, string[]>;

  (Object.keys(PROVIDER_KEY_ALIASES) as AIProvider[]).forEach((provider) => {
    const aliases = PROVIDER_KEY_ALIASES[provider] || [];
    const found: string[] = [];
    for (const alias of aliases) {
      const resolved = resolveEnvValue(alias);
      if (resolved) {
        found.push(resolved.source);
      }
    }
    sources[provider] = Array.from(new Set(found));
  });

  return {
    anyConfigured: hasAnyProviderCredentials(),
    status,
    sources,
    zaiSdkFallback: process.env.ZAI_SDK_FALLBACK === '1',
  };
}

// ---- Utility Functions ----

export function getProvider(modelId: string): AIProvider {
  if (modelId.startsWith('glm-')) return 'glm';
  if (modelId.startsWith('gpt-')) return 'openai';
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'google';
  return 'glm';
}

export function estimateComplexity(
  cvLength: number,
  jobLength: number,
  totalBullets: number,
  projectCount: number
): 'simple' | 'standard' | 'complex' {
  if (cvLength > 6000 || jobLength > 4000 || totalBullets > 30 || projectCount > 10) {
    return 'complex';
  }
  if (cvLength < 2000 && jobLength < 1500 && totalBullets < 10) {
    return 'simple';
  }
  return 'standard';
}

export function autoSelectModel(complexity: 'simple' | 'standard' | 'complex'): string {
  switch (complexity) {
    case 'complex': return 'glm-4-long';
    case 'standard': return 'glm-4-plus';
    case 'simple': return 'glm-4-flash';
  }
}

// ---- Provider Implementations ----

async function callGLMviaSDK(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const zai = await getZAI();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const completion = await zai.chat.completions.create({
      model: modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      thinking: { type: 'disabled' },
    });

    clearTimeout(timer);
    const content = completion.choices?.[0]?.message?.content;
    return content || null;
  } catch (err) {
    console.warn('GLM SDK call failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Call GLM via the direct Zhipu AI REST API using ZHIPU_API_KEY.
 * Used as the primary path when deployed outside the Z.ai ecosystem (e.g. Vercel).
 */
async function callGLMviaAPI(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  const apiKey = getProviderApiKey('glm');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'glm',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing GLM API key',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* ignore */ }
      const snippet = errText.substring(0, 400);
      throw new AIProviderError({
        provider: 'glm',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: snippet || `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({
      provider: 'glm',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function callGLM(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  // Prefer direct REST API when ZHIPU_API_KEY is set (works in all environments).
  const zhipuKey = getProviderApiKey('glm');
  if (zhipuKey) {
    try {
      const result = await callGLMviaAPI(messages, modelId, timeoutMs);
      if (result) return result;
    } catch (err) {
      // Only fall through to SDK when explicitly enabled; otherwise surface diagnostics.
      if (process.env.ZAI_SDK_FALLBACK === '1') {
        console.warn('Zhipu AI REST API call failed, falling back to Z.ai SDK:', err instanceof Error ? err.message : String(err));
      } else {
        throw err;
      }
    }
  }

  // Fall back to z-ai-web-dev-sdk (only works in Z.ai environment).
  if (process.env.ZAI_SDK_FALLBACK === '1') {
    return callGLMviaSDK(messages, modelId, timeoutMs);
  }

  // No REST key and no SDK fallback: surface a clear diagnostic.
  throw new AIProviderError({
    provider: 'glm',
    model: modelId,
    kind: 'missing_key',
    message: 'Missing GLM API key and ZAI_SDK_FALLBACK is not enabled',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGLMVision(messages: any[], modelId: string, _timeoutMs = 35_000): Promise<string | null> {
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.createVision({
      model: modelId,
      messages,
    });
    const content = completion.choices?.[0]?.message?.content;
    return content || null;
  } catch (err) {
    console.warn(`GLM Vision model ${modelId} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callOpenAIVision(messages: any[], modelId: string, timeoutMs = 30_000): Promise<string | null> {
  const apiKey = getProviderApiKey('openai');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'openai',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing OpenAI API key',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new AIProviderError({
        provider: 'openai',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: errText.substring(0, 400) || `HTTP ${res.status}`,
      });
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({
      provider: 'openai',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function callOpenAI(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('openai');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'openai',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing OpenAI API key',
    });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: modelId, messages, temperature }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new AIProviderError({
        provider: 'openai',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: errText.substring(0, 400) || `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({
      provider: 'openai',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function callAnthropic(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('anthropic');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'anthropic',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing Anthropic API key',
    });
  }

  try {
    let systemContent = '';
    const anthropicMessages: { role: string; content: string }[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent += (systemContent ? '\n' : '') + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({ role: 'user', content: 'Please proceed.' });
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages: anthropicMessages,
      max_tokens: 8192,
      temperature,
    };
    if (systemContent) body.system = systemContent;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new AIProviderError({
        provider: 'anthropic',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: errText.substring(0, 400) || `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({
      provider: 'anthropic',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function callGemini(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('google');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'google',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing Google AI API key',
    });
  }

  try {
    let systemInstruction: string | undefined;
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new AIProviderError({
        provider: 'google',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: errText.substring(0, 400) || `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({
      provider: 'google',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- Public Gateway ----

export async function callAI(
  messages: AIMessage[],
  modelId: string,
  temperature?: number
): Promise<string | null> {
  try {
    const provider = getProvider(modelId);
    switch (provider) {
      case 'glm': return callGLM(messages, modelId);
      case 'openai': return callOpenAI(messages, modelId, temperature);
      case 'anthropic': return callAnthropic(messages, modelId, temperature);
      case 'google': return callGemini(messages, modelId, temperature);
      default: return callGLM(messages, modelId);
    }
  } catch (err) {
    // Keep existing behavior for direct callers: failures collapse to null.
    console.warn(`AI call failed for ${modelId}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function callAIVision(
  messages: unknown[],
  modelId: string,
  timeoutMs = 30_000
): Promise<string | null> {
  const provider = getProvider(modelId);

  if (provider === 'openai') {
    return callOpenAIVision(messages, modelId, timeoutMs);
  }

  const glmAttempt = await callGLMVision(messages, modelId, timeoutMs);
  if (glmAttempt) return glmAttempt;

  // Fallback to OpenAI vision when GLM vision is unavailable or fails.
  return callOpenAIVision(messages, 'gpt-4o-mini', timeoutMs);
}

const FALLBACK_MODEL_MAP: Record<string, string> = {
  'glm-4-flash': 'glm-4-plus',
  'glm-4-plus': 'glm-4-flash',
  'glm-4-long': 'glm-4-plus',
  'gpt-4o': 'glm-4-plus',
  'gpt-4o-mini': 'glm-4-flash',
  'claude-sonnet-4-20250514': 'glm-4-plus',
  'claude-haiku-4-20250414': 'glm-4-flash',
  'gemini-2.5-flash': 'glm-4-flash',
  'gemini-2.5-pro': 'glm-4-plus',
};

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const;
const ANTHROPIC_MODELS = ['claude-haiku-4-20250414', 'claude-sonnet-4-20250514'] as const;
const GOOGLE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
const MODEL_ROTATION_ORDER = [
  'glm-4-flash',
  'glm-4-plus',
  'glm-4-long',
  'gpt-4o-mini',
  'gpt-4o',
  'claude-haiku-4-20250414',
  'claude-sonnet-4-20250514',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

let modelRotationIndex = 0;

function hasProviderCredentials(provider: AIProvider): boolean {
  switch (provider) {
    case 'glm':
      // GLM works with ZHIPU_API_KEY, or explicitly enabled SDK fallback.
      return Boolean(getProviderApiKey('glm') || process.env.ZAI_SDK_FALLBACK === '1');
    case 'openai':
      return Boolean(getProviderApiKey('openai'));
    case 'anthropic':
      return Boolean(getProviderApiKey('anthropic'));
    case 'google':
      return Boolean(getProviderApiKey('google'));
    default:
      return false;
  }
}

function getProviderModelFallbacks(provider: AIProvider): string[] {
  switch (provider) {
    case 'openai':
      return [...OPENAI_MODELS];
    case 'anthropic':
      return [...ANTHROPIC_MODELS];
    case 'google':
      return [...GOOGLE_MODELS];
    case 'glm':
      return ['glm-4-flash', 'glm-4-plus'];
    default:
      return [];
  }
}

function buildFallbackChain(primaryModel: string): string[] {
  const primaryProvider = getProvider(primaryModel);
  const chain: string[] = [primaryModel];

  const directFallback = FALLBACK_MODEL_MAP[primaryModel];
  if (directFallback) chain.push(directFallback);

  for (const model of getProviderModelFallbacks(primaryProvider)) {
    chain.push(model);
  }

  if (hasProviderCredentials('openai')) {
    chain.push(...OPENAI_MODELS);
  }
  if (hasProviderCredentials('anthropic')) {
    chain.push(...ANTHROPIC_MODELS);
  }
  if (hasProviderCredentials('google')) {
    chain.push(...GOOGLE_MODELS);
  }

  // Always keep GLM as a last-resort path for Z.ai runtime / ZHIPU_API_KEY setups.
  chain.push('glm-4-flash', 'glm-4-plus');

  return [...new Set(chain)].filter(Boolean);
}

export function getNextRotatingModel(preferredModel?: string): string {
  const seed = preferredModel || 'glm-4-flash';
  const pool = [
    ...MODEL_ROTATION_ORDER,
    ...buildFallbackChain(seed),
  ];

  const enabled = [...new Set(pool)].filter((model) => hasProviderCredentials(getProvider(model)));
  if (enabled.length === 0) return seed;

  const idx = modelRotationIndex % enabled.length;
  modelRotationIndex = (modelRotationIndex + 1) % enabled.length;
  return enabled[idx];
}

export async function callAIWithFallback(
  messages: AIMessage[],
  modelId: string,
  _complexity?: 'simple' | 'standard' | 'complex',
  temperature?: number
): Promise<AIResponse> {
  const candidates = buildFallbackChain(modelId);
  const failedProviders = new Set<AIProvider>();
  const diagnostics: AIProviderFailureDiagnostic[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const provider = getProvider(candidate);

    if (!hasProviderCredentials(provider)) {
      continue;
    }

    if (failedProviders.has(provider)) {
      continue;
    }

    if (i > 0) {
      console.warn(`[AI] Model ${modelId} failed, trying fallback ${candidate}`);
    }

    try {
      // Call provider functions without swallowing errors so we can surface diagnostics.
      let content: string | null = null;
      switch (provider) {
        case 'glm':
          content = await callGLM(messages, candidate);
          break;
        case 'openai':
          content = await callOpenAI(messages, candidate, temperature);
          break;
        case 'anthropic':
          content = await callAnthropic(messages, candidate, temperature);
          break;
        case 'google':
          content = await callGemini(messages, candidate, temperature);
          break;
        default:
          content = await callGLM(messages, candidate);
      }

      if (content) {
        return { content, model: candidate, provider };
      }

      diagnostics.push({
        provider,
        model: candidate,
        kind: 'provider_error',
        message: 'Empty response',
      });
      failedProviders.add(provider);
    } catch (err) {
      if (err instanceof AIProviderError) {
        diagnostics.push(err.diagnostic);
      } else {
        diagnostics.push({
          provider,
          model: candidate,
          kind: 'unknown_error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      failedProviders.add(provider);
    }
  }

  throw new AIModelFailedError(diagnostics);
}

export function getRequiredEnvKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'glm': return null;
    case 'openai': return 'OPENAI_API_KEY';
    case 'anthropic': return 'ANTHROPIC_API_KEY';
    case 'google': return 'GOOGLE_AI_API_KEY';
    default: return null;
  }
}
