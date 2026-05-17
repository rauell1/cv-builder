/**
 * Centralized AI Provider Module
 *
 * Supports:
 *   - GLM / Zhipu AI  (ZHIPU_API_KEY / GLM_API_KEY / BIGMODEL_API_KEY)
 *   - OpenAI          (OPENAI_API_KEY)
 *   - Anthropic       (ANTHROPIC_API_KEY)
 *   - Google Gemini   (GOOGLE_AI_API_KEY / GEMINI_API_KEY)
 *   - NVIDIA NIM      (NVIDIA_API_KEY)
 *
 * Speed optimizations:
 *   - callAIRace(): fires top-N models in parallel, returns first winner
 *   - Per-model timeouts tuned to each provider's actual p95 latency
 *   - Non-blocking background DB / cache writes throughout
 *   - NVIDIA gets individual per-model health (not whole-provider blackout)
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

const COOLDOWN_MS = 5 * 60_000; // 5 minutes

interface KeyHealth {
  key: string;
  status: 'healthy' | 'down';
  downSince?: number;
}

const keyHealthMap = new Map<AIProvider, KeyHealth[]>();

// Per-NVIDIA-model health (model id → down timestamp)
const nvidiaModelHealth = new Map<string, number>();

function initKeyHealth(provider: AIProvider, keys: string[]): void {
  if (!keyHealthMap.has(provider)) {
    keyHealthMap.set(provider, keys.map((k) => ({ key: k, status: 'healthy' })));
  }
}

function pickHealthyKey(provider: AIProvider): string | null {
  const pool = keyHealthMap.get(provider) ?? [];
  const now = Date.now();
  for (const entry of pool) {
    if (entry.status === 'down' && entry.downSince && now - entry.downSince >= COOLDOWN_MS) {
      entry.status = 'healthy';
    }
  }
  const healthy = pool.filter((e) => e.status === 'healthy');
  if (healthy.length === 0) return null;
  return healthy[Math.floor(Math.random() * healthy.length)].key;
}

function markKeyDown(provider: AIProvider, key: string): void {
  const pool = keyHealthMap.get(provider) ?? [];
  const entry = pool.find((e) => e.key === key);
  if (entry) { entry.status = 'down'; entry.downSince = Date.now(); }
}

function isNvidiaModelHealthy(modelId: string): boolean {
  const downSince = nvidiaModelHealth.get(modelId);
  if (!downSince) return true;
  if (Date.now() - downSince >= COOLDOWN_MS) {
    nvidiaModelHealth.delete(modelId);
    return true;
  }
  return false;
}

function markNvidiaModelDown(modelId: string): void {
  nvidiaModelHealth.set(modelId, Date.now());
}

// Background healer
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
    for (const [id, downSince] of nvidiaModelHealth.entries()) {
      if (now - downSince >= COOLDOWN_MS) nvidiaModelHealth.delete(id);
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
  if (getProviderApiKey('nvidia')) {
    switch (complexity) {
      case 'complex':  return 'mistralai/mistral-medium-3.5-128b';
      // ↓ Use a fast NVIDIA model for standard tasks to cut latency
      case 'standard': return 'nvidia/llama-3.3-nemotron-super-49b-v1';
      case 'simple':   return 'meta/llama-3.3-70b-instruct';
    }
  }
  switch (complexity) {
    case 'complex':  return 'glm-4-long';
    case 'standard': return 'glm-4-plus';
    case 'simple':   return 'glm-4-flash';
  }
}

// ---- NVIDIA NIM model registry ----

export interface NvidiaModelEntry {
  id: string;
  displayName: string;
  baseScore: number;
  contextWindow?: number;
  tags: string[];
  /** Typical cold-start latency bucket – used to tune per-model timeouts */
  speed: 'fast' | 'medium' | 'slow';
}

