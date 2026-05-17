/**
 * Centralized AI Provider Module
 *
 * Supports:
 *   - GLM / Zhipu AI  (ZHIPU_API_KEY / GLM_API_KEY / BIGMODEL_API_KEY)
 *   - OpenAI          (OPENAI_API_KEY)
 *   - Anthropic       (ANTHROPIC_API_KEY)
 *   - Google Gemini   (GOOGLE_AI_API_KEY / GEMINI_API_KEY)
 *   - NVIDIA NIM      (per-slot keys below)
 *
 * NVIDIA env-var layout — EXACT names as set in Vercel:
 *   NVIDIA_MISTRAL_KEYS  (also reads NVIDIA_MISTRAL_KEY)  — Mistral keys
 *   NVIDIA_DEEPSEEK_KEYS (also reads NVIDIA_DEEPSEEK_KEY) — DeepSeek keys
 *   NVIDIA_KIMI_KEYS     (also reads NVIDIA_KIMI_KEY)     — Kimi keys
 *   NVIDIA_MISTRAL_MODEL — override model id  (optional)
 *   NVIDIA_DEEPSEEK_MODEL— override model id  (optional)
 *   NVIDIA_KIMI_MODEL    — override model id  (optional)
 *   NVIDIA_MISTRAL_URL   — override base URL  (optional)
 *   NVIDIA_DEEPSEEK_URL  — override base URL  (optional)
 *   NVIDIA_KIMI_URL      — override base URL  (optional)
 *   NVIDIA_API_KEY       — generic pool used as last resort
 *
 * Speed optimizations:
 *   - callAIRaceForTask(): fires top-3 models in parallel, first winner returned
 *   - Per-model timeouts tuned to each provider's p95 latency
 *   - Non-blocking background healer restores keys every 60 s
 *   - Each NVIDIA model has independent key pools + health state
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

const COOLDOWN_MS = 2 * 60_000; // 2 minutes

interface KeyHealth {
  key: string;
  status: 'healthy' | 'down';
  downSince?: number;
}

const keyHealthMap = new Map<string, KeyHealth[]>();
const nvidiaModelHealth = new Map<string, number>();

function initKeyHealth(poolKey: string, keys: string[]): void {
  if (!keyHealthMap.has(poolKey)) {
    keyHealthMap.set(poolKey, keys.map((k) => ({ key: k, status: 'healthy' })));
  } else {
    const pool = keyHealthMap.get(poolKey)!;
    for (const k of keys) {
      if (!pool.find((e) => e.key === k)) pool.push({ key: k, status: 'healthy' });
    }
  }
}

function pickHealthyKeyFromPool(poolKey: string): string | null {
  const pool = keyHealthMap.get(poolKey) ?? [];
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

function markKeyDownInPool(poolKey: string, key: string): void {
  const pool = keyHealthMap.get(poolKey) ?? [];
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

function readEnvValue(key: string): string | null {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  if (!env) return null;
  const candidates = [
    env[key],
    env[`NEXT_PUBLIC_${key}`],
    env[key.toLowerCase()],
    env[`next_public_${key.toLowerCase()}`],
  ];
  for (const v of candidates) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function splitKeys(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Read keys from multiple possible env var names and deduplicate.
 * This handles both plural (KEYS) and singular (KEY) naming conventions,
 * matching whatever the user set in Vercel.
 */
function readMultiKeyEnv(...varNames: string[]): string[] {
  const found: string[] = [];
  for (const varName of varNames) {
    found.push(...splitKeys(readEnvValue(varName)));
  }
  return [...new Set(found)];
}

// ---- Generic (non-NVIDIA) provider key aliases ----

