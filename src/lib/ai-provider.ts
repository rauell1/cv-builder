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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) return null;

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
      console.warn(`Zhipu AI REST API error (status ${res.status}):`, errText.substring(0, 200));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    console.warn('Zhipu AI REST API call failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function callGLM(messages: AIMessage[], modelId: string, timeoutMs = 15_000): Promise<string | null> {
  // Prefer direct REST API when ZHIPU_API_KEY is set (works in all environments).
  const zhipuKey = process.env.ZHIPU_API_KEY;
  if (zhipuKey) {
    const result = await callGLMviaAPI(messages, modelId, timeoutMs);
    if (result) return result;
    // Fall through to SDK if REST API fails
  }

  // Fall back to z-ai-web-dev-sdk (only works in Z.ai environment).
  return callGLMviaSDK(messages, modelId, timeoutMs);
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

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
      console.warn(`OpenAI Vision ${modelId} error:`, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`OpenAI Vision model ${modelId} failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function callOpenAI(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

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
      console.warn(`OpenAI ${modelId} error:`, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.warn(`OpenAI model ${modelId} failed:`, err);
    return null;
  }
}

async function callAnthropic(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

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
      console.warn(`Anthropic ${modelId} error:`, await res.text());
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.warn(`Anthropic model ${modelId} failed:`, err);
    return null;
  }
}

async function callGemini(messages: AIMessage[], modelId: string, temperature = 0.5): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

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
      console.warn(`Gemini ${modelId} error:`, await res.text());
      return null;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.warn(`Gemini model ${modelId} failed:`, err);
    return null;
  }
}

// ---- Public Gateway ----

export async function callAI(
  messages: AIMessage[],
  modelId: string,
  temperature?: number
): Promise<string | null> {
  const provider = getProvider(modelId);
  switch (provider) {
    case 'glm': return callGLM(messages, modelId);
    case 'openai': return callOpenAI(messages, modelId, temperature);
    case 'anthropic': return callAnthropic(messages, modelId, temperature);
    case 'google': return callGemini(messages, modelId, temperature);
    default: return callGLM(messages, modelId);
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
      return Boolean(process.env.ZHIPU_API_KEY || process.env.ZAI_SDK_FALLBACK === '1');
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY);
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'google':
      return Boolean(process.env.GOOGLE_AI_API_KEY);
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
  _complexity?: 'simple' | 'standard' | 'complex'
): Promise<AIResponse> {
  const candidates = buildFallbackChain(modelId);
  const failedProviders = new Set<AIProvider>();

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

    const content = await callAI(messages, candidate);
    if (content) {
      return { content, model: candidate, provider };
    }

    failedProviders.add(provider);
  }

  throw new Error('AI model failed. Please try again. Check that at least one provider API key is configured correctly.');
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