export const NVIDIA_MODELS: NvidiaModelEntry[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70b Instruct',
    baseScore: 0.82,
    contextWindow: 128_000,
    tags: ['general', 'cv', 'fast'],
    speed: 'fast',
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    displayName: 'Nemotron Super 49b',
    baseScore: 0.85,
    contextWindow: 128_000,
    tags: ['fast', 'cv'],
    speed: 'fast',
  },
  {
    id: 'deepseek-ai/deepseek-r1-0528',
    displayName: 'DeepSeek-R1-0528',
    baseScore: 0.93,
    contextWindow: 64_000,
    tags: ['reasoning', 'coding', 'cv'],
    speed: 'medium',
  },
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    displayName: 'Mistral Medium 3.5 128b',
    baseScore: 0.95,
    contextWindow: 128_000,
    tags: ['coding', 'agentic', 'cv'],
    speed: 'medium',
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    displayName: 'Kimi K2 Instruct',
    baseScore: 0.91,
    contextWindow: 128_000,
    tags: ['multimodal', 'coding', 'cv'],
    speed: 'medium',
  },
  {
    id: '01-ai/yi-large',
    displayName: 'Yi Large',
    baseScore: 0.88,
    contextWindow: 32_000,
    tags: ['general', 'cv'],
    speed: 'medium',
  },
  {
    id: 'qwen/qwen3-235b-a22b',
    displayName: 'Qwen3 235b-A22b',
    baseScore: 0.80,
    contextWindow: 32_000,
    tags: ['reasoning', 'cv'],
    speed: 'slow',
  },
];

/** Timeout per model speed bucket */
function modelTimeout(modelId: string): number {
  const entry = NVIDIA_MODELS.find((m) => m.id === modelId);
  if (entry) {
    if (entry.speed === 'fast')   return 15_000;
    if (entry.speed === 'medium') return 25_000;
    return 40_000; // slow
  }
  // Defaults for non-NVIDIA models
  if (modelId.startsWith('gpt-'))     return 20_000;
  if (modelId.startsWith('claude-'))  return 25_000;
  if (modelId.startsWith('gemini-'))  return 20_000;
  if (modelId.startsWith('glm-'))     return 15_000;
  return 30_000;
}

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