const PROVIDER_KEY_ALIASES: Record<Exclude<AIProvider, 'nvidia'>, string[]> = {
  glm:       ['ZHIPU_API_KEY', 'GLM_API_KEY', 'BIGMODEL_API_KEY'],
  openai:    ['OPENAI_API_KEY', 'OPENAI_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  google:    ['GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
};

function getAllProviderKeysNonNvidia(provider: Exclude<AIProvider, 'nvidia'>): string[] {
  const found: string[] = [];
  for (const alias of PROVIDER_KEY_ALIASES[provider]) {
    found.push(...splitKeys(readEnvValue(alias)));
  }
  const unique = [...new Set(found)];
  initKeyHealth(provider, unique);
  return unique;
}

function pickKeyNonNvidia(provider: Exclude<AIProvider, 'nvidia'>): string | null {
  const keys = getAllProviderKeysNonNvidia(provider);
  if (keys.length === 0) return null;
  return pickHealthyKeyFromPool(provider) ?? keys[0];
}

function markKeyDownNonNvidia(provider: Exclude<AIProvider, 'nvidia'>, key: string): void {
  markKeyDownInPool(provider, key);
}

// ---- NVIDIA per-model key / URL / model-id config ----
//
// Each slot reads from BOTH plural (KEYS) and singular (KEY) env var names
// so that whatever the user set in Vercel is found automatically.

export type NvidiaSlot = 'MISTRAL' | 'DEEPSEEK' | 'KIMI';

const NVIDIA_SLOT_DEFAULTS: Record<NvidiaSlot, { defaultModel: string; defaultUrl: string }> = {
  MISTRAL:  { defaultModel: 'mistralai/mistral-medium-3.5-128b',  defaultUrl: 'https://integrate.api.nvidia.com/v1' },
  DEEPSEEK: { defaultModel: 'deepseek-ai/deepseek-r1-0528',       defaultUrl: 'https://integrate.api.nvidia.com/v1' },
  KIMI:     { defaultModel: 'moonshotai/kimi-k2-instruct',        defaultUrl: 'https://integrate.api.nvidia.com/v1' },
};

// Additional aliases per slot — covers both KEYS and KEY naming conventions
const NVIDIA_SLOT_KEY_ALIASES: Record<NvidiaSlot, string[]> = {
  MISTRAL:  ['NVIDIA_MISTRAL_KEYS', 'NVIDIA_MISTRAL_KEY'],
  DEEPSEEK: ['NVIDIA_DEEPSEEK_KEYS', 'NVIDIA_DEEPSEEK_KEY'],
  KIMI:     ['NVIDIA_KIMI_KEYS', 'NVIDIA_KIMI_KEY', 'KIMI_KEYS', 'KIMI_KEY'],
};

const modelToSlot: Map<string, NvidiaSlot> = new Map();

function getNvidiaSlotConfig(slot: NvidiaSlot): {
  keys: string[];
  modelId: string;
  baseUrl: string;
} {
  // Read keys from all alias names (handles both KEYS and KEY naming)
  const keys = readMultiKeyEnv(...NVIDIA_SLOT_KEY_ALIASES[slot]);
  const modelId = readEnvValue(`NVIDIA_${slot}_MODEL`) ?? NVIDIA_SLOT_DEFAULTS[slot].defaultModel;
  const baseUrl = (readEnvValue(`NVIDIA_${slot}_URL`) ?? NVIDIA_SLOT_DEFAULTS[slot].defaultUrl).replace(/\/$/, '');
  const poolKey = `nvidia:${slot}`;
  initKeyHealth(poolKey, keys);
  modelToSlot.set(modelId, slot);
  return { keys, modelId, baseUrl };
}

function getGenericNvidiaKeys(): string[] {
  const keys = readMultiKeyEnv('NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY', 'NVIDIA_KEY');
  initKeyHealth('nvidia:generic', keys);
  return keys;
}

function pickNvidiaKey(modelId: string): { key: string; baseUrl: string } | null {
  const slot = modelToSlot.get(modelId);
  if (slot) {
    const poolKey = `nvidia:${slot}`;
    const overrideUrl = (readEnvValue(`NVIDIA_${slot}_URL`) ?? NVIDIA_SLOT_DEFAULTS[slot].defaultUrl).replace(/\/$/, '');
    const key = pickHealthyKeyFromPool(poolKey);
    if (key) return { key, baseUrl: overrideUrl };
  }
  // Fall through to generic pool
  const genericKey = pickHealthyKeyFromPool('nvidia:generic');
  if (genericKey) return { key: genericKey, baseUrl: 'https://integrate.api.nvidia.com/v1' };
  // Last resort: try any slot that has healthy keys
  for (const s of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    const k = pickHealthyKeyFromPool(`nvidia:${s}`);
    if (k) {
      const url = (readEnvValue(`NVIDIA_${s}_URL`) ?? NVIDIA_SLOT_DEFAULTS[s].defaultUrl).replace(/\/$/, '');
      return { key: k, baseUrl: url };
    }
  }
  return null;
}

function markNvidiaKeyDown(modelId: string, key: string): void {
  const slot = modelToSlot.get(modelId);
  if (slot) markKeyDownInPool(`nvidia:${slot}`, key);
  else markKeyDownInPool('nvidia:generic', key);
}

function hasNvidiaCredentials(): boolean {
  const slots: NvidiaSlot[] = ['MISTRAL', 'DEEPSEEK', 'KIMI'];
  let found = false;
  for (const slot of slots) {
    const { keys } = getNvidiaSlotConfig(slot);
    if (keys.length > 0) found = true;
  }
  if (getGenericNvidiaKeys().length > 0) found = true;
  return found;
}

// ---- Diagnostics export (used by /api/env-check) ----

export function getNvidiaSlotDiagnostics(): Record<NvidiaSlot, { keyCount: number; modelId: string; baseUrl: string; healthyKeys: number }> {
  const result = {} as Record<NvidiaSlot, { keyCount: number; modelId: string; baseUrl: string; healthyKeys: number }>;
  for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    const { keys, modelId, baseUrl } = getNvidiaSlotConfig(slot);
    const pool = keyHealthMap.get(`nvidia:${slot}`) ?? [];
    const healthyKeys = pool.filter((e) => e.status === 'healthy').length;
    result[slot] = { keyCount: keys.length, modelId, baseUrl, healthyKeys };
  }
  return result;
}

