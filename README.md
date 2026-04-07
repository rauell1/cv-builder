# AI CV Builder

A full-featured, AI-powered CV/Resume Builder that parses your CV, analyzes job descriptions, and generates perfectly tailored CVs and cover letters in multiple professional formats — all driven by your choice of AI model.

---

## Features

### Multi-Step CV Building Workflow
1. **Upload or Paste Your CV** — Upload a PDF, image (PNG/JPG/WEBP), or plain text file. The app uses robust text extraction (`pdf-parse`) for PDFs and AI-powered OCR (GLM-4V-Flash) for images.
2. **Provide a Job Description** — Paste or upload a job description. The AI analyzes requirements, keywords, skills, and experience level.
3. **Choose Your AI Model** — Select from 9 models across 4 providers. GLM models are built-in; others require API keys.
4. **Review & Download** — Edit every section, generate per-section AI insights, download your tailored CV in 5 formats, and generate cover letters in 5 styles.

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
- **Smart CV Parsing** — AI extracts structured data from raw CV text.
- **Job Description Analysis** — AI identifies key requirements, preferred skills, keywords, and experience level.
- **Intelligent Restructuring** — AI rewrites and reorders your CV to match the target role.

### Multi-AI-Model Support
Use any of these AI models to power your CV generation:

| Provider | Model | Status | Speed |
|----------|-------|--------|-------|
| **GLM (Zhipu AI)** | GLM-4 Flash | Built-in, no key needed | Fast |
| **GLM (Zhipu AI)** | GLM-4 Plus | Built-in, no key needed | Medium |
| **GLM (Zhipu AI)** | GLM-4 Long | Built-in, no key needed (128K context) | Medium |
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
- **PDF Text Extraction**: pdf-parse
- **Image OCR**: GLM-4V-Flash (via z-ai-web-dev-sdk)
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

GLM models are **built-in** and work out of the box — no configuration needed. For other providers, you need to set their API keys as environment variables.

### GLM (Zhipu AI) — Built-in
No API key needed. GLM models are powered by `z-ai-web-dev-sdk` and work automatically in the development environment.

> **Note for production deployment**: GLM models use the `z-ai-web-dev-sdk` which is environment-specific. For deploying outside the Z.ai ecosystem, you'll need your own [Zhipu AI API key](https://open.bigmodel.cn/) and update the API calls to use the direct [Zhipu AI REST API](https://open.bigmodel.cn/dev/api) instead.

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
# GLM models (built-in via z-ai-web-dev-sdk) — no key needed for dev

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Google AI
GOOGLE_AI_API_KEY=your-google-key
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with metadata
│   ├── page.tsx                      # Main page (step router)
│   ├── globals.css                   # Global styles
│   └── api/
│       ├── parse-cv/route.ts         # CV text → structured JSON
│       ├── analyze-job/route.ts      # Job description analysis
│       ├── restructure-cv/route.ts   # AI-driven CV restructuring
│       ├── generate-pdf/route.ts     # PDF generation (5 formats)
│       ├── generate-script/route.ts  # Python fpdf2 Europass script
│       ├── generate-insights/route.ts # Per-section AI analysis
│       ├── generate-cover-letter/route.ts      # Cover letter generation
│       ├── generate-cover-letter-pdf/route.ts  # Cover letter PDF (5 formats)
│       ├── extract-file/route.ts     # File upload extraction (PDF/image/text)
│       └── ai-chat/route.ts         # Multi-provider AI chat endpoint
├── components/
│   ├── cv-builder/
│   │   ├── landing-page.tsx          # Hero, features, AI models, formats
│   │   ├── step-indicator.tsx        # Progress indicator (4 steps)
│   │   ├── cv-input-step.tsx         # Step 1: Upload/paste CV
│   │   ├── job-desc-step.tsx         # Step 2: Job description
│   │   ├── processing-step.tsx       # Step 3: AI model selection & processing
│   │   └── output-step.tsx           # Step 4: Review, edit, download
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── cv-types.ts                   # TypeScript types, AI model configs, prompts
│   ├── cv-store.ts                   # Zustand state management
│   ├── api-calls.ts                  # Frontend API call functions
│   ├── db.ts                         # Prisma database client
│   └── utils.ts                      # Utility functions
prisma/
└── schema.prisma                     # Database schema
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/parse-cv` | Parse raw CV text into structured JSON |
| `POST` | `/api/analyze-job` | Analyze a job description |
| `POST` | `/api/restructure-cv` | AI-restructure CV for a specific job |
| `POST` | `/api/generate-pdf` | Generate tailored CV as PDF (5 formats) |
| `POST` | `/api/generate-script` | Generate Python fpdf2 Europass script |
| `POST` | `/api/generate-insights` | Per-section AI analysis |
| `POST` | `/api/generate-cover-letter` | Generate AI cover letter |
| `POST` | `/api/generate-cover-letter-pdf` | Generate cover letter PDF |
| `POST` | `/api/extract-file` | Extract text from uploaded files |
| `POST` | `/api/ai-chat` | Multi-provider AI chat endpoint |

---

## How It Works

### CV Upload & Parsing
1. User uploads a PDF, image, or text file (or pastes text directly)
2. **PDF files** are parsed using `pdf-parse` for robust text extraction
3. **Images** are processed via GLM-4V-Flash VLM for OCR
4. Extracted text is sent to the AI model to parse into structured sections (personal info, experience, education, skills, projects)

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
The GLM models use `z-ai-web-dev-sdk` which is specific to the Z.ai development environment. When deploying to production outside Z.ai:

1. Get your own API key from [Zhipu AI Open Platform](https://open.bigmodel.cn/)
2. Update the API calls in the backend routes to use the [Zhipu AI REST API](https://open.bigmodel.cn/dev/api) directly
3. The API endpoint format is: `https://open.bigmodel.cn/api/paas/v4/chat/completions`

### Environment Variables
Set all required API keys in your deployment environment. Only GLM models work without an API key in the Z.ai sandbox.

---

## License

MIT
