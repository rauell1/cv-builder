# AI CV Builder

A full-featured, AI-powered CV/Resume Builder that parses your CV, analyzes job descriptions, and generates perfectly tailored CVs and cover letters in multiple professional formats — all driven by your choice of AI model.

---

## Features

### Multi-Step CV Building Workflow
1. **Upload or Paste Your CV** — Upload a DOCX or plain text file. The app uses `mammoth` for DOCX files. You can also paste your CV text directly.
2. **Provide a Job Description** — Paste or upload a job description. The AI analyzes requirements, keywords, skills, and experience level.
3. **Choose Your AI Model** — Select from 9 models across 4 providers. GLM models are built-in; others require API keys.
4. **Review & Download** — Edit every section, generate per-section AI insights, score your CV against the job, enhance achievement bullets, download your tailored CV in 5 formats, and generate cover letters in 5 styles.

### 5 CV Output Formats
| Format | Style | Best For |
|--------|-------|----------|
| **Europass** | European standard, blue headers, two-column | European jobs, academic positions |
| **ATS-Friendly** | Clean black & white, single-column, no graphics | Corporate, tech, online applications |
| **Modern Professional** | Left accent sidebar, clean typography | Startups, creative industries |
| **Creative Bold** | Teal accent headers, two-column layout | Design, marketing, agencies |
| **Classic Traditional** | Serif fonts, centered headers, decorative rules | Law, finance, government |

### 5 Cover Letter Formats
| Format | Tone | Best For |
|--------|------|----------|
| **Professional** | Formal business language | Corporate, finance, consulting |
| **Modern** | Conversational yet professional | Tech, startups, marketing |
| **Creative** | Bold storytelling approach | Design, media, advertising |
| **Concise** | Direct, under 250 words | HR screenings, busy hiring managers |
| **Formal** | Traditional letter conventions | Government, law, academia |

### AI-Powered Features
- **Per-Section Insights** — Get AI analysis for each CV section (Personal Info, Statement, Experience, Education, Projects, Skills) with scores, strengths, weaknesses, and improvement suggestions.
- **Apply Improvements** — One-click to apply AI-suggested improvements to any section.
- **ATS CV Scoring** — Simulate ATS screening with a full scoring breakdown: keyword match, experience relevance, achievement quality, skills coverage, format, and education (0–100).
- **Achievement Enhancement** — AI rewrites experience bullet points to be more impactful, action-verb-led, and results-quantified.
- **Smart CV Parsing** — AI extracts structured data from raw CV text.
- **Job Description Analysis** — AI identifies key requirements, preferred skills, keywords, and experience level.
- **Intelligent Restructuring** — AI rewrites and reorders your CV to match the target role.

### Multi-AI-Model Support
Use any of these AI models to power your CV generation:

| Provider | Model | Status | Speed |
|----------|-------|--------|-------|
| **GLM (Zhipu AI)** | GLM-4 Flash | Built-in (Z.ai env) / `ZHIPU_API_KEY` (Vercel) | Fast |
| **GLM (Zhipu AI)** | GLM-4 Plus | Built-in (Z.ai env) / `ZHIPU_API_KEY` (Vercel) | Medium |
| **GLM (Zhipu AI)** | GLM-4 Long | Built-in (Z.ai env) / `ZHIPU_API_KEY` (Vercel, 128K context) | Medium |
| **OpenAI** | GPT-4o | API key required | Fast |
| **OpenAI** | GPT-4o Mini | API key required | Fast |
| **Anthropic** | Claude 4 Sonnet | API key required | Medium |
| **Anthropic** | Claude 4 Haiku | API key required | Fast |
| **Google** | Gemini 2.5 Flash | API key required | Fast |
| **Google** | Gemini 2.5 Pro | API key required | Medium |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State Management**: Zustand
- **Database**: Prisma ORM (SQLite)
- **PDF Generation**: pdf-lib
- **DOCX Extraction**: mammoth
- **Animations**: Framer Motion
- **Icons**: Lucide React

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-cv-builder

# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the development server
bun run dev
```

The app will be available at `http://localhost:3000`.

---

## AI Model API Keys

All supported providers and the direct links to obtain API keys:

