# AI CV Builder

> **Live:** [cv.rauell.systems](https://cv.rauell.systems)

A full-featured, AI-powered CV/Resume Builder that parses your CV, analyzes job descriptions, and generates perfectly tailored CVs and cover letters in multiple professional formats — all driven by a smart multi-provider AI gateway with automatic key rotation and failover.

---

## Features

### Multi-Step CV Building Workflow
1. **Upload or Paste Your CV** — Upload a DOCX or plain text file. The app uses `mammoth` for DOCX extraction. Paste raw text directly if preferred.
2. **Provide a Job Description** — Paste or upload a job description. The AI identifies requirements, keywords, skills, and experience level.
3. **Choose Your AI Model** — Select from models across 6 providers. NVIDIA NIM free-tier models are always tried first; others fall back automatically.
4. **Review & Download** — Edit every section, generate per-section AI insights, score your CV against the job, enhance achievement bullets, download in 5 formats, and generate cover letters in 5 styles.

### 5 CV Output Formats
| Format | Style | Best For |
|--------|-------|----------|
| **Europass** | European standard, blue headers, two-column | European jobs, academic positions |
| **ATS-Friendly** | Clean black & white, single-column, no graphics | Corporate, tech, online applications |
| **Modern Professional** | Left accent sidebar, clean typography | Startups, creative industries |
| **Creative Bold** | Teal accent headers, two-column layout | Design, marketing, agencies |
| **Classic Traditional** | Serif fonts, centered headers, decorative rules | Law, finance, government |

### 5 Cover Letter Styles
| Format | Tone | Best For |
|--------|------|----------|
| **Professional** | Formal business language | Corporate, finance, consulting |
| **Modern** | Conversational yet professional | Tech, startups, marketing |
| **Creative** | Bold storytelling approach | Design, media, advertising |
| **Concise** | Direct, under 250 words | HR screenings, busy hiring managers |
| **Formal** | Traditional letter conventions | Government, law, academia |

### AI-Powered Features
- **Per-Section Insights** — AI analysis for each CV section with scores, strengths, weaknesses, and improvement suggestions.
- **Apply Improvements** — One-click to apply AI-suggested improvements to any section.
- **ATS CV Scoring** — Full scoring breakdown: keyword match, experience relevance, achievement quality, skills coverage, format, and education (0–100).
- **Achievement Enhancement** — AI rewrites experience bullet points to be action-verb-led and results-quantified.
- **Smart CV Parsing** — AI extracts structured data from raw CV text.
- **Job Description Analysis** — AI identifies key requirements, preferred skills, keywords, and experience level.
- **Intelligent Restructuring** — AI rewrites and reorders your CV to match the target role.

---

## AI Provider System

The app uses a **smart fallback chain** with automatic key rotation. When one provider or key fails, it silently moves to the next. No user action needed.

### Fallback Priority Order
```
NVIDIA NIM (free) → OpenAI → Anthropic → Google → GLM (Zhipu AI)
```

### All Supported Models
| Provider | Model | Score | Free? | Env Var |
|----------|-------|-------|-------|---------|
| **NVIDIA NIM** | mistralai/mistral-medium-3.5-128b | 0.95 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | deepseek-ai/deepseek-r1-0528 | 0.93 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | moonshotai/kimi-k2-instruct | 0.91 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | nvidia/llama-3.3-nemotron-super-49b-v1 | 0.87 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | meta/llama-3.3-70b-instruct | 0.85 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | deepseek-ai/deepseek-v3-0324 | 0.83 | ✅ Free | `NVIDIA_API_KEY` |
| **NVIDIA NIM** | qwen/qwen3-235b-a22b | 0.80 | ✅ Free | `NVIDIA_API_KEY` |
| **OpenAI** | GPT-4o | — | 💳 Paid | `OPENAI_API_KEY` |
| **OpenAI** | GPT-4o Mini | — | 💳 Paid | `OPENAI_API_KEY` |
| **Anthropic** | Claude 4 Sonnet | — | 💳 Paid | `ANTHROPIC_API_KEY` |
| **Anthropic** | Claude 4 Haiku | — | 💳 Paid | `ANTHROPIC_API_KEY` |
| **Google** | Gemini 2.5 Flash | — | 💳 Paid | `GOOGLE_AI_API_KEY` |
| **Google** | Gemini 2.5 Pro | — | 💳 Paid | `GOOGLE_AI_API_KEY` |
| **GLM (Zhipu AI)** | GLM-4 Flash | — | ✅ Free tier | `ZHIPU_API_KEY` |
| **GLM (Zhipu AI)** | GLM-4 Plus | — | 💳 Paid | `ZHIPU_API_KEY` |
| **GLM (Zhipu AI)** | GLM-4 Long (128K) | — | 💳 Paid | `ZHIPU_API_KEY` |

### Key Rotation & Health
- Multiple keys per provider: set as a comma-separated list (e.g., `NVIDIA_API_KEY=key1,key2,key3`).
- A key that returns `401`/`403` is automatically marked down for a 5-minute cooldown.
- A background job heals keys every 60 seconds.
- If all keys for a provider fail, the next provider in the chain is tried.
- `GET /api/health` shows live key health, queue depth, cache stats, and memory usage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Server Components) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York style) |
| **State** | Zustand |
| **Database** | Prisma ORM + SQLite |
| **PDF Generation** | pdf-lib |
| **DOCX Extraction** | mammoth |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/rauell1/cv-builder.git
cd cv-builder

# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the development server
bun run dev
```

App runs at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# ─── NVIDIA NIM (FREE — highest priority) ─────────────────────────────────────
# Get key: https://build.nvidia.com → Login → Get API Key
# Supports comma-separated list for automatic key rotation:
NVIDIA_API_KEY=nvapi-xxxx,nvapi-yyyy

# ─── GLM / Zhipu AI ──────────────────────────────────────────────────────────
# Get key: https://open.bigmodel.cn/usercenter/apikeys
ZHIPU_API_KEY=your-zhipu-key

# ─── OpenAI ──────────────────────────────────────────────────────────────────
# Get key: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key

# ─── Anthropic ───────────────────────────────────────────────────────────────
# Get key: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-your-key

# ─── Google AI ───────────────────────────────────────────────────────────────
# Get key: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your-google-key

# ─── App ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://cv.rauell.systems

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=file:./dev.db
```

> **Vercel**: Add all variables in **Project → Settings → Environment Variables**. Only the providers you add keys for will be activated — the app gracefully skips providers with no keys.

---

## Project Structure

```
cv-builder/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with metadata
│   │   ├── page.tsx                      # Main page (step router)
│   │   ├── globals.css                   # Global styles
│   │   ├── sitemap.ts                    # Dynamic sitemap (served at /sitemap.xml)
│   │   ├── error.tsx                     # Global error boundary page
│   │   ├── not-found.tsx                 # 404 page
│   │   └── api/
│   │       ├── route.ts                  # Queue & cache metrics
│   │       ├── parse-cv/route.ts         # CV text → structured JSON
│   │       ├── analyze-job/route.ts      # Job description analysis
│   │       ├── restructure-cv/route.ts   # AI-driven CV restructuring
│   │       ├── score-cv/route.ts         # ATS simulation & CV scoring
│   │       ├── enhance-achievements/route.ts
│   │       ├── generate-pdf/route.ts     # PDF generation (5 formats)
│   │       ├── generate-script/route.ts  # Python fpdf2 Europass script
│   │       ├── generate-insights/route.ts
│   │       ├── generate-cover-letter/route.ts
│   │       ├── generate-cover-letter-pdf/route.ts
│   │       ├── extract-file/route.ts     # DOCX / text extraction
│   │       ├── ai-chat/route.ts          # Multi-provider AI chat
│   │       └── health/route.ts           # Health check
│   ├── components/
│   │   ├── cv-builder/
│   │   │   ├── landing-page.tsx
│   │   │   ├── step-indicator.tsx
│   │   │   ├── cv-input-step.tsx
│   │   │   ├── job-desc-step.tsx
│   │   │   ├── processing-step.tsx
│   │   │   └── output-step.tsx
│   │   ├── error-boundary.tsx
│   │   └── ui/                           # shadcn/ui components
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   └── lib/
│       ├── ai-provider.ts                # AI gateway — fallback chain, key rotation
│       ├── config.ts                     # App-wide configuration constants
│       ├── cv-types.ts                   # TypeScript types, AI model configs, prompts
│       ├── cv-store.ts                   # Zustand state store
│       ├── api-calls.ts                  # Frontend API call functions
│       ├── db.ts                         # Prisma database client
│       ├── pdf-utils.ts                  # Shared PDF layout utilities
│       ├── rate-limit.ts / rate-limiter.ts
│       ├── request-queue.ts              # AI request queue
│       ├── response-cache.ts             # Response caching
│       ├── sdk-retry.ts                  # Retry / backoff logic
│       ├── text-cleaning.ts
│       └── utils.ts
├── scripts/
│   └── update-docs.mjs                   # Auto-stamps docs on every commit
├── .github/
│   └── workflows/
│       └── update-docs.yml               # GitHub Actions: auto-update docs
├── docs/
│   ├── CODEBASE_MAP.md                   # Full annotated codebase reference
│   ├── AI_GUIDE.md                       # Provider setup, rotation internals, adding new models
│   └── ROLLBACK.md                       # Safe rollback procedures for every layer
├── prisma/
│   └── schema.prisma
└── CLAUDE.md                             # AI agent context file (auto-updated)
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api` | Queue & cache metrics |
| `POST` | `/api/parse-cv` | Parse raw CV text into structured JSON |
| `POST` | `/api/analyze-job` | Analyze a job description |
| `POST` | `/api/restructure-cv` | AI-restructure CV for a specific job |
| `POST` | `/api/score-cv` | ATS simulation & comprehensive CV scoring |
| `POST` | `/api/enhance-achievements` | AI-enhance experience bullet points |
| `POST` | `/api/generate-pdf` | Generate tailored CV PDF (5 formats) |
| `POST` | `/api/generate-script` | Generate Python fpdf2 Europass script |
| `POST` | `/api/generate-insights` | Per-section AI analysis |
| `POST` | `/api/generate-cover-letter` | Generate AI cover letter |
| `POST` | `/api/generate-cover-letter-pdf` | Generate cover letter PDF |
| `POST` | `/api/extract-file` | Extract text from uploaded files |
| `POST` | `/api/ai-chat` | Multi-provider AI chat endpoint |
| `GET`  | `/api/health` | App health — queues, cache, memory, key health |

