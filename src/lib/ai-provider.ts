/**
 * Centralized AI Provider Module
 *
 * Supports:
 *   - GLM / Zhipu AI  (ZHIPU_API_KEY / GLM_API_KEY / BIGMODEL_API_KEY)
 *   - OpenAI          (OPENAI_API_KEY)
 *   - Anthropic       (ANTHROPIC_API_KEY)
 *   - Google Gemini   (GOOGLE_AI_API_KEY / GEMINI_API_KEY)
 *   - NVIDIA NIM      (NVIDIA_API_KEY)  ← NEW
 *
 * NVIDIA NIM uses an OpenAI-compatible endpoint so we reuse the same HTTP
 * pattern – just swap base URL and model IDs.
 *
 * Auto-rotation:
 *   callAIWithFallback() tries each candidate in priority order.
 *   When a provider/key is unhealthy it is skipped for COOLDOWN_MS then
 *   automatically re-enabled by the background health-check timer.
 *
 * Usage:
 *   import { callAIWithFallback } from '@/lib/ai-provider';
 *   const { content, model, provider } = await callAIWithFallback(messages, 'auto');
 */

// ---- Lazy ZAI SDK instance ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _zai: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _zaiInitPromise: Promise<any> | null = null;

async function getZAI() {
  if (_zai) return _zai;
  if (_zaiInitPromise) return _zaiInitPromise;
  _zaiInitPromise = (async () => {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zai = await ZAI.create();
    return _zai;
  })();
  return _zaiInitPromise;
}

// ---- Types ----

export type AIProvider = 'glm' | 'openai' | 'anthropic' | 'google' | 'nvidia';

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
    super('All AI models failed. Check that at least one provider API key is configured.');
    this.name = 'AIModelFailedError';
    this.diagnostics = diagnostics;
  }
}

// ---- Key health tracking ----
// Keys are marked "down" for COOLDOWN_MS after a non-retryable error.
// A background interval re-enables them so rotation can retry.

const COOLDOWN_MS = 5 * 60_000; // 5 minutes

interface KeyHealth {
  key: string;
  status: 'healthy' | 'down';
  downSince?: number;
}

// provider → list of keys with their health
const keyHealthMap = new Map<AIProvider, KeyHealth[]>();

function initKeyHealth(provider: AIProvider, keys: string[]): void {
  if (!keyHealthMap.has(provider)) {
    keyHealthMap.set(provider, keys.map((k) => ({ key: k, status: 'healthy' })));
  }
}

function pickHealthyKey(provider: AIProvider): string | null {
  const pool = keyHealthMap.get(provider) ?? [];
  const now = Date.now();
  // Re-enable keys that have cooled down
  for (const entry of pool) {
    if (entry.status === 'down' && entry.downSince && now - entry.downSince >= COOLDOWN_MS) {
      entry.status = 'healthy';
    }
  }
  const healthy = pool.filter((e) => e.status === 'healthy');
  if (healthy.length === 0) return null;
  // Round-robin among healthy keys
  const idx = Math.floor(Math.random() * healthy.length);
  return healthy[idx].key;
}

function markKeyDown(provider: AIProvider, key: string): void {
  const pool = keyHealthMap.get(provider) ?? [];
  const entry = pool.find((e) => e.key === key);
  if (entry) {
    entry.status = 'down';
    entry.downSince = Date.now();
  }
}

// Background healer – re-enables cooled-down keys every 60 s (server-side only)
if (typeof setInterval !== 'undefined' && typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const pool of keyHealthMap.values()) {
      for (const entry of pool) {
        if (entry.status === 'down' && entry.downSince && now - entry.downSince >= COOLDOWN_MS) {
          entry.status = 'healthy';
        }
      }
    }
  }, 60_000);
}

// ---- Env resolution ----