| Provider | Get API Key | Documentation | Pricing |
|----------|-------------|---------------|---------|
| **GLM (Zhipu AI)** | [open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys) | [open.bigmodel.cn/dev/api](https://open.bigmodel.cn/dev/api) | [open.bigmodel.cn/pricing](https://open.bigmodel.cn/pricing) |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | [platform.openai.com/docs](https://platform.openai.com/docs) | [openai.com/api/pricing](https://openai.com/api/pricing/) |
| **Anthropic** | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | [docs.anthropic.com](https://docs.anthropic.com/en/docs) | [anthropic.com/pricing](https://www.anthropic.com/pricing) |
| **Google AI** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | [ai.google.dev/docs](https://ai.google.dev/docs) | [ai.google.dev/pricing](https://ai.google.dev/pricing) |

### GLM (Zhipu AI) — GLM-4 Flash, GLM-4 Plus, GLM-4 Long
- **Z.ai local environment**: No API key needed. GLM models are powered by `z-ai-web-dev-sdk` automatically.
- **Vercel / external deployments**: Set `ZHIPU_API_KEY` to use the direct Zhipu AI REST API.
- **Get your API key**: [https://open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys)
- **Environment variable**:
  ```env
  ZHIPU_API_KEY=your-zhipu-api-key-here
  ```

### OpenAI — GPT-4o, GPT-4o Mini
- **Get your API key**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Documentation**: [https://platform.openai.com/docs](https://platform.openai.com/docs)
- **Pricing**: [https://openai.com/api/pricing/](https://openai.com/api/pricing/)
- **Environment variable**:
  ```env
  OPENAI_API_KEY=sk-your-openai-api-key-here
  ```

### Anthropic — Claude 4 Sonnet, Claude 4 Haiku
- **Get your API key**: [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **Documentation**: [https://docs.anthropic.com/en/docs](https://docs.anthropic.com/en/docs)
- **Pricing**: [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing)
- **Environment variable**:
  ```env
  ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
  ```

### Google AI — Gemini 2.5 Flash, Gemini 2.5 Pro
- **Get your API key**: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Documentation**: [https://ai.google.dev/docs](https://ai.google.dev/docs)
- **Pricing**: [https://ai.google.dev/pricing](https://ai.google.dev/pricing)
- **Environment variable**:
  ```env
  GOOGLE_AI_API_KEY=your-google-ai-api-key-here
  ```

### Environment Variables Summary

Create a `.env` file in the project root:

```env
# GLM (Zhipu AI) — required for Vercel/external deployments; not needed in Z.ai local env
ZHIPU_API_KEY=your-zhipu-api-key-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Google AI
GOOGLE_AI_API_KEY=your-google-key

# Database (SQLite — set the path for your environment)
DATABASE_URL=file:./dev.db
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with metadata
│   ├── page.tsx                      # Main page (step router)
│   ├── globals.css                   # Global styles
│   ├── error.tsx                     # Global error boundary page
│   ├── not-found.tsx                 # 404 page
│   └── api/
│       ├── route.ts                  # Root API — queue & cache metrics
│       ├── parse-cv/route.ts         # CV text → structured JSON
│       ├── analyze-job/route.ts      # Job description analysis
│       ├── restructure-cv/route.ts   # AI-driven CV restructuring
│       ├── score-cv/route.ts         # ATS simulation & CV scoring
│       ├── enhance-achievements/route.ts  # AI bullet-point enhancer
│       ├── generate-pdf/route.ts     # PDF generation (5 formats)
│       ├── generate-script/route.ts  # Python fpdf2 Europass script
│       ├── generate-insights/route.ts # Per-section AI analysis
│       ├── generate-cover-letter/route.ts      # Cover letter generation
│       ├── generate-cover-letter-pdf/route.ts  # Cover letter PDF (5 formats)
│       ├── extract-file/route.ts     # File upload extraction (DOCX/text)
│       ├── ai-chat/route.ts          # Multi-provider AI chat endpoint
│       └── health/route.ts           # App health — queue/cache/memory stats
├── components/
│   ├── cv-builder/
│   │   ├── landing-page.tsx          # Hero, features, AI models, formats
│   │   ├── step-indicator.tsx        # Progress indicator (4 steps)
│   │   ├── cv-input-step.tsx         # Step 1: Upload/paste CV
│   │   ├── job-desc-step.tsx         # Step 2: Job description
│   │   ├── processing-step.tsx       # Step 3: AI model selection & processing
│   │   └── output-step.tsx           # Step 4: Review, edit, download
│   ├── error-boundary.tsx            # React error boundary component
│   └── ui/                           # shadcn/ui components
├── hooks/
│   ├── use-mobile.ts                 # Mobile breakpoint hook
│   └── use-toast.ts                  # Toast notification hook
├── lib/
│   ├── ai-provider.ts                # Centralized AI gateway (callAI / callAIWithFallback)
│   ├── config.ts                     # App-wide configuration constants
│   ├── cv-types.ts                   # TypeScript types, AI model configs, prompts
│   ├── cv-store.ts                   # Zustand state management
│   ├── api-calls.ts                  # Frontend API call functions
│   ├── db.ts                         # Prisma database client
│   ├── pdf-utils.ts                  # Shared PDF layout utilities
│   ├── rate-limit.ts                 # Rate limiting helpers
│   ├── rate-limiter.ts               # Rate limiter implementation
│   ├── request-queue.ts              # AI & general request queue management
│   ├── response-cache.ts             # Response caching (extraction, parsing)
│   ├── sdk-retry.ts                  # SDK retry / backoff logic
│   ├── text-cleaning.ts              # Text sanitization utilities
│   └── utils.ts                      # Utility functions
└── instrumentation.ts                # Next.js instrumentation
prisma/
└── schema.prisma                     # Database schema
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
| `POST` | `/api/generate-pdf` | Generate tailored CV as PDF (5 formats) |
| `POST` | `/api/generate-script` | Generate Python fpdf2 Europass script |
| `POST` | `/api/generate-insights` | Per-section AI analysis |
| `POST` | `/api/generate-cover-letter` | Generate AI cover letter |
| `POST` | `/api/generate-cover-letter-pdf` | Generate cover letter PDF |
| `POST` | `/api/extract-file` | Extract text from uploaded files (DOCX/text) |
| `POST` | `/api/ai-chat` | Multi-provider AI chat endpoint |
| `GET`  | `/api/health` | App health — queues, cache, memory stats |

---

## How It Works

### CV Upload & Parsing
1. User uploads a DOCX or text file (or pastes text directly)
2. **DOCX files** are processed via `mammoth` for Word document extraction
3. Extracted text is sent to the AI model to parse into structured sections (personal info, experience, education, skills, projects)

### Job Analysis & CV Restructuring
1. User provides a target job description
2. AI analyzes the job for requirements, keywords, skills, and experience level
3. The selected AI model restructures the CV to match the job description — reordering sections, optimizing keywords, strengthening bullet points, and rewriting the personal statement

### Per-Section Insights
1. Each CV section can be individually analyzed against the job description
2. AI provides a score (0-100), strengths, weaknesses, and suggestions
3. Users can apply AI-suggested improvements with one click

### Cover Letter Generation
1. User selects a cover letter format (Professional, Modern, Creative, Concise, Formal)
2. AI generates a tailored cover letter using the CV data, job analysis, and tone instructions
3. Cover letter is fully editable inline
4. Download as PDF in the selected format or copy to clipboard

---

## Deployment Notes

### GLM Model Portability
The app supports GLM models in two ways:

- **Z.ai local environment** — `z-ai-web-dev-sdk` is used automatically. No API key required.
- **Vercel / any external server** — Set the `ZHIPU_API_KEY` environment variable. The app will call the [Zhipu AI REST API](https://open.bigmodel.cn/dev/api) directly.
  1. Get your API key at [https://open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys)
  2. Add `ZHIPU_API_KEY=your-key` to your Vercel environment variables (or `.env` file)
  3. The REST endpoint used is: `https://open.bigmodel.cn/api/paas/v4/chat/completions`

### Environment Variables
Set all required API keys in your deployment environment (Vercel dashboard → Settings → Environment Variables):

| Variable | Required for |
|----------|-------------|
| `ZHIPU_API_KEY` | GLM models on Vercel / non-Z.ai environments |
| `OPENAI_API_KEY` | GPT-4o, GPT-4o Mini |
| `ANTHROPIC_API_KEY` | Claude 4 Sonnet, Claude 4 Haiku |
| `GOOGLE_AI_API_KEY` | Gemini 2.5 Flash, Gemini 2.5 Pro |
| `DATABASE_URL` | Prisma SQLite database (e.g. `file:./dev.db`) |

---

## License

MIT
