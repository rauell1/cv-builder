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
  nvidia: [
    'NVIDIA_API_KEY',
    'NVIDIA_NIM_API_KEY',
    'NVIDIA_DEEPSEEK_KEYS',
    'NVIDIA_GLM5_KEYS',
    'NVIDIA_NEMO_KEYS',
    'NVIDIA_MISTRAL_KEYS',
    'NVIDIA_KIMI_KEYS'
  ],
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

function hasNvidiaCredentials(): boolean {
  return Boolean(
    getProviderApiKey('nvidia') ||
    readEnvValue('NVIDIA_DEEPSEEK_KEYS') ||
    readEnvValue('NVIDIA_GLM5_KEYS') ||
    readEnvValue('NVIDIA_NEMO_KEYS') ||
    readEnvValue('NVIDIA_MISTRAL_KEYS') ||
    readEnvValue('NVIDIA_KIMI_KEYS')
  );
}

export function hasAnyProviderCredentials(): boolean {
  return (
    hasNvidiaCredentials() ||
    Boolean(getProviderApiKey('glm')) ||
    Boolean(getProviderApiKey('openai')) ||
    Boolean(getProviderApiKey('anthropic')) ||
    Boolean(getProviderApiKey('google')) ||
    process.env.ZAI_SDK_FALLBACK === '1'
  );
}