async function callOpenAI(messages: AIMessage[], modelId: string, temperature = 0.3): Promise<string | null> {
  const apiKey = getProviderApiKey('openai');
  if (!apiKey) throw new AIProviderError({ provider: 'openai', model: modelId, kind: 'missing_key', message: 'Missing OpenAI API key' });
  const timeout = modelTimeout(modelId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages, temperature }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('openai', apiKey);
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

async function callAnthropic(messages: AIMessage[], modelId: string, temperature = 0.3): Promise<string | null> {
  const apiKey = getProviderApiKey('anthropic');
  if (!apiKey) throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: 'missing_key', message: 'Missing Anthropic API key' });
  const timeout = modelTimeout(modelId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
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
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('anthropic', apiKey);
      throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'anthropic', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

async function callGemini(messages: AIMessage[], modelId: string, temperature = 0.3): Promise<string | null> {
  const apiKey = getProviderApiKey('google');
  if (!apiKey) throw new AIProviderError({ provider: 'google', model: modelId, kind: 'missing_key', message: 'Missing Google AI API key' });
  const timeout = modelTimeout(modelId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
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
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) markKeyDown('google', apiKey);
      throw new AIProviderError({ provider: 'google', model: modelId, kind: 'http_error', status: res.status, message: errText.substring(0, 400) || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof AIProviderError) throw err;
    const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
    throw new AIProviderError({ provider: 'google', model: modelId, kind: isTimeout ? 'timeout' : 'network_error', message: err instanceof Error ? err.message : String(err) });
  }
}

async function callNvidia(
  messages: AIMessage[],
  modelId: string,
  temperature = 0.3,
  timeoutMs?: number
): Promise<string | null> {
  // Per-model health check (NVIDIA models are independent)
  if (!isNvidiaModelHealthy(modelId)) {
    throw new AIProviderError({
      provider: 'nvidia',
      model: modelId,
      kind: 'provider_error',
      message: `Model ${modelId} is in cooldown`,
    });
  }

  const apiKey = getProviderApiKey('nvidia');
  if (!apiKey) throw new AIProviderError({ provider: 'nvidia', model: modelId, kind: 'missing_key', message: 'Missing NVIDIA API key (set NVIDIA_API_KEY in Vercel env vars)' });

  const timeout = timeoutMs ?? modelTimeout(modelId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

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
      if (res.status === 401 || res.status === 403) {
        markKeyDown('nvidia', apiKey);
        markNvidiaModelDown(modelId);
      } else if (res.status === 429 || res.status >= 500) {
        // Rate-limited or server error → cool down just this model
        markNvidiaModelDown(modelId);
      }
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
    if (isTimeout) markNvidiaModelDown(modelId); // timed-out model gets cooled down too
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

// Sorted fast-first: fast NVIDIA models first, then medium, then slow, then others
const NVIDIA_MODEL_IDS_FAST_FIRST = [...NVIDIA_MODELS]
  .sort((a, b) => {
    const speedOrder = { fast: 0, medium: 1, slow: 2 };
    const speedDiff = speedOrder[a.speed] - speedOrder[b.speed];
    return speedDiff !== 0 ? speedDiff : b.baseScore - a.baseScore;
  })
  .map((m) => m.id);

// Score-first (quality priority) for complex tasks
const NVIDIA_MODEL_IDS_QUALITY_FIRST = [...NVIDIA_MODELS]
  .sort((a, b) => b.baseScore - a.baseScore)
  .map((m) => m.id);

const OPENAI_MODELS    = ['gpt-4o-mini', 'gpt-4o'] as const;
const ANTHROPIC_MODELS = ['claude-haiku-4-20250414', 'claude-sonnet-4-20250514'] as const;
const GOOGLE_MODELS    = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;

// ---- Task-specific model routing ----

export type AITaskType = 'parse' | 'analyze' | 'restructure' | 'general';

/**
 * Preferred model order per task type — filter to available providers at call time.
 *
 * parse       → speed first: fast JSON extraction, low latency
 * analyze     → reasoning + speed: keyword/requirement analysis
 * restructure → quality first: professional CV writing
 * general     → balanced default
 */
export const TASK_MODEL_PREFERENCES: Record<AITaskType, readonly string[]> = {
  parse: [
    // Fast NVIDIA models with reliable structured output
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'glm-4-flash',                            // always-on fast fallback
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'claude-haiku-4-20250414',
    'mistralai/mistral-medium-3.5-128b',
    'glm-4-plus',
  ],
  analyze: [
    // Fast models first — job analysis is structured JSON extraction, not reasoning
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'meta/llama-3.3-70b-instruct',
    'glm-4-plus',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'mistralai/mistral-medium-3.5-128b',
    'moonshotai/kimi-k2-instruct',
    'claude-haiku-4-20250414',
    'glm-4-flash',
    'deepseek-ai/deepseek-r1-0528',  // slow reasoning model — last resort only
  ],
  restructure: [
    // Quality writing models first — latency tradeoff is justified here
    'claude-sonnet-4-20250514',
    'gpt-4o',
    'mistralai/mistral-medium-3.5-128b',      // best free-tier quality
    'gemini-2.5-pro',
    'moonshotai/kimi-k2-instruct',            // long context, quality
    'deepseek-ai/deepseek-r1-0528',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'claude-haiku-4-20250414',
    'meta/llama-3.3-70b-instruct',
    'glm-4-plus',
    'glm-4-long',
    'glm-4-flash',
  ],
  general: NVIDIA_MODEL_IDS_FAST_FIRST,
};

/** Returns the ordered preference list for a task. */
export function getPreferredModelsForTask(task: AITaskType): readonly string[] {
  return TASK_MODEL_PREFERENCES[task];
}

/** Returns the best currently-healthy model available for the given task. */
export function pickBestModelForTask(task: AITaskType): string {
  for (const modelId of TASK_MODEL_PREFERENCES[task]) {
    const provider = getProvider(modelId);
    if (!hasProviderCredentials(provider)) continue;
    if (provider === 'nvidia' && !isNvidiaModelHealthy(modelId)) continue;
    return modelId;
  }
  // GLM is the unconditional safety net (ZAI SDK or API key)
  return hasProviderCredentials('glm') || process.env.ZAI_SDK_FALLBACK === '1'
    ? 'glm-4-flash'
    : 'glm-4-flash'; // will error gracefully if truly no key
}

/**
 * Task-aware AI race — uses the task-specific model preference chain instead of
 * the global rotation list. Races raceCount models in parallel, falls back
 * sequentially through the rest. GLM safety-nets are always appended.
 *
 * @param hintModel  Optional model to place first (e.g. user-selected model in UI).
 */
export async function callAIRaceForTask(
  task: AITaskType,
  messages: AIMessage[],
  raceCount = 2,
  temperature?: number,
  hintModel?: string,
): Promise<AIResponse> {
  const prefs = [...TASK_MODEL_PREFERENCES[task]];

  // Respect caller hint by inserting it at position 0 (deduplicated)
  if (hintModel && !prefs.includes(hintModel)) prefs.unshift(hintModel);
  else if (hintModel) {
    const idx = prefs.indexOf(hintModel);
    if (idx > 0) { prefs.splice(idx, 1); prefs.unshift(hintModel); }
  }

  // Filter to healthy, available models
  const eligible: string[] = prefs.filter((m) => {
    const p = getProvider(m);
    if (!hasProviderCredentials(p)) return false;
    if (p === 'nvidia' && !isNvidiaModelHealthy(m)) return false;
    return true;
  });

  // Always append GLM safety nets at end if not already present
  for (const glmId of ['glm-4-flash', 'glm-4-plus']) {
    if (!eligible.includes(glmId) && hasProviderCredentials('glm')) {
      eligible.push(glmId);
    }
  }

  if (eligible.length === 0) {
    throw new AIModelFailedError([{
      provider: 'glm', model: 'glm-4-flash', kind: 'missing_key',
      message: 'No eligible models for task. Configure at least one provider API key.',
    }]);
  }

  const callModel = async (modelId: string): Promise<AIResponse> => {
    const provider = getProvider(modelId);
    let content: string | null = null;
    switch (provider) {
      case 'nvidia':    content = await callNvidia(messages, modelId, temperature); break;
      case 'openai':    content = await callOpenAI(messages, modelId, temperature); break;
      case 'anthropic': content = await callAnthropic(messages, modelId, temperature); break;
      case 'google':    content = await callGemini(messages, modelId, temperature); break;
      default:          content = await callGLM(messages, modelId); break;
    }
    if (!content) throw new Error(`Empty response from ${modelId}`);
    return { content, model: modelId, provider };
  };

  const racers = eligible.slice(0, Math.min(raceCount, eligible.length));
  try {
    return await Promise.any(racers.map(callModel));
  } catch {
    // All racers failed — sequential fallback through the rest
    const remaining = eligible.slice(racers.length);
    const diagnostics: AIProviderFailureDiagnostic[] = [];
    for (const modelId of remaining) {
      const provider = getProvider(modelId);
      try {
        return await callModel(modelId);
      } catch (err) {
        if (err instanceof AIProviderError) diagnostics.push(err.diagnostic);
        else diagnostics.push({ provider, model: modelId, kind: 'unknown_error', message: err instanceof Error ? err.message : String(err) });
      }
    }
    throw new AIModelFailedError(diagnostics);
  }
}

const FALLBACK_MODEL_MAP: Record<string, string> = {
  'mistralai/mistral-medium-3.5-128b': 'deepseek-ai/deepseek-r1-0528',
  'deepseek-ai/deepseek-r1-0528':      'moonshotai/kimi-k2-instruct',
  'moonshotai/kimi-k2-instruct':       'nvidia/llama-3.3-nemotron-super-49b-v1',
  'glm-4-flash': 'glm-4-plus',
  'glm-4-plus':  'glm-4-flash',
  'glm-4-long':  'glm-4-plus',
  'gpt-4o':                    'mistralai/mistral-medium-3.5-128b',
  'gpt-4o-mini':               'nvidia/llama-3.3-nemotron-super-49b-v1',
  'claude-sonnet-4-20250514':  'mistralai/mistral-medium-3.5-128b',
  'claude-haiku-4-20250414':   'nvidia/llama-3.3-nemotron-super-49b-v1',
  'gemini-2.5-flash':          'nvidia/llama-3.3-nemotron-super-49b-v1',
  'gemini-2.5-pro':            'mistralai/mistral-medium-3.5-128b',
};

function buildFallbackChain(
  primaryModel: string,
  complexity: 'simple' | 'standard' | 'complex' = 'standard'
): string[] {
  const chain: string[] = [primaryModel];
  const directFallback = FALLBACK_MODEL_MAP[primaryModel];
  if (directFallback) chain.push(directFallback);

  // For complex tasks, prefer quality; for simple/standard prefer speed
  const nvidiaOrder =
    complexity === 'complex'
      ? NVIDIA_MODEL_IDS_QUALITY_FIRST
      : NVIDIA_MODEL_IDS_FAST_FIRST;

  if (hasProviderCredentials('nvidia'))    chain.push(...nvidiaOrder);
  if (hasProviderCredentials('openai'))    chain.push(...OPENAI_MODELS);
  if (hasProviderCredentials('anthropic')) chain.push(...ANTHROPIC_MODELS);
  if (hasProviderCredentials('google'))    chain.push(...GOOGLE_MODELS);
  chain.push('glm-4-flash', 'glm-4-plus');

  return [...new Set(chain)].filter(Boolean);
}

let modelRotationIndex = 0;
const MODEL_ROTATION_ORDER: string[] = [
  // Fast NVIDIA first in rotation
  ...NVIDIA_MODEL_IDS_FAST_FIRST,
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  'glm-4-flash',
  'glm-4-plus',
  'glm-4-long',
];

export function getNextRotatingModel(preferredModel?: string): string {
  const seed = preferredModel || 'nvidia/llama-3.3-nemotron-super-49b-v1';
  const pool = [...MODEL_ROTATION_ORDER, ...buildFallbackChain(seed)];
  const enabled = [...new Set(pool)].filter((m) => hasProviderCredentials(getProvider(m)));
  if (enabled.length === 0) return seed;
  const idx = modelRotationIndex % enabled.length;
  modelRotationIndex = (modelRotationIndex + 1) % enabled.length;
  return enabled[idx];
}

/**
 * Race the top-N fastest available models in parallel.
 * Returns the first non-empty response. Falls back to sequential chain on
 * total failure.
 *
 * @param raceCount  How many models to race simultaneously (default 2)
 */
export async function callAIRace(
  messages: AIMessage[],
  primaryModel: string,
  complexity: 'simple' | 'standard' | 'complex' = 'standard',
  raceCount = 2,
  temperature?: number
): Promise<AIResponse> {
  const chain = buildFallbackChain(primaryModel, complexity);
  const eligible = chain.filter((m) => {
    const p = getProvider(m);
    if (!hasProviderCredentials(p)) return false;
    if (p === 'nvidia' && !isNvidiaModelHealthy(m)) return false;
    return true;
  });

  if (eligible.length === 0) {
    throw new AIModelFailedError([{ provider: getProvider(primaryModel), model: primaryModel, kind: 'missing_key', message: 'No eligible models' }]);
  }

  // Only race up to raceCount models
  const racers = eligible.slice(0, Math.min(raceCount, eligible.length));

  const racePromises = racers.map((modelId) => {
    const provider = getProvider(modelId);
    const callFn = async (): Promise<AIResponse> => {
      let content: string | null = null;
      switch (provider) {
        case 'nvidia':    content = await callNvidia(messages, modelId, temperature); break;
        case 'openai':    content = await callOpenAI(messages, modelId, temperature); break;
        case 'anthropic': content = await callAnthropic(messages, modelId, temperature); break;
        case 'google':    content = await callGemini(messages, modelId, temperature); break;
        default:          content = await callGLM(messages, modelId); break;
      }
      if (!content) throw new Error(`Empty response from ${modelId}`);
      return { content, model: modelId, provider };
    };
    return callFn();
  });

  try {
    // Promise.any() returns the first fulfilled promise
    return await Promise.any(racePromises);
  } catch {
    // All racers failed – fall back to sequential chain starting after the racers
    const remaining = eligible.slice(racers.length);
    const diagnostics: AIProviderFailureDiagnostic[] = [];
    for (const modelId of remaining) {
      const provider = getProvider(modelId);
      try {
        let content: string | null = null;
        switch (provider) {
          case 'nvidia':    content = await callNvidia(messages, modelId, temperature); break;
          case 'openai':    content = await callOpenAI(messages, modelId, temperature); break;
          case 'anthropic': content = await callAnthropic(messages, modelId, temperature); break;
          case 'google':    content = await callGemini(messages, modelId, temperature); break;
          default:          content = await callGLM(messages, modelId); break;
        }
        if (content) return { content, model: modelId, provider };
        diagnostics.push({ provider, model: modelId, kind: 'provider_error', message: 'Empty response' });
      } catch (err) {
        if (err instanceof AIProviderError) diagnostics.push(err.diagnostic);
        else diagnostics.push({ provider, model: modelId, kind: 'unknown_error', message: err instanceof Error ? err.message : String(err) });
      }
    }
    throw new AIModelFailedError(diagnostics);
  }
}

export async function callAIWithFallback(
  messages: AIMessage[],
  modelId: string,
  complexity?: 'simple' | 'standard' | 'complex',
  temperature?: number
): Promise<AIResponse> {
  const resolved = modelId === 'auto' ? autoSelectModel(complexity ?? 'standard') : modelId;
  const effectiveComplexity = complexity ?? 'standard';
  const candidates = buildFallbackChain(resolved, effectiveComplexity);
  const failedProviders = new Set<AIProvider>();
  const diagnostics: AIProviderFailureDiagnostic[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const provider = getProvider(candidate);

    if (!hasProviderCredentials(provider)) continue;
    if (provider !== 'nvidia' && failedProviders.has(provider)) continue;
    if (provider === 'nvidia') {
      if (!getProviderApiKey('nvidia')) continue;
      if (!isNvidiaModelHealthy(candidate)) continue;
    }

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
