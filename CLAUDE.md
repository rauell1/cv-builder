# CLAUDE.md — AI Agent Context for cv-builder

> **Auto-updated**: 2026-05-17 · commit `cd66ac7` · branch `main`

> This file is read automatically by Claude, GitHub Copilot, and other AI coding agents.
> Keep it accurate. It is auto-updated by `.github/workflows/update-docs.yml` on every push to `main`.

---

## What This Project Is

**cv-builder** is a Next.js 16 (App Router) SaaS application hosted on Vercel at `https://cv.rauell.systems`.
It lets users upload a CV and a job description, then uses AI to:
1. Extract and parse the CV into structured JSON.
2. Analyze the job description.
3. Restructure the CV to match the job.
4. Generate a tailored PDF + cover letter + ATS score.

---

## Stack

- **Framework**: Next.js 16.1.3 (App Router, TypeScript, Webpack)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: Zustand
- **AI**: Multi-provider with NVIDIA NIM as primary (free tier)
- **PDF**: Puppeteer (server-side)
- **Deployment**: Vercel (iad1 region)
- **Lint/Format**: ESLint + Husky pre-commit hooks

---

## Critical Architecture Rules

### 1. Never re-export what doesn't exist
If you rename an export in a lib file, immediately grep for all importers and update them.
The build fails hard on missing exports — there is no tree-shaking at import time in Next.js API routes.

```bash
# Always run this after renaming an export:
grep -r "oldExportName" src/ --include="*.ts" --include="*.tsx"
```

### 2. One queue singleton: `aiQueue`
`src/lib/request-queue.ts` exports **only** `aiQueue`. There is no `requestQueue`.
Do not create a second queue instance. Do not rename `aiQueue` without updating every importer.

### 3. AI calls go through task-aware racing
Never call a provider SDK directly from an API route. Always use:
```ts
import { callAIRaceForTask } from '@/lib/ai-provider';
// task: 'parse' | 'analyze' | 'restructure'
const result = await callAIRaceForTask('parse', { systemPrompt, userPrompt });
```

### 4. JSON parsing goes through json-utils
Never write inline JSON.parse() on AI output. Use:
```ts
import { safeJSONParse, extractJSON } from '@/lib/json-utils';
```

### 5. DB writes are fire-and-forget
Non-critical DB writes (logging, analytics) must NOT be awaited:
```ts
void db.insert(...); // correct
await db.insert(...); // wrong — adds latency to the user response
```

### 6. No localStorage / sessionStorage
Vercel serves the app in sandboxed contexts. All transient state lives in Zustand (in-memory).

---

## File Responsibilities (Quick Reference)

| File | Do | Don't |
|------|-----|-------|
| `ai-provider.ts` | Add new models/providers, adjust scores, key rotation | Call provider APIs anywhere else |
| `request-queue.ts` | Tune concurrency/timeout | Add a second queue export |
| `response-cache.ts` | Tune TTLs, add cache keys | Cache raw file buffers (too large) |
| `json-utils.ts` | Add JSON repair helpers | Import from AI provider or routes |
| `cv-types.ts` | Add/update TypeScript types | Add runtime logic |
| `processing-step.tsx` | Update UI progress phases | Make direct API calls |

---

## Adding a New AI Provider

1. Add provider name to `AIProvider` union in `cv-types.ts`.
2. Add a `call[Provider]()` function in `ai-provider.ts` following the existing pattern.
3. Add models to `TASK_MODEL_PREFERENCES` with appropriate `baseScore`.
4. Add the env var key to `getProviderCredentialStatus()` and `getProviderCredentialDetails()`.
5. Add the env var to Vercel → Settings → Environment Variables.
6. Update `docs/AI_GUIDE.md` with the new provider's details.

---

## Adding a New API Route

1. Create `src/app/api/[route-name]/route.ts`.
2. Import `callAIRaceForTask` — never call providers directly.
3. Import `safeJSONParse` / `extractJSON` from `@/lib/json-utils`.
4. Wrap the AI call in `aiQueue.enqueue()` for backpressure.
5. Add the route to `src/app/sitemap.ts` if it has a public-facing page.
6. Add a row to the API table in `docs/CODEBASE_MAP.md`.

---

## Environment Variables

| Variable | Where set | Notes |
|----------|-----------|-------|
| `NVIDIA_API_KEY` | Vercel env | Comma-sep for multiple keys |
| `OPENAI_API_KEY` | Vercel env | Fallback |
| `ANTHROPIC_API_KEY` | Vercel env | Fallback |
| `GOOGLE_AI_API_KEY` | Vercel env | Fallback |
| `ZHIPU_API_KEY` | Vercel env | Safety net / GLM |
| `NEXT_PUBLIC_APP_URL` | Vercel env | `https://cv.rauell.systems` |

All keys are loaded via `process.env` — never hardcode.
For multiple keys per provider: `NVIDIA_API_KEY=key1,key2,key3` (comma-separated).

---

## Common Pitfalls

- **Renaming exports**: always grep + update importers before committing.
- **Adding a new lib file**: add it to `CODEBASE_MAP.md` and this file.
- **Changing model IDs**: model ID strings must match exactly what the provider API expects.
- **`getMetrics()` on queue**: the method exists — use it. Do not access private fields directly.
- **TypeScript strict mode is ON**: no implicit `any`, no unused vars, no missing return types on exported functions.

---

## Deployment

- Every push to `main` auto-deploys to Vercel.
- Build command: `next build --webpack && node scripts/postbuild-standalone.mjs`
- If build fails, check TypeScript errors first (`npm run type-check` locally).
- Rollback procedure: see `docs/ROLLBACK.md`.