const PROVIDER_KEY_ALIASES: Record<AIProvider, string[]> = {
  glm:       ['ZHIPU_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
  openai:    ['OPENAI_API_KEY', 'OPENAI_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  google:    ['GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  nvidia:    ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
};

type ResolvedEnv = { value: string; source: string } | null;

function resolveEnvValue(key: string): ResolvedEnv {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  if (!env) return null;
  const candidates = [
    { name: key,                                value: env[key] },
    { name: `NEXT_PUBLIC_${key}`,               value: env[`NEXT_PUBLIC_${key}`] },
    { name: key.toLowerCase(),                  value: env[key.toLowerCase()] },
    { name: `next_public_${key.toLowerCase()}`, value: env[`next_public_${key.toLowerCase()}`] },
  ];
  for (const c of candidates) {
    const trimmed = c.value?.trim();
    if (trimmed) return { value: trimmed, source: c.name };
  }
  return null;
}

function readEnvValue(key: string): string | null {
  return resolveEnvValue(key)?.value ?? null;
}

/**
 * Returns ALL configured values for a provider (supports multi-key rotation).
 * Keys are deduplicated and empty strings are stripped.
 * Supports comma-separated list in a single env var:
 *   NVIDIA_API_KEY=nvapi-key1,nvapi-key2,nvapi-key3
 */
export function getAllProviderKeys(provider: AIProvider): string[] {
  const aliases = PROVIDER_KEY_ALIASES[provider] ?? [];
  const found: string[] = [];
  for (const alias of aliases) {
    const raw = readEnvValue(alias);
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (trimmed) found.push(trimmed);
    }
  }
  const unique = [...new Set(found)];
  // Register keys into health tracker on first access
  initKeyHealth(provider, unique);
  return unique;
}

export function getProviderApiKey(provider: AIProvider): string | null {
  const keys = getAllProviderKeys(provider);
  if (keys.length === 0) return null;
  return pickHealthyKey(provider) ?? keys[0];
}

export function getProviderKeyNames(provider: AIProvider): string[] {
  return PROVIDER_KEY_ALIASES[provider] ?? [];
}

export function hasAnyProviderCredentials(): boolean {
  return (
    Boolean(getProviderApiKey('glm')) ||
    Boolean(getProviderApiKey('openai')) ||
    Boolean(getProviderApiKey('anthropic')) ||
    Boolean(getProviderApiKey('google')) ||
    Boolean(getProviderApiKey('nvidia')) ||
    process.env.ZAI_SDK_FALLBACK === '1'
  );
}

export function getProviderCredentialStatus(): Record<AIProvider, boolean> {
  return {
    glm:       Boolean(getProviderApiKey('glm') || process.env.ZAI_SDK_FALLBACK === '1'),
    openai:    Boolean(getProviderApiKey('openai')),
    anthropic: Boolean(getProviderApiKey('anthropic')),
    google:    Boolean(getProviderApiKey('google')),
    nvidia:    Boolean(getProviderApiKey('nvidia')),
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
    const found: string[] = [];
    for (const alias of PROVIDER_KEY_ALIASES[provider]) {
      const resolved = resolveEnvValue(alias);
      if (resolved) found.push(resolved.source);
    }
    sources[provider] = [...new Set(found)];
  });
  return {
    anyConfigured: hasAnyProviderCredentials(),
    status,
    sources,
    zaiSdkFallback: process.env.ZAI_SDK_FALLBACK === '1',
  };
}

// ---- Utility ----

