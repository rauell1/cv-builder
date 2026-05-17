# Codebase Map

> **Auto-updated** on every push to `main` by `.github/workflows/update-docs.yml`.  
> Last update: 2026-05-17 · commit `3205b55` · branch `main`

---

## Root

```
cv-builder/
├── .github/
│   └── workflows/
│       └── update-docs.yml        # Auto-updates this file + CLAUDE.md on push
├── docs/
│   ├── CODEBASE_MAP.md            # ← this file
│   ├── AI_GUIDE.md                # AI provider integration reference
│   └── ROLLBACK.md                # Safe rollback procedures
├── scripts/
│   ├── postbuild-standalone.mjs   # Copies static assets after next build
│   └── update-docs.mjs            # Regenerates CODEBASE_MAP + CLAUDE.md (run by CI)
├── src/
│   ├── app/                       # Next.js App Router pages + API routes
│   ├── components/                # React UI components
│   ├── hooks/                     # Custom React hooks
│   └── lib/                       # Shared server-side utilities
├── CLAUDE.md                      # AI agent context (architecture, rules, env vars)
├── next.config.ts                 # Next.js configuration
├── package.json
└── tsconfig.json
```

---

## `src/app/` — Pages & Routes

| Path | Type | Responsibility |
|------|------|----------------|
| `app/page.tsx` | Page | Landing / home |
| `app/builder/page.tsx` | Page | Main CV builder UI |
| `app/layout.tsx` | Layout | Root HTML shell, fonts, providers |
| `app/sitemap.ts` | Utility | Dynamic `/sitemap.xml` generation |
| `app/globals.css` | Style | Tailwind base + global CSS vars |

### `src/app/api/` — API Routes

| Route | Method | Responsibility |
|-------|--------|----------------|
| `api/route.ts` | GET | Health check — queue + cache + memory metrics |
| `api/health/route.ts` | GET, HEAD | Detailed health + provider credential status |
| `api/extract-file/route.ts` | POST | PDF/DOCX → raw text (parallel OCR + native) |
| `api/parse-cv/route.ts` | POST | Raw text → structured `CVData` JSON via AI |
| `api/analyze-job/route.ts` | POST | Job description → structured `JobAnalysis` JSON |
| `api/restructure-cv/route.ts` | POST | CVData + JobAnalysis → tailored CV JSON |
| `api/generate-pdf/route.ts` | POST | CVData JSON → downloadable PDF |
| `api/generate-cover-letter/route.ts` | POST | CV + Job → cover letter text |
| `api/generate-cover-letter-pdf/route.ts` | POST | Cover letter text → PDF |
| `api/generate-insights/route.ts` | POST | CV + Job → interview tips / insights |
| `api/generate-script/route.ts` | POST | CV + Job → interview script |
| `api/score-cv/route.ts` | POST | CV + Job → ATS match score + feedback |
| `api/ai-chat/route.ts` | POST | Streaming AI chat assistant |

---

## `src/lib/` — Server Utilities

| File | Responsibility |
|------|----------------|
| `ai-provider.ts` | All AI provider clients, model registry, key rotation, fallback chain, `callAIRaceForTask()` |
| `request-queue.ts` | Concurrency queue (`aiQueue`), `getMetrics()`, priority lanes |
| `response-cache.ts` | LRU cache for extraction + parsing results (`extractionCache`, `parsingCache`) |
| `json-utils.ts` | Shared `extractJSON`, `fixCommonJSONIssues`, `safeJSONParse` helpers |
| `cv-types.ts` | TypeScript types: `CVData`, `JobAnalysis`, `AIProvider`, `AVAILABLE_MODELS` |
| `pdf-generator.ts` | Puppeteer/HTML → PDF rendering |
| `file-extractor.ts` | PDF native text extraction + fallback OCR logic |

---

## `src/components/` — UI Components

| Path | Responsibility |
|------|----------------|
| `cv-builder/processing-step.tsx` | Multi-step AI processing UI — progress, model badge, fallback display |
| `cv-builder/cv-preview.tsx` | Live CV preview panel |
| `cv-builder/job-input.tsx` | Job description input form |
| `cv-builder/upload-step.tsx` | File upload + drag-and-drop |
| `ui/` | shadcn/ui primitives (Button, Card, Dialog, etc.) |

---

## `src/hooks/` — Custom Hooks

| File | Responsibility |
|------|----------------|
| `useCVBuilder.ts` / `useCVBuilderStore.ts` | Zustand store — CV state, job state, step management |

---

## Key Data Flow

```
User uploads CV
    │
    ▼
extract-file  ──────────────────────────────────────────┐
  parallel: native PDF parse + OCR preflight            │
  ?fast=1 skips OCR entirely                            │
    │                                                    │
    ▼                                                    │
parse-cv                                                 │
  callAIRaceForTask('parse')                            │
  races: NVIDIA fast models (Nemotron, Llama, Kimi)     │
    │                                                    │
    ▼                                                    │
[User pastes job description]                            │
    │                                                    │
    ▼                                                    │
analyze-job                                              │
  callAIRaceForTask('analyze')                          │
  races: NVIDIA reasoning models (DeepSeek, Mistral)    │
    │                                                    │
    ▼ (parallel with above)                             │
restructure-cv                                           │
  callAIRaceForTask('restructure')                      │
  races: quality models (Mistral 3.5, DeepSeek, Kimi)  │
    │                                                    │
    ▼                                                    │
generate-pdf  ◄─────────────────────────────────────────┘
  → downloadable PDF
```

---

## AI Model Priority (as of latest `ai-provider.ts`)

| Priority | Provider | Model | Task Chain |
|----------|----------|-------|------------|
| 1 | NVIDIA NIM | mistral-medium-3.5-128b | restructure, analyze |
| 2 | NVIDIA NIM | deepseek-r1-0528 | analyze, restructure |
| 3 | NVIDIA NIM | kimi-k2-instruct | parse, restructure |
| 4 | NVIDIA NIM | nemotron-super-49b | parse (fast) |
| 5 | NVIDIA NIM | llama-3.3-70b | parse (fast) |
| 6 | OpenAI | gpt-4o / gpt-4o-mini | any (paid fallback) |
| 7 | Anthropic | claude-sonnet-4 | any (paid fallback) |
| 8 | Google | gemini-2.0-flash | any (paid fallback) |
| 9 | Zhipu | glm-4-plus | safety net |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | ✅ Primary | Comma-separated NIM keys (e.g. `key1,key2`) |
| `OPENAI_API_KEY` | ⚡ Fallback | OpenAI GPT models |
| `ANTHROPIC_API_KEY` | ⚡ Fallback | Claude models |
| `GOOGLE_AI_API_KEY` | ⚡ Fallback | Gemini models |
| `ZHIPU_API_KEY` | 🛡️ Safety net | GLM models |
| `NEXT_PUBLIC_APP_URL` | ✅ | Canonical URL (e.g. `https://cv.rauell.systems`) |