export function getProviderCredentialStatus(): Record<AIProvider, boolean> {
  return {
    nvidia: hasNvidiaCredentials(),
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
  if (
    modelId.startsWith('nvidia/') || modelId.startsWith('z-ai/') || modelId.startsWith('deepseek/') ||
    modelId.startsWith('meta/') || modelId.startsWith('mistralai/') || modelId.startsWith('deepseek-ai/') ||
    modelId.startsWith('moonshotai/') || modelId.startsWith('qwen/')
  ) return 'nvidia';
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
  // Consolidating on deepseek/deepseek-v4-pro for all writing and restructuring tasks.
  return 'deepseek/deepseek-v4-pro';
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

async function callGLM(messages: AIMessage[], modelId: string, timeoutMs = 30_000): Promise<string | null> {
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

async function callOpenAI(messages: AIMessage[], modelId: string, temperature = 0.5, timeoutMs = 30_000): Promise<string | null> {
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
      body: JSON.stringify({ model: modelId, messages, temperature }),
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

async function callAnthropic(messages: AIMessage[], modelId: string, temperature = 0.5, timeoutMs = 30_000): Promise<string | null> {
  const apiKey = getProviderApiKey('anthropic');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'anthropic',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing Anthropic API key',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      signal: controller.signal,
    });
    clearTimeout(timer);
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
    clearTimeout(timer);
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

async function callGemini(messages: AIMessage[], modelId: string, temperature = 0.5, timeoutMs = 30_000): Promise<string | null> {
  const apiKey = getProviderApiKey('google');
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'google',
      model: modelId,
      kind: 'missing_key',
      message: 'Missing Google AI API key',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      // maxOutputTokens bounds generation time, mirroring the max_tokens cap
      // applied to NVIDIA calls — keeps this last-resort path fast and cheap.
      generationConfig: { temperature, maxOutputTokens: 4096 },
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
        signal: controller.signal,
      }
    );

    // Do NOT clear the abort timer until the body is fully read — the same
    // fetch()-resolves-on-headers pitfall that hung NVIDIA calls applies here.
    if (!res.ok) {
      const errText = await res.text();
      clearTimeout(timer);
      throw new AIProviderError({
        provider: 'google',
        model: modelId,
        kind: 'http_error',
        status: res.status,
        message: errText.substring(0, 400) || `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    clearTimeout(timer);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    clearTimeout(timer);
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

// Registry model ids → real NVIDIA NIM catalog ids.
// integrate.api.nvidia.com returns a plain "404 page not found" for unknown
// model ids, which is exactly what production logs showed for these names.
// The alias keeps UI/registry names stable while sending valid ids upstream.
//
// Verified from inside Vercel via /api/nvidia-diag (2026-07-08):
//   mistralai/mistral-medium-3.5-128b        -> 200 in ~405ms
//   nvidia/llama-3.3-nemotron-super-49b-v1   -> 200 in ~599ms
//   meta/llama-3.1-8b-instruct               -> 200 in ~283ms
//   meta/llama-3.3-70b-instruct              -> HANGS (free-tier queue) — do not use
const NVIDIA_MODEL_ALIASES: Record<string, string> = {
  'deepseek/deepseek-v4-pro': 'mistralai/mistral-medium-3.5-128b',
  'z-ai/glm-5.2': 'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/nemotron-3-ultra-550b-a55b': 'meta/llama-3.1-8b-instruct',
  'nvidia/nemotron-ocr-v2': 'meta/llama-3.2-90b-vision-instruct',
};

function resolveNvidiaParams(modelId: string): { url: string; modelName: string; apiKeys: string[] } {
  let url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  let modelName = NVIDIA_MODEL_ALIASES[modelId] ?? modelId;
  let specificKeysStr: string | null = null;

  if (modelId.includes('glm-5.2') || modelId.includes('glm5')) {
    if (process.env.NVIDIA_GLM5_URL) url = process.env.NVIDIA_GLM5_URL;
    specificKeysStr = readEnvValue('NVIDIA_GLM5_KEYS');
  } else if (modelId.includes('nemotron') || modelId.includes('nemo')) {
    if (process.env.NVIDIA_NEMO_URL) url = process.env.NVIDIA_NEMO_URL;
    if (process.env.NVIDIA_NEMO_MODEL) modelName = process.env.NVIDIA_NEMO_MODEL;
    specificKeysStr = readEnvValue('NVIDIA_NEMO_KEYS');
  } else if (modelId.includes('deepseek')) {
    if (process.env.NVIDIA_DEEPSEEK_URL) url = process.env.NVIDIA_DEEPSEEK_URL;
    if (process.env.NVIDIA_DEEPSEEK_MODEL) modelName = process.env.NVIDIA_DEEPSEEK_MODEL;
    specificKeysStr = readEnvValue('NVIDIA_DEEPSEEK_KEYS');
  } else if (modelId.includes('kimi')) {
    if (process.env.NVIDIA_KIMI_URL) url = process.env.NVIDIA_KIMI_URL;
    if (process.env.NVIDIA_KIMI_MODEL) modelName = process.env.NVIDIA_KIMI_MODEL;
    specificKeysStr = readEnvValue('NVIDIA_KIMI_KEYS');
  } else if (modelId.includes('mistral')) {
    if (process.env.NVIDIA_MISTRAL_URL) url = process.env.NVIDIA_MISTRAL_URL;
    if (process.env.NVIDIA_MISTRAL_MODEL) modelName = process.env.NVIDIA_MISTRAL_MODEL;
    specificKeysStr = readEnvValue('NVIDIA_MISTRAL_KEYS');
  }

  const apiKeys: string[] = [];

  // 1. Add model-specific keys first if configured
  if (specificKeysStr) {
    const parsed = specificKeysStr.split(',').map(k => k.trim()).filter(Boolean);
    apiKeys.push(...parsed);
  }

  // 2. Add general NVIDIA keys as fallback
  const generalKeysStr = getProviderApiKey('nvidia');
  if (generalKeysStr) {
    const parsed = generalKeysStr.split(',').map(k => k.trim()).filter(Boolean);
    apiKeys.push(...parsed);
  }

  // Remove duplicates while preserving order
  const uniqueApiKeys = [...new Set(apiKeys)];

  // Ensure url ends with /chat/completions if it's just a base URL
  if (url && !url.endsWith('/chat/completions') && !url.endsWith('/completions')) {
    if (url.endsWith('/v1') || url.endsWith('/v1/')) {
      url = url.replace(/\/+$/, '') + '/chat/completions';
    } else {
      url = url.replace(/\/+$/, '') + '/v1/chat/completions';
    }
  }

  return { url, modelName, apiKeys: uniqueApiKeys };
}

async function callNvidia(messages: AIMessage[], modelId: string, temperature = 0.5, timeoutMs = 30_000): Promise<string | null> {
  const { url, modelName, apiKeys } = resolveNvidiaParams(modelId);

  if (apiKeys.length === 0) {
    throw new AIProviderError({
      provider: 'nvidia',
      model: modelId,
      kind: 'missing_key',
      message: `Missing API key for ${modelId}. Configure NVIDIA_API_KEY or model-specific keys (e.g., NVIDIA_DEEPSEEK_KEYS).`,
    });
  }

  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // max_tokens bounds generation time — without it, long restructure
        // outputs can generate past every timeout on the free NIM tier.
        body: JSON.stringify({ model: modelName, messages, temperature, max_tokens: 4096 }),
        signal: controller.signal,
      });

      // IMPORTANT: do NOT clear the abort timer here. fetch() resolves when
      // response HEADERS arrive, but NIM streams the body as it generates —
      // res.json() below can take far longer than the headers. Clearing the
      // timer here made the body read unbounded, hanging routes for minutes.

      if (!res.ok) {
        const errText = await res.text();
        clearTimeout(timer);
        const snippet = errText.substring(0, 400);

        // If 401, 403, or 429, retry with the next key if available
        if ((res.status === 401 || res.status === 403 || res.status === 429) && i < apiKeys.length - 1) {
          console.warn(`[AI] NVIDIA key ${i + 1}/${apiKeys.length} failed with status ${res.status}. Trying next key...`);
          lastError = new AIProviderError({
            provider: 'nvidia',
            model: modelId,
            kind: 'http_error',
            status: res.status,
            message: snippet || `HTTP ${res.status}`,
          });
          continue;
        }

        throw new AIProviderError({
          provider: 'nvidia',
          model: modelId,
          kind: 'http_error',
          status: res.status,
          message: snippet || `HTTP ${res.status}`,
        });
      }

      const data = await res.json(); // still covered by the abort signal
      clearTimeout(timer);
      return data.choices?.[0]?.message?.content || null;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof AIProviderError) {
        lastError = err;
        if ((err.diagnostic.status === 401 || err.diagnostic.status === 403 || err.diagnostic.status === 429) && i < apiKeys.length - 1) {
          continue;
        }
        throw err;
      }
      
      const isTimeout = err instanceof Error && /aborted|abort|timeout/i.test(err.message);
      lastError = new AIProviderError({
        provider: 'nvidia',
        model: modelId,
        kind: isTimeout ? 'timeout' : 'network_error',
        message: err instanceof Error ? err.message : String(err),
      });

      // A timeout is a model/endpoint problem, not a key problem — rotating
      // keys would silently burn N x timeoutMs inside a single model attempt
      // and starve the fallback chain. Fail fast so the chain moves on.
      if (isTimeout) {
        console.warn(`[AI] NVIDIA ${modelId} timed out after ${timeoutMs}ms on key ${i + 1}/${apiKeys.length} — not rotating keys`);
        throw lastError;
      }

      if (i < apiKeys.length - 1) {
        console.warn(`[AI] NVIDIA key ${i + 1}/${apiKeys.length} network error for ${modelId}. Trying next key...`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('All NVIDIA keys failed');
}

// ---- Public Gateway ----

export async function callAI(
  messages: AIMessage[],
  modelId: string,
  temperature?: number,
  timeoutMs?: number
): Promise<string | null> {
  try {
    const provider = getProvider(modelId);
    switch (provider) {
      case 'nvidia': return callNvidia(messages, modelId, temperature, timeoutMs);
      case 'glm': return callGLM(messages, modelId, timeoutMs);
      case 'openai': return callOpenAI(messages, modelId, temperature, timeoutMs);
      case 'anthropic': return callAnthropic(messages, modelId, temperature, timeoutMs);
      case 'google': return callGemini(messages, modelId, temperature, timeoutMs);
      default: return callGLM(messages, modelId, timeoutMs);
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

  if (provider === 'nvidia') {
    return callNvidia(messages as AIMessage[], modelId);
  }

  if (provider === 'openai') {
    return callOpenAIVision(messages, modelId, timeoutMs);
  }

  const glmAttempt = await callGLMVision(messages, modelId, timeoutMs);
  if (glmAttempt) return glmAttempt;

  // Fallback to OpenAI vision when GLM vision is unavailable or fails.
  return callOpenAIVision(messages, 'gpt-4o-mini', timeoutMs);
}

const FALLBACK_MODEL_MAP: Record<string, string> = {
  'nvidia/nemotron-ocr-v2': 'nvidia/nemotron-3-ultra-550b-a55b',
  'z-ai/glm-5.2': 'deepseek/deepseek-v4-pro',
  'nvidia/nemotron-3-ultra-550b-a55b': 'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-pro': 'nvidia/nemotron-3-ultra-550b-a55b',
};

const NVIDIA_MODELS = [
  'nvidia/nemotron-ocr-v2',
  'z-ai/glm-5.2',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'deepseek/deepseek-v4-pro',
] as const;

const NVIDIA_TEXT_MODELS = [
  'deepseek/deepseek-v4-pro',
  'z-ai/glm-5.2',
  'nvidia/nemotron-3-ultra-550b-a55b',
] as const;

const MODEL_ROTATION_ORDER = [
  'deepseek/deepseek-v4-pro',
  'z-ai/glm-5.2',
  'nvidia/nemotron-3-ultra-550b-a55b',
] as const;

// Cross-provider redundancy safety net. Gemini 2.5 Flash has a genuine free
// tier via Google AI Studio (aistudio.google.com/apikey — NOT a billed Vertex
// AI project). Deliberately kept OUT of MODEL_ROTATION_ORDER/NVIDIA_TEXT_MODELS
// and appended only inside callAIWithFallback() (not buildFallbackChain()), so
// it never becomes a *starting* model via getNextRotatingModel(). That keeps
// it purely as a last-resort fallback for a full NVIDIA outage — like the one
// this app already hit once — instead of spending its low free-tier quota
// (RPM/RPD limits) on ordinary traffic.
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';

let modelRotationIndex = 0;

function hasProviderCredentials(provider: AIProvider): boolean {
  switch (provider) {
    case 'nvidia':
      return hasNvidiaCredentials();
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
    case 'nvidia':
      return [...NVIDIA_TEXT_MODELS];
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

  if (hasProviderCredentials('nvidia')) {
    chain.push(...NVIDIA_TEXT_MODELS);
  }

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
  complexity?: 'simple' | 'standard' | 'complex',
  temperature?: number,
  timeoutMs?: number
): Promise<AIResponse> {
  const candidates = buildFallbackChain(modelId);

  // Last-resort cross-provider redundancy — see GEMINI_FALLBACK_MODEL comment.
  // Appended here (not in buildFallbackChain) so getNextRotatingModel() never
  // picks it as a starting model.
  if (!candidates.includes(GEMINI_FALLBACK_MODEL)) {
    candidates.push(GEMINI_FALLBACK_MODEL);
  }

  const diagnostics: AIProviderFailureDiagnostic[] = [];

  const perModelTimeoutMs = timeoutMs ?? (
    complexity === 'simple' ? 25_000 :
    complexity === 'complex' ? 45_000 :
    30_000
  );

  // Total wall-clock budget for the whole chain. Keeps the chain inside the
  // Vercel 60s maxDuration window (with headroom for JSON parsing + response)
  // instead of letting 3-4 sequential model timeouts add up to 100s+.
  const TOTAL_BUDGET_MS = 45_000;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const chainStart = Date.now();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const provider = getProvider(candidate);

    if (!hasProviderCredentials(provider)) {
      continue;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs < 3_000) {
      diagnostics.push({
        provider,
        model: candidate,
        kind: 'timeout',
        message: `Chain budget exhausted (${Date.now() - chainStart}ms elapsed) before trying ${candidate}`,
      });
      break;
    }
    const effectiveTimeoutMs = Math.min(perModelTimeoutMs, remainingMs);

    if (i > 0) {
      console.warn(`[AI] Model ${modelId} failed, trying fallback ${candidate} (${remainingMs}ms budget left)`);
    }
    console.warn(`[AI] Attempt ${i + 1}: ${candidate} (timeout ${effectiveTimeoutMs}ms, elapsed ${Date.now() - chainStart}ms)`);

    try {
      // Call provider functions without swallowing errors so we can surface diagnostics.
      let content: string | null = null;
      switch (provider) {
        case 'nvidia':
          content = await callNvidia(messages, candidate, temperature, effectiveTimeoutMs);
          break;
        case 'glm':
          content = await callGLM(messages, candidate, effectiveTimeoutMs);
          break;
        case 'openai':
          content = await callOpenAI(messages, candidate, temperature, effectiveTimeoutMs);
          break;
        case 'anthropic':
          content = await callAnthropic(messages, candidate, temperature, effectiveTimeoutMs);
          break;
        case 'google':
          content = await callGemini(messages, candidate, temperature, effectiveTimeoutMs);
          break;
        default:
          content = await callGLM(messages, candidate, effectiveTimeoutMs);
      }

      if (content) {
        console.warn(`[AI] ${candidate} succeeded in ${Date.now() - chainStart}ms total`);
        return { content, model: candidate, provider };
      }

      diagnostics.push({
        provider,
        model: candidate,
        kind: 'provider_error',
        message: 'Empty response',
      });
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
    }
  }

  throw new AIModelFailedError(diagnostics);
}

export function getRequiredEnvKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'nvidia': return 'NVIDIA_API_KEY';
    case 'glm': return null;
    case 'openai': return 'OPENAI_API_KEY';
    case 'anthropic': return 'ANTHROPIC_API_KEY';
    case 'google': return 'GOOGLE_AI_API_KEY';
    default: return null;
  }
}