export function getProvider(modelId: string): AIProvider {
  if (modelId.startsWith('glm-'))        return 'glm';
  if (modelId.startsWith('gpt-'))        return 'openai';
  if (modelId.startsWith('claude-'))     return 'anthropic';
  if (modelId.startsWith('gemini-'))     return 'google';
  // NVIDIA NIM models (all served via integrate.api.nvidia.com)
  if (
    modelId.startsWith('mistralai/') ||
    modelId.startsWith('deepseek-ai/') ||
    modelId.startsWith('moonshotai/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('nvidia/') ||
    modelId.startsWith('meta/') ||
    modelId.startsWith('01-ai/') ||
    NVIDIA_MODELS.some((m) => m.id === modelId)
  ) return 'nvidia';
  return 'glm';
}

export function estimateComplexity(
  cvLength: number,
  jobLength: number,
  totalBullets: number,
  projectCount: number
): 'simple' | 'standard' | 'complex' {
  if (cvLength > 6000 || jobLength > 4000 || totalBullets > 30 || projectCount > 10) return 'complex';
  if (cvLength < 2000 && jobLength < 1500 && totalBullets < 10) return 'simple';
  return 'standard';
}

export function autoSelectModel(complexity: 'simple' | 'standard' | 'complex'): string {
  // Prefer NVIDIA if key is present, otherwise fall back to GLM
  if (getProviderApiKey('nvidia')) {
    switch (complexity) {
      case 'complex':  return 'mistralai/mistral-medium-3.5-128b';
      case 'standard': return 'deepseek-ai/deepseek-r1-0528';
      case 'simple':   return 'nvidia/llama-3.3-nemotron-super-49b-v1';
    }
  }
  switch (complexity) {
    case 'complex':  return 'glm-4-long';
    case 'standard': return 'glm-4-plus';
    case 'simple':   return 'glm-4-flash';
  }
}

// ---- NVIDIA NIM model registry ----
// Models sourced from build.nvidia.com (free-endpoint tier).
// baseScore drives priority in fallback chain (higher = preferred).

export interface NvidiaModelEntry {
  id: string;               // model string sent to the API
  displayName: string;
  baseScore: number;        // 0–1, higher = preferred
  contextWindow?: number;
  tags: string[];
}

export const NVIDIA_MODELS: NvidiaModelEntry[] = [
  // --- Top-tier reasoning / coding ---
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    displayName: 'Mistral Medium 3.5 128b',
    baseScore: 0.95,
    contextWindow: 128_000,
    tags: ['coding', 'agentic', 'cv'],
  },
  {
    id: 'deepseek-ai/deepseek-r1-0528',
    displayName: 'DeepSeek-R1-0528',
    baseScore: 0.93,
    contextWindow: 64_000,
    tags: ['reasoning', 'coding', 'cv'],
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    displayName: 'Kimi K2 Instruct',
    baseScore: 0.91,
    contextWindow: 128_000,
    tags: ['multimodal', 'coding', 'cv'],
  },
  {
    id: '01-ai/yi-large',
    displayName: 'Yi Large',
    baseScore: 0.88,
    contextWindow: 32_000,
    tags: ['general', 'cv'],
  },
  // --- Fast / efficient ---
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    displayName: 'Nemotron Super 49b',
    baseScore: 0.85,
    contextWindow: 128_000,
    tags: ['fast', 'cv'],
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70b Instruct',
    baseScore: 0.82,
    contextWindow: 128_000,
    tags: ['general', 'cv'],
  },
  {
    id: 'qwen/qwen3-235b-a22b',
    displayName: 'Qwen3 235b-A22b',
    baseScore: 0.80,
    contextWindow: 32_000,
    tags: ['reasoning', 'cv'],
  },
];

// ---- Provider call implementations ----