---

## How It Works

### CV Upload & Parsing
1. User uploads a DOCX or text file (or pastes text directly).
2. DOCX files are extracted via `mammoth`.
3. Text is sent to the AI gateway to parse into structured sections.

### Job Analysis & CV Restructuring
1. User provides a target job description.
2. AI analyzes the job for requirements, keywords, skills, and experience level.
3. The AI gateway restructures the CV — reordering sections, optimizing keywords, strengthening bullet points, and rewriting the personal statement.

### Per-Section Insights
1. Each CV section is individually analyzed against the job description.
2. AI returns a score (0–100), strengths, weaknesses, and suggestions.
3. Users apply AI improvements with one click.

### Cover Letter Generation
1. User selects a cover letter style.
2. AI generates a tailored letter using CV data, job analysis, and tone instructions.
3. Fully editable inline, downloadable as PDF.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [`CLAUDE.md`](./CLAUDE.md) | AI agent context — architecture rules, do/don't guides, adding new routes/providers |
| [`docs/CODEBASE_MAP.md`](./docs/CODEBASE_MAP.md) | Full annotated map of every file, route, and data flow |
| [`docs/AI_GUIDE.md`](./docs/AI_GUIDE.md) | Provider setup, key rotation internals, adding new models |
| [`docs/ROLLBACK.md`](./docs/ROLLBACK.md) | Safe rollback procedures for every layer |

All docs are **auto-updated on every push to `main`** via `.github/workflows/update-docs.yml`. The workflow stamps the latest commit SHA and date into `CODEBASE_MAP.md` and `CLAUDE.md` automatically, with `[skip ci]` to prevent infinite loops.

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add all environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**.

The app detects which providers are configured and skips any with missing keys. At a minimum, set `NVIDIA_API_KEY` — it's free and covers 7 high-quality models.

### Self-Hosted

```bash
bun run build
bun run start
```

Set `DATABASE_URL` to a persistent volume path for production.

---

## Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Read `CLAUDE.md` before touching `src/lib/ai-provider.ts` or adding API routes.
4. Commit with a descriptive message: `git commit -m 'feat: add X'`.
5. Open a pull request.

---

## License

MIT
