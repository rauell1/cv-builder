# AI Provider Integration Guide

> Reference for all AI providers in cv-builder, how they are wired, and how to add more.

---

## Architecture Overview

All AI calls flow through a single entry point:

```
API Route
  └── callAIRaceForTask(task, opts)       ← always use this
        └── pickBestModelForTask(task)     ← scores models, filters by task chain
              └── parallel race:           ← top N models run concurrently
                    callNvidia()  ┐
                    callOpenAI()  ├── first healthy response wins
                    callAnthropic()┘
                    callGLM()     ← safety net appended to every chain
```

This means:
- **Best model always wins** (highest `baseScore` in the task chain).
- **Automatic failover** — if a model/key errors, the next one in the race is used.
- **Per-key health tracking** — a bad key is marked down for 5 minutes, then retried.

---

## Providers

### NVIDIA NIM (Primary — Free)

| Property | Value |
|----------|-------|
| Base URL | `https://integrate.api.nvidia.com/v1` |
| Auth header | `Authorization: Bearer $NVIDIA_API_KEY` |
| API format | OpenAI-compatible (`/chat/completions`) |
| Env var | `NVIDIA_API_KEY` (comma-sep for multiple keys) |
| Timeout (fast) | 12 s |
| Timeout (medium) | 22 s |
| Timeout (slow) | 35 s |

**Available free models (by priority):**

| Model ID | baseScore | Best task |
|----------|-----------|----------|
| `mistralai/mistral-medium-3.5-128b` | 0.95 | restructure, analyze |
| `deepseek-ai/deepseek-r1-0528` | 0.93 | analyze |
| `moonshotai/kimi-k2-instruct` | 0.91 | parse, restructure |
| `nvidia/llama-3.3-nemotron-super-49b-v1` | 0.85 | parse (fast) |
| `meta/llama-3.3-70b-instruct` | 0.82 | parse (fast) |
| `qwen/qwen3-235b-a22b` | 0.80 | any fallback |

**Adding more NVIDIA keys:**
```
NVIDIA_API_KEY=nvapi-key1,nvapi-key2,nvapi-key3
```
The provider automatically round-robins across healthy keys.

---

### OpenAI (Paid Fallback)

| Property | Value |
|----------|-------|
| Base URL | `https://api.openai.com/v1` |
| Env var | `OPENAI_API_KEY` |
| Models used | `gpt-4o`, `gpt-4o-mini` |
| When used | Only when all NVIDIA models fail or are rate-limited |

---

### Anthropic (Paid Fallback)

| Property | Value |
|----------|-------|
| Base URL | `https://api.anthropic.com/v1` |
| Env var | `ANTHROPIC_API_KEY` |
| Models used | `claude-sonnet-4-5`, `claude-haiku-3-5` |
| When used | Fallback after NVIDIA + OpenAI |

---

### Google Gemini (Paid Fallback)

| Property | Value |
|----------|-------|
| SDK | `@google/generative-ai` |
| Env var | `GOOGLE_AI_API_KEY` |
| Models used | `gemini-2.0-flash`, `gemini-1.5-flash` |
| When used | Fallback after Anthropic |

---

### Zhipu GLM (Safety Net — Free)

| Property | Value |
|----------|-------|
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |
| Env var | `ZHIPU_API_KEY` |
| Models used | `glm-4-plus`, `glm-4-long`, `glm-4-flash` |
| When used | Last resort — appended to every task chain |

---

## Task Model Chains

Each task type has its own preferred model chain. Models outside the chain can still be used as safety nets.

| Task | Primary models | Goal |
|------|---------------|------|
| `parse` | Nemotron 49b, Llama 70b, Kimi | Speed — fast structured JSON from raw text |
| `analyze` | DeepSeek R1, Mistral 3.5 | Reasoning — deep job description understanding |
| `restructure` | Mistral 3.5, Kimi, DeepSeek R1 | Quality — best possible CV rewrite |

---

## Key Rotation & Health Tracking

The rotation system works at two levels:

### Level 1: Per-key rotation (within a provider)
```
nvapi-key1 → 429 Too Many Requests
  └── markKeyDown(key1, 5 min)
  └── pickHealthyKey() → nvapi-key2
  └── retry with key2
```

### Level 2: Per-model/provider rotation (across providers)
```
NVIDIA mistral → timeout after 12s
  └── NVIDIA deepseek → success ✓
  (OpenAI, Anthropic, GLM never called)
```

### Heal interval
A background `setInterval` (60 s) resets `temporarily_down` keys to `healthy` automatically.
This runs server-side only (Node.js environment).

---

## Adding a New Provider

1. Add to `AIProvider` union in `cv-types.ts`:
   ```ts
   export type AIProvider = 'nvidia' | 'openai' | 'anthropic' | 'google' | 'glm' | 'mynewprovider';
   ```

2. Write the call function in `ai-provider.ts`:
   ```ts
   async function callMyProvider(opts: AICallOptions): Promise<string> {
     const key = pickHealthyKey('mynewprovider');
     // ... fetch logic ...
   }
   ```

3. Register models in `TASK_MODEL_PREFERENCES`:
   ```ts
   { id: 'mymodel-v1', provider: 'mynewprovider', baseScore: 0.88, tasks: ['parse', 'restructure'] }
   ```

4. Add env var to Vercel and to the tables in this file + `CLAUDE.md`.

5. Add credential check to `getProviderCredentialStatus()`.

---

## Prompt Engineering Tips

- Always instruct the model to **return only valid JSON** with no markdown fences.
- Use `extractJSON()` from `json-utils.ts` to strip any accidental markdown.
- For `restructure` tasks, include the full CV schema in the system prompt so models know the exact output shape.
- Set `temperature: 0.3` for structured output tasks (parse, restructure) and `0.7` for generative tasks (cover letter, insights).
- Keep system prompts under 800 tokens to leave room for long CV content in the user prompt.