async function callGLMviaSDK(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const zai = await getZAI();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const completion = await zai.chat.completions.create({
      model: modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      thinking: { type: 'disabled' },
    });
    clearTimeout(timer);
    return completion.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.warn('GLM SDK call failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function callGLMviaAPI(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  const apiKey = getProviderApiKey('glm');
  if (!apiKey) throw new AIProviderError({ provider: 'glm', model: modelId, kind: 'missing_key', message: 'Missing GLM API key' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages: messages.map((m) => ({ role: m.role, content: m.content })) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* ignore */ }
      if (res.status === 401 || res.status === 403) markKeyDown('glm', apiKey);
      throw new AIProviderError({ provider: 'glm', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'glm', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

async function callGLM(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  const zhipuKey = getProviderApiKey('glm');
  if (zhipuKey) {
    try {
      const result = await callGLMviaAPI(messages, modelId, timeoutMs);
      if (result) return result;
    } catch (err) {
      if (process.env.ZAI_SDK_FALLBACK === '1') {
        console.warn('Zhipu REST failed, falling back to SDK:', err instanceof Error ? err.message : String(err));
      } else {
        throw err;
      }
    }
  }
  if (process.env.ZAI_SDK_FALLBACK === '1') return callGLMviaSDK(messages, modelId, timeoutMs);
  throw new AIProviderError({ provider: 'glm', model: modelId, kind: 'missing_key', message: 'Missing GLM API key and ZAI_SDK_FALLBACK is not enabled' });
}

async function callOpenAI(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('openai');
  if (!apiKey) throw new AIProviderError({ provider: 'openai', model: modelId, kind: 'missing_key', message: 'Missing OpenAI API key' });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages, temperature }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('openai', apiKey);
      throw new AIProviderError({ provider: 'openai', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'openai', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

async function callAnthropic(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('anthropic');
  if (!apiKey) throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: 'missing_key', message: 'Missing Anthropic API key' });
  try {
    let systemContent = '';
    const anthropicMessages: { role: string; content: string }[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') { systemContent += (systemContent ? '\n' : '') + msg.content; }
      else anthropicMessages.push({ role: msg.role, content: msg.content });
    }
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({ role: 'user', content: 'Please proceed.' });
    }
    const body: Record<string, unknown> = { model: modelId, messages: anthropicMessages, max_tokens: 8192, temperature };
    if (systemContent) body.system = systemContent;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('anthropic', apiKey);
      throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

async function callGemini(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = getProviderApiKey('google');
  if (!apiKey) throw new AIProviderError({ provider: 'google', model: modelId, kind: 'missing_key', message: 'Missing Google AI API key' });
  try {
    let systemInstruction: string | undefined;
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') { systemInstruction = msg.content; }
      else contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
    }
    const body: Record<string, unknown> = { contents, generationConfig: { temperature } };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('google', apiKey);
      throw new AIProviderError({ provider: 'google', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'google', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Call NVIDIA NIM via their OpenAI-compatible API.
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Auth: Bearer <NVIDIA_API_KEY>
 * Docs: https://docs.api.nvidia.com/nim/reference/
 */
async function callNvidia(messages: AIMessage[], modelId: string, temperature = 0.5, timeoutMs = 30_000): Promise<string | null> {
  const apiKey = getProviderApiKey('nvidia');
  if (!apiKey) throw new AIProviderError({ provider: 'nvidia', model: modelId, kind: 'missing_key', message: 'Missing NVIDIA API key (set NVIDIA_API_KEY in Vercel env vars)' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      // 401/403 = key invalid → mark it down so rotation picks the next one
      if (res.status === 401 || res.status === 403) markKeyDown('nvidia', apiKey);
      throw new AIProviderError({
        provider: 'nvidia',
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
      provider: 'nvidia',
      model: modelId,
      kind: isTimeout ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- Public gateway ----

export async function callAI(
  messages: AIMessage[],
  modelId: string,
  temperature?: number
): Promise<string | null> {
  try {
    const provider = getProvider(modelId);
    switch (provider) {
      case 'glm':       return callGLM(messages, modelId);
      case 'openai':    return callOpenAI(messages, modelId, temperature);
      case 'anthropic': return callAnthropic(messages, modelId, temperature);
      case 'google':    return callGemini(messages, modelId, temperature);
      case 'nvidia':    return callNvidia(messages, modelId, temperature);
      default:          return callGLM(messages, modelId);
    }
  } catch (err) {
    console.warn(`AI call failed for ${modelId}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGLMVision(messages: any[], modelId: string, _timeoutMs = 35_000): Promise<string | null> {
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.createVision({ model: modelId, messages });
    return completion.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.warn(`GLM Vision ${modelId} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callOpenAIVision(messages: any[], modelId: string, timeoutMs = 30_000): Promise<string | null> {
  const apiKey = getProviderApiKey('openai');
  if (!apiKey) throw new AIProviderError({ provider: 'openai', model: modelId, kind: 'missing_key', message: 'Missing OpenAI API key' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages, temperature: 0 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text();
      throw new AIProviderError({ provider: 'openai', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'openai', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

export async function callAIVision(
  messages: unknown[],
  modelId: string,
  timeoutMs = 30_000
): Promise<string | null> {
  const provider = getProvider(modelId);
  if (provider === 'openai') return callOpenAIVision(messages, modelId, timeoutMs);
  const glmAttempt = await callGLMVision(messages, modelId, timeoutMs);
  if (glmAttempt) return glmAttempt;
  return callOpenAIVision(messages, 'gpt-4o-mini', timeoutMs);
}

// ---- Fallback chain & rotation ----

function hasProviderCredentials(provider: AIProvider): boolean {
  switch (provider) {
    case 'glm':       return Boolean(getProviderApiKey('glm') || process.env.ZAI_SDK_FALLBACK === '1');
    case 'openai':    return Boolean(getProviderApiKey('openai'));
    case 'anthropic': return Boolean(getProviderApiKey('anthropic'));
    case 'google':    return Boolean(getProviderApiKey('google'));
    case 'nvidia':    return Boolean(getProviderApiKey('nvidia'));
    default:          return false;
  }
}

// Priority order: NVIDIA first (free + high quality), then OpenAI, Anthropic, Gemini, GLM
const NVIDIA_MODEL_IDS = [...NVIDIA_MODELS].sort((a, b) => b.baseScore - a.baseScore).map((m) => m.id);
const OPENAI_MODELS    = ['gpt-4o-mini', 'gpt-4o'] as const;
const ANTHROPIC_MODELS = ['claude-haiku-4-20250414', 'claude-sonnet-4-20250514'] as const;
const GOOGLE_MODELS    = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;

const FALLBACK_MODEL_MAP: Record<string, string> = {
  // NVIDIA → NVIDIA fallbacks
  'mistralai/mistral-medium-3.5-128b': 'deepseek-ai/deepseek-r1-0528',
  'deepseek-ai/deepseek-r1-0528':      'moonshotai/kimi-k2-instruct',
  'moonshotai/kimi-k2-instruct':       'nvidia/llama-3.3-nemotron-super-49b-v1',
  // GLM fallbacks
  'glm-4-flash': 'glm-4-plus',
  'glm-4-plus':  'glm-4-flash',
  'glm-4-long':  'glm-4-plus',
  // Cross-provider
  'gpt-4o':                    'mistralai/mistral-medium-3.5-128b',
  'gpt-4o-mini':               'deepseek-ai/deepseek-r1-0528',
  'claude-sonnet-4-20250514':  'mistralai/mistral-medium-3.5-128b',
  'claude-haiku-4-20250414':   'deepseek-ai/deepseek-r1-0528',
  'gemini-2.5-flash':          'deepseek-ai/deepseek-r1-0528',
  'gemini-2.5-pro':            'mistralai/mistral-medium-3.5-128b',
};

function buildFallbackChain(primaryModel: string): string[] {
  const chain: string[] = [primaryModel];
  const directFallback = FALLBACK_MODEL_MAP[primaryModel];
  if (directFallback) chain.push(directFallback);

  // Always add all NVIDIA models (they are free + high quality)
  if (hasProviderCredentials('nvidia'))    chain.push(...NVIDIA_MODEL_IDS);
  if (hasProviderCredentials('openai'))    chain.push(...OPENAI_MODELS);
  if (hasProviderCredentials('anthropic')) chain.push(...ANTHROPIC_MODELS);
  if (hasProviderCredentials('google'))    chain.push(...GOOGLE_MODELS);
  // GLM is last-resort
  chain.push('glm-4-flash', 'glm-4-plus');

  return [...new Set(chain)].filter(Boolean);
}

let modelRotationIndex = 0;
const MODEL_ROTATION_ORDER: string[] = [
  ...NVIDIA_MODEL_IDS,
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  'glm-4-flash',
  'glm-4-plus',
  'glm-4-long',
];

export function getNextRotatingModel(preferredModel?: string): string {
  const seed = preferredModel || 'mistralai/mistral-medium-3.5-128b';
  const pool = [...MODEL_ROTATION_ORDER, ...buildFallbackChain(seed)];
  const enabled = [...new Set(pool)].filter((m) => hasProviderCredentials(getProvider(m)));
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
  // 'auto' → pick best model based on provider availability
  const resolved = modelId === 'auto' ? autoSelectModel('standard') : modelId;
  const candidates = buildFallbackChain(resolved);
  const failedProviders = new Set<AIProvider>();
  const diagnostics: AIProviderFailureDiagnostic[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const provider = getProvider(candidate);

    if (!hasProviderCredentials(provider)) continue;
    // For NVIDIA: each model is independent so don't skip the whole provider
    // after one model fails – just try the next model in the chain.
    if (provider !== 'nvidia' && failedProviders.has(provider)) continue;
    if (provider === 'nvidia' && !getProviderApiKey('nvidia')) continue;

    if (i > 0) console.warn(`[AI] Falling back from ${resolved} → ${candidate}`);

    try {
      let content: string | null = null;
      switch (provider) {
        case 'glm':       content = await callGLM(messages, candidate); break;
        case 'openai':    content = await callOpenAI(messages, candidate, temperature); break;
        case 'anthropic': content = await callAnthropic(messages, candidate, temperature); break;
        case 'google':    content = await callGemini(messages, candidate, temperature); break;
        case 'nvidia':    content = await callNvidia(messages, candidate, temperature); break;
        default:          content = await callGLM(messages, candidate);
      }
      if (content) return { content, model: candidate, provider };
      diagnostics.push({ provider, model: candidate, kind: 'provider_error', message: 'Empty response' });
      if (provider !== 'nvidia') failedProviders.add(provider);
    } catch (err) {
      if (err instanceof AIProviderError) diagnostics.push(err.diagnostic);
      else diagnostics.push({ provider, model: candidate, kind: 'unknown_error', message: err instanceof Error ? err.message : String(err) });
      if (provider !== 'nvidia') failedProviders.add(provider);
    }
  }

  throw new AIModelFailedError(diagnostics);
}

export function getRequiredEnvKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'glm':       return null;
    case 'openai':    return 'OPENAI_API_KEY';
    case 'anthropic': return 'ANTHROPIC_API_KEY';
    case 'google':    return 'GOOGLE_AI_API_KEY';
    case 'nvidia':    return 'NVIDIA_API_KEY';
    default:          return null;
  }
}