// ---- Public key API ----

export function getAllProviderKeys(provider: AIProvider): string[] {
  if (provider === 'nvidia') {
    const slots: NvidiaSlot[] = ['MISTRAL', 'DEEPSEEK', 'KIMI'];
    const all: string[] = [];
    for (const slot of slots) all.push(...getNvidiaSlotConfig(slot).keys);
    all.push(...getGenericNvidiaKeys());
    return [...new Set(all)];
  }
  return getAllProviderKeysNonNvidia(provider);
}

export function getProviderApiKey(provider: AIProvider): string | null {
  if (provider === 'nvidia') {
    const generic = pickHealthyKeyFromPool('nvidia:generic');
    if (generic) return generic;
    for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
      const k = pickHealthyKeyFromPool(`nvidia:${slot}`);
      if (k) return k;
    }
    return null;
  }
  return pickKeyNonNvidia(provider);
}

export function getProviderKeyNames(provider: AIProvider): string[] {
  if (provider === 'nvidia') {
    return [
      'NVIDIA_MISTRAL_KEYS', 'NVIDIA_MISTRAL_KEY',
      'NVIDIA_DEEPSEEK_KEYS', 'NVIDIA_DEEPSEEK_KEY',
      'NVIDIA_KIMI_KEYS', 'NVIDIA_KIMI_KEY',
      'NVIDIA_API_KEY',
    ];
  }
  return PROVIDER_KEY_ALIASES[provider] ?? [];
}

export function hasAnyProviderCredentials(): boolean {
  return (
    Boolean(getProviderApiKey('glm')) ||
    Boolean(getProviderApiKey('openai')) ||
    Boolean(getProviderApiKey('anthropic')) ||
    Boolean(getProviderApiKey('google')) ||
    hasNvidiaCredentials() ||
    process.env.ZAI_SDK_FALLBACK === '1'
  );
}

export function getProviderCredentialStatus(): Record<AIProvider, boolean> {
  return {
    glm:       Boolean(getProviderApiKey('glm') || process.env.ZAI_SDK_FALLBACK === '1'),
    openai:    Boolean(getProviderApiKey('openai')),
    anthropic: Boolean(getProviderApiKey('anthropic')),
    google:    Boolean(getProviderApiKey('google')),
    nvidia:    hasNvidiaCredentials(),
  };
}

export function getProviderCredentialDetails(): {
  anyConfigured: boolean;
  status: Record<AIProvider, boolean>;
  sources: Record<AIProvider, string[]>;
  zaiSdkFallback: boolean;
} {
  const status = getProviderCredentialStatus();
  const sources: Record<AIProvider, string[]> = {
    glm: [], openai: [], anthropic: [], google: [], nvidia: [],
  };
  for (const provider of ['glm', 'openai', 'anthropic', 'google'] as Exclude<AIProvider, 'nvidia'>[]) {
    for (const alias of PROVIDER_KEY_ALIASES[provider]) {
      if (readEnvValue(alias)) sources[provider].push(alias);
    }
  }
  for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    for (const alias of NVIDIA_SLOT_KEY_ALIASES[slot]) {
      if (readEnvValue(alias)) sources.nvidia.push(alias);
    }
  }
  if (readEnvValue('NVIDIA_API_KEY')) sources.nvidia.push('NVIDIA_API_KEY');
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
  if (hasNvidiaCredentials()) {
    switch (complexity) {
      case 'complex':  return 'mistralai/mistral-medium-3.5-128b';
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

function modelTimeout(modelId: string): number {
  const entry = NVIDIA_MODELS.find((m) => m.id === modelId);
  if (entry) {
    // Bumped timeouts: fast=20s, medium=35s, slow=55s
    if (entry.speed === 'fast')   return 20_000;
    if (entry.speed === 'medium') return 35_000;
    return 55_000;
  }
  if (modelId.startsWith('gpt-'))    return 25_000;
  if (modelId.startsWith('claude-')) return 30_000;
  if (modelId.startsWith('gemini-')) return 25_000;
  if (modelId.startsWith('glm-'))    return 20_000;
  return 35_000;
}

// ---- Provider call implementations ----

async function callGLMviaSDK(messages: AIMessage[], modelId: string, timeoutMs = 20_000): Promise<string | null> {
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

async function callGLMviaAPI(messages: AIMessage[], modelId: string, timeoutMs = 20_000): Promise<string | null> {
  const apiKey = pickKeyNonNvidia('glm');
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
      if (res.status === 401 || res.status === 403) markKeyDownNonNvidia('glm', apiKey);
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

async function callGLM(messages: AIMessage[], modelId: string, timeoutMs = 20_000): Promise<string | null> {
  const zhipuKey = pickKeyNonNvidia('glm');
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
  const apiKey = pickKeyNonNvidia('openai');
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
      if (res.status === 401 || res.status === 403) markKeyDownNonNvidia('openai', apiKey);
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
  const apiKey = pickKeyNonNvidia('anthropic');
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
      if (res.status === 401 || res.status === 403) markKeyDownNonNvidia('anthropic', apiKey);
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
  const apiKey = pickKeyNonNvidia('google');
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
      if (res.status === 401 || res.status === 403) markKeyDownNonNvidia('google', apiKey);
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
  for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    getNvidiaSlotConfig(slot);
  }

  if (!isNvidiaModelHealthy(modelId)) {
    throw new AIProviderError({
      provider: 'nvidia',
      model: modelId,
      kind: 'provider_error',
      message: `Model ${modelId} is in cooldown`,
    });
  }

  const picked = pickNvidiaKey(modelId);
  if (!picked) {
    throw new AIProviderError({
      provider: 'nvidia',
      model: modelId,
      kind: 'missing_key',
      message: [
        `No healthy NVIDIA key for ${modelId}.`,
        'Set one of: NVIDIA_MISTRAL_KEYS, NVIDIA_MISTRAL_KEY,',
        'NVIDIA_DEEPSEEK_KEYS, NVIDIA_DEEPSEEK_KEY,',
        'NVIDIA_KIMI_KEYS, NVIDIA_KIMI_KEY, or NVIDIA_API_KEY',
        'in Vercel → Project → Settings → Environment Variables.',
        'Visit /api/env-check to see which vars are currently found.',
      ].join(' '),
    });
  }
  const { key: apiKey, baseUrl } = picked;
  const timeout = timeoutMs ?? modelTimeout(modelId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
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
        markNvidiaKeyDown(modelId, apiKey);
        markNvidiaModelDown(modelId);
      } else if (res.status === 429 || res.status >= 500) {
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
    if (isTimeout) markNvidiaModelDown(modelId);
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
  const apiKey = pickKeyNonNvidia('openai');
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
    case 'nvidia':    return hasNvidiaCredentials();
    default:          return false;
  }
}

const NVIDIA_MODEL_IDS_FAST_FIRST = [...NVIDIA_MODELS]
  .sort((a, b) => {
    const speedOrder = { fast: 0, medium: 1, slow: 2 };
    const speedDiff = speedOrder[a.speed] - speedOrder[b.speed];
    return speedDiff !== 0 ? speedDiff : b.baseScore - a.baseScore;
  })
  .map((m) => m.id);

const OPENAI_MODELS    = ['gpt-4o-mini', 'gpt-4o'] as const;
const ANTHROPIC_MODELS = ['claude-haiku-4-20250414', 'claude-sonnet-4-20250514'] as const;
const GOOGLE_MODELS    = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;

void OPENAI_MODELS;
void ANTHROPIC_MODELS;
void GOOGLE_MODELS;
void NVIDIA_MODEL_IDS_FAST_FIRST;

// ---- Task-specific model routing ----

export type AITaskType = 'parse' | 'analyze' | 'score' | 'restructure' | 'cover_letter' | 'general';

export const TASK_MODEL_PREFERENCES: Record<AITaskType, readonly string[]> = {
  parse: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'glm-4-flash',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'claude-haiku-4-20250414',
    'mistralai/mistral-medium-3.5-128b',
    'glm-4-plus',
  ],
  analyze: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'glm-4-flash',
    'glm-4-plus',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'mistralai/mistral-medium-3.5-128b',
    'moonshotai/kimi-k2-instruct',
    'claude-haiku-4-20250414',
    'deepseek-ai/deepseek-r1-0528',
  ],
  score: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'glm-4-flash',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'glm-4-plus',
    'claude-haiku-4-20250414',
    'mistralai/mistral-medium-3.5-128b',
  ],
  restructure: [
    'mistralai/mistral-medium-3.5-128b',
    'moonshotai/kimi-k2-instruct',
    'claude-sonnet-4-20250514',
    'gpt-4o',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'claude-haiku-4-20250414',
    'meta/llama-3.3-70b-instruct',
    'deepseek-ai/deepseek-r1-0528',
    'glm-4-plus',
    'glm-4-long',
    'glm-4-flash',
  ],
  cover_letter: [
    'mistralai/mistral-medium-3.5-128b',
    'moonshotai/kimi-k2-instruct',
    'claude-sonnet-4-20250514',
    'gpt-4o',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gpt-4o-mini',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'claude-haiku-4-20250414',
    'glm-4-plus',
    'glm-4-flash',
  ],
  general: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'mistralai/mistral-medium-3.5-128b',
    'moonshotai/kimi-k2-instruct',
    'deepseek-ai/deepseek-r1-0528',
    'glm-4-flash',
    'gemini-2.5-flash',
    'gpt-4o-mini',
  ],
};

export function getPreferredModelsForTask(task: AITaskType): readonly string[] {
  return TASK_MODEL_PREFERENCES[task];
}

export function pickBestModelForTask(task: AITaskType): string {
  for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    getNvidiaSlotConfig(slot);
  }
  for (const modelId of TASK_MODEL_PREFERENCES[task]) {
    const provider = getProvider(modelId);
    if (!hasProviderCredentials(provider)) continue;
    if (provider === 'nvidia' && !isNvidiaModelHealthy(modelId)) continue;
    return modelId;
  }
  return hasProviderCredentials('glm') || process.env.ZAI_SDK_FALLBACK === '1'
    ? 'glm-4-flash'
    : 'glm-4-flash';
}

export async function callAIRaceForTask(
  task: AITaskType,
  messages: AIMessage[],
  raceCount = 3, // Bumped from 2 to 3 — more parallel racers = faster first response
  temperature?: number,
  hintModel?: string,
): Promise<AIResponse> {
  for (const slot of ['MISTRAL', 'DEEPSEEK', 'KIMI'] as NvidiaSlot[]) {
    getNvidiaSlotConfig(slot);
  }

  const prefs = [...TASK_MODEL_PREFERENCES[task]];

  if (hintModel && !prefs.includes(hintModel)) prefs.unshift(hintModel);
  else if (hintModel) {
    const idx = prefs.indexOf(hintModel);
    if (idx > 0) { prefs.splice(idx, 1); prefs.unshift(hintModel); }
  }

  const eligible: string[] = prefs.filter((m) => {
    const p = getProvider(m);
    if (!hasProviderCredentials(p)) return false;
    if (p === 'nvidia' && !isNvidiaModelHealthy(m)) return false;
    return true;
  });

  for (const glmId of ['glm-4-flash', 'glm-4-plus']) {
    if (!eligible.includes(glmId) && hasProviderCredentials('glm')) {
      eligible.push(glmId);
    }
  }

  if (eligible.length === 0) {
    throw new AIModelFailedError([{
      provider: 'glm',
      model: 'glm-4-flash',
      kind: 'missing_key',
      message: [
        'No eligible models for task. Configure at least one of:',
        'NVIDIA_MISTRAL_KEYS, NVIDIA_MISTRAL_KEY,',
        'NVIDIA_DEEPSEEK_KEYS, NVIDIA_DEEPSEEK_KEY,',
        'NVIDIA_KIMI_KEYS, NVIDIA_KIMI_KEY,',
        'OPENAI_API_KEY, ANTHROPIC_API_KEY,',
        'GOOGLE_AI_API_KEY, or ZHIPU_API_KEY',
        'in Vercel → Project → Settings → Environment Variables.',
        'Visit /api/env-check for a live diagnostic.',
      ].join(' '),
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
