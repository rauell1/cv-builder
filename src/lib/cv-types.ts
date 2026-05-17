export interface PersonalInfo {
  fullName: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  website?: string;
}

export interface ProjectEntry {
  category: string;
  title: string;
  description: string;
}

export interface WorkExperience {
  dateRange: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

export interface Education {
  dateRange: string;
  degree: string;
  institution: string;
  grade?: string;
}

export interface SkillCategory {
  category: string;
  skills: string;
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  date?: string;
}

export interface ParsedCV {
  personalInfo: PersonalInfo;
  personalStatement: string;
  projects: ProjectEntry[];
  workExperience: WorkExperience[];
  education: Education[];
  skills: SkillCategory[];
  certifications: CertificationEntry[];
}

export interface JobAnalysis {
  jobTitle: string;
  company: string;
  keyRequirements: string[];
  preferredSkills: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
  certifications: string[];
  experienceLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'staff' | 'lead' | 'principal' | 'executive' | string;
  industry: string;
  keywords: string[];
  atsFilterKeywords: string[];
  competitionLevel: 'low' | 'medium' | 'high' | 'very-high';
  summary: string;
}

export interface SectionInsight {
  sectionId: string;
  sectionName: string;
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
  improved: boolean;
  improvedContent?: string;
  atsKeywordMatch: number; // percentage 0-100
  missingKeywords: string[];
  actionVerbImprovements: string[];
  quantificationSuggestions: string[];
  jobRelevancePriority: number; // 0-100
}

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIModelProvider;
  description: string;
  bestFor: string;
  badge: string;
  badgeColor: string;
  iconColor: string;
  supportsStructuredOutput: boolean;
  maxContextTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  requiresApiKey: boolean;
  apiEnvKey?: string;
}

export type AIModelProvider = 'glm' | 'openai' | 'anthropic' | 'google' | 'nvidia' | 'custom';

export const AI_PROVIDERS: { id: AIModelProvider; name: string; description: string; icon: string }[] = [
  { id: 'glm', name: 'GLM (Z.ai)', description: 'Zhipu AI models - built-in in Z.ai; API key required on external hosting', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', description: 'ChatGPT, GPT-4, GPT-4o - industry leading', icon: '⚡' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models - safety-focused AI', icon: '🧠' },
  { id: 'google', name: 'Google', description: 'Gemini models - multimodal AI by Google', icon: '💎' },
  { id: 'nvidia', name: 'NVIDIA NIM', description: 'Free hosted inference on leading open models via NVIDIA build.nvidia.com', icon: '🟢' },
  { id: 'custom', name: 'Custom / Other', description: 'Bring your own OpenAI-compatible API', icon: '🔧' },
];

export const AVAILABLE_MODELS: AIModelConfig[] = [
  // ─── GLM Models (built-in / always available) ──────────────────────────────
  {
    id: 'glm-4-flash',
    name: 'GLM-4 Flash',
    provider: 'glm',
    description: 'Fast and efficient model optimized for quick processing and parsing tasks',
    bestFor: 'Quick CV parsing, simple text extraction, rapid analysis',
    badge: 'Fast',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'fast',
    requiresApiKey: false,
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'glm',
    description: 'Advanced reasoning and analysis model with strong structured output capabilities',
    bestFor: 'Complex CV restructuring, deep job analysis, comprehensive content generation',
    badge: 'Advanced',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'medium',
    requiresApiKey: false,
  },
  {
    id: 'glm-4-long',
    name: 'GLM-4 Long',
    provider: 'glm',
    description: 'Extended context model supporting up to 128K tokens for lengthy documents',
    bestFor: 'Processing lengthy CVs and detailed job descriptions',
    badge: '128K Context',
    badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
    iconColor: 'text-violet-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'medium',
    requiresApiKey: false,
  },

  // ─── OpenAI Models ──────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'OpenAI\'s flagship multimodal model with excellent reasoning and instruction following',
    bestFor: 'Premium CV restructuring, nuanced content generation, complex analysis',
    badge: 'Flagship',
    badgeColor: 'bg-green-100 text-green-700 border-green-200',
    iconColor: 'text-green-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Cost-effective model with strong capabilities for most CV tasks',
    bestFor: 'Fast CV parsing, job analysis, budget-friendly processing',
    badge: 'Efficient',
    badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'OPENAI_API_KEY',
  },

  // ─── Anthropic Claude Models ────────────────────────────────────────────────
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    provider: 'anthropic',
    description: 'Anthropic\'s balanced model excelling at nuanced writing and analysis',
    bestFor: 'Professional CV writing, detailed restructuring, thoughtful content',
    badge: 'Balanced',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
    iconColor: 'text-orange-600',
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    speed: 'medium',
    requiresApiKey: true,
    apiEnvKey: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'claude-haiku-4-20250414',
    name: 'Claude 4 Haiku',
    provider: 'anthropic',
    description: 'Fast and affordable Claude model for quick tasks',
    bestFor: 'Rapid CV parsing, fast analysis, simple restructuring',
    badge: 'Fast',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'ANTHROPIC_API_KEY',
  },

  // ─── Google Gemini Models ───────────────────────────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Google\'s fast multimodal model with strong reasoning capabilities',
    bestFor: 'Quick processing, image-based job descriptions, fast restructuring',
    badge: 'Multimodal',
    badgeColor: 'bg-sky-100 text-sky-700 border-sky-200',
    iconColor: 'text-sky-600',
    supportsStructuredOutput: true,
    maxContextTokens: 1048576,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Google\'s most capable model with advanced reasoning and 1M token context',
    bestFor: 'Complex CV analysis, comprehensive restructuring, large document processing',
    badge: 'Premium',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    iconColor: 'text-indigo-600',
    supportsStructuredOutput: true,
    maxContextTokens: 1048576,
    speed: 'medium',
    requiresApiKey: true,
    apiEnvKey: 'GOOGLE_AI_API_KEY',
  },

  // ─── NVIDIA NIM Models (free-tier, hosted inference) ───────────────────────
  // All served via https://integrate.api.nvidia.com/v1/chat/completions
  // Requires NVIDIA_API_KEY in Vercel env vars (free at build.nvidia.com)
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    name: 'Mistral Medium 3.5 (NVIDIA)',
    provider: 'nvidia',
    description: 'High-performing 128b model for text generation, coding, and agentic use cases — hosted free on NVIDIA NIM',
    bestFor: 'Complex CV restructuring, detailed content generation, long-context tasks',
    badge: 'Free · 128K',
    badgeColor: 'bg-lime-100 text-lime-700 border-lime-200',
    iconColor: 'text-lime-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'medium',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'deepseek-ai/deepseek-r1-0528',
    name: 'DeepSeek-R1 (NVIDIA)',
    provider: 'nvidia',
    description: 'DeepSeek R1 reasoning model — strong logical analysis and structured output, hosted free on NVIDIA NIM',
    bestFor: 'Job analysis, keyword mapping, logical restructuring',
    badge: 'Free · Reasoning',
    badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    iconColor: 'text-cyan-600',
    supportsStructuredOutput: true,
    maxContextTokens: 64000,
    speed: 'medium',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    name: 'Kimi K2 (NVIDIA)',
    provider: 'nvidia',
    description: '1T MoE model for long-horizon tasks and document understanding — hosted free on NVIDIA NIM',
    bestFor: 'Long CV documents, comprehensive analysis, agentic tasks',
    badge: 'Free · 128K',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    iconColor: 'text-fuchsia-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'slow',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    name: 'Nemotron Super 49b (NVIDIA)',
    provider: 'nvidia',
    description: 'NVIDIA-tuned Llama 3.3 49b — fast and capable for structured generation, hosted free on NVIDIA NIM',
    bestFor: 'Fast CV generation, quick structured output, efficient restructuring',
    badge: 'Free · Fast',
    badgeColor: 'bg-green-100 text-green-700 border-green-200',
    iconColor: 'text-green-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70b (NVIDIA)',
    provider: 'nvidia',
    description: 'Meta Llama 3.3 70b instruction-tuned model hosted free on NVIDIA NIM — reliable general-purpose fallback',
    bestFor: 'General CV tasks, reliable fallback, wide instruction coverage',
    badge: 'Free · General',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    speed: 'fast',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'qwen/qwen3-235b-a22b',
    name: 'Qwen3 235b (NVIDIA)',
    provider: 'nvidia',
    description: 'Alibaba Qwen3 235b MoE with strong reasoning — hosted free on NVIDIA NIM',
    bestFor: 'Deep reasoning, multilingual CVs, comprehensive analysis',
    badge: 'Free · Reasoning',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    iconColor: 'text-purple-600',
    supportsStructuredOutput: true,
    maxContextTokens: 32000,
    speed: 'slow',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
  {
    id: '01-ai/yi-large',
    name: 'Yi Large (NVIDIA)',
    provider: 'nvidia',
    description: '01.ai Yi Large model hosted free on NVIDIA NIM — solid general text generation',
    bestFor: 'General text generation, content rewriting, light restructuring',
    badge: 'Free · General',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
    supportsStructuredOutput: true,
    maxContextTokens: 32000,
    speed: 'medium',
    requiresApiKey: true,
    apiEnvKey: 'NVIDIA_API_KEY',
  },
];

// CV Format Options
export type CVFormatId = 'europass' | 'ats' | 'modern' | 'creative' | 'classic';

export interface CVFormatOption {
  id: CVFormatId;
  name: string;
  description: string;
  bestFor: string;
  icon: string;
  color: string;
}

export const CV_FORMATS: CVFormatOption[] = [
  {
    id: 'europass',
    name: 'Europass',
    description: 'European standard CV format with blue headers and two-column layout',
    bestFor: 'European job applications, academic positions',
    icon: '🇪🇺',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    id: 'ats',
    name: 'ATS-Friendly',
    description: 'Clean, simple format optimized for Applicant Tracking Systems',
    bestFor: 'Corporate jobs, tech companies, online applications',
    icon: '📄',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  },
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Contemporary design with accent sidebar, skills bars, and clean typography',
    bestFor: 'Startups, creative industries, modern companies',
    icon: '✨',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
  },
  {
    id: 'creative',
    name: 'Creative Bold',
    description: 'Eye-catching design with colored headers, icons, and dynamic layout',
    bestFor: 'Design roles, marketing, agencies, creative fields',
    icon: '🎨',
    color: 'bg-rose-50 border-rose-200 hover:bg-rose-100',
  },
  {
    id: 'classic',
    name: 'Classic Traditional',
    description: 'Timeless format with serif fonts, traditional layout, and formal structure',
    bestFor: 'Law, finance, government, conservative industries',
    icon: '📑',
    color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  },
];

export const CV_PARSE_SYSTEM_PROMPT = `You are a professional CV/resume parser and ATS optimization expert. Your sole task is to extract every piece of information from the provided CV text into accurate, structured JSON — even when the input is messy OCR or poorly formatted PDF text.

HANDLING OCR & FORMAT ARTIFACTS:
- Ignore box drawing characters (│ ─ ┼ ║ ═ ┐ ┘ ├ ╔ ╗) — they are table-border artifacts from PDF extraction
- Ignore irregular spacing and line breaks; focus on the semantic meaning
- Reconstruct words split across lines using context
- Interpret garbled or misread characters using surrounding context

MANDATORY EXTRACTION RULES — APPLY ALL OF THESE:
1. fullName: Locate the candidate's full name (usually the first 2–5 word line, no email/URL/numbers). ALWAYS extract if visible anywhere in the text. Never leave empty when a name is present.
2. email: Extract from any format, including "Email: jane@example.com" or "jane.doe@co.uk". ALWAYS extract if present.
3. phone: Extract from any format including "+44 7700 900123", "(555) 867-5309", or "Tel: 07700000000". ALWAYS extract if present.
4. linkedin: Extract full URL or reconstruct from "linkedin.com/in/username" patterns.
5. github: Extract from "github.com/username" patterns.
6. website: Extract any other personal/portfolio URL that is not LinkedIn or GitHub.
7. personalStatement: The summary, profile, about-me, or objective section. Preserve the candidate's original wording — do not rewrite or summarize.
8. workExperience.title = the job role/position title (e.g., "Senior Software Engineer").
9. workExperience.subtitle = the company or organization name.
10. workExperience.dateRange = date range in the original document format (e.g., "Jan 2022 – Present", "2018–2021").
11. workExperience.bullets = each responsibility or achievement as a separate string. Convert prose descriptions to action-verb sentences. Never merge multiple achievements into one string.
12. skills: Group into logical categories (e.g., "Programming Languages", "Frameworks & Libraries", "Cloud & DevOps", "Soft Skills"). The "skills" field is a comma-separated string of skill names.
13. education.degree = full degree name (e.g., "Bachelor of Science in Computer Science").
14. education.institution = university or school name.
15. education.grade = GPA, grade, classification (e.g., "First Class Honours", "3.8 GPA") if stated.
16. certifications = any professional certifications, licenses, or credentials with name, issuer, and date.
17. projects = portfolio items, side projects, or notable work. Use the project title as "title" and a brief description.

FORMATTING RULES:
- Use "" for missing string fields — NEVER use placeholder text like "N/A" or instruction text as values
- Use [] for missing array fields — NEVER use [""] or [{}]
- Plain text only: no **bold**, no _italic_, no # headings
- Use hyphen "-" instead of em-dash "—" or en-dash "–" in text
- Normalize titles: "Sr." → "Senior", "Jr." → "Junior", "Mgr." → "Manager", "Eng." → "Engineer"
- Never fabricate or infer content not explicitly present in the source text

Return ONLY valid JSON — no explanation, no markdown code block, no text before or after the JSON object:
{
  "personalInfo": {
    "fullName": "",
    "location": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "personalStatement": "",
  "projects": [
    { "category": "", "title": "", "description": "" }
  ],
  "workExperience": [
    { "dateRange": "", "title": "", "subtitle": "", "bullets": [] }
  ],
  "education": [
    { "dateRange": "", "degree": "", "institution": "", "grade": "" }
  ],
  "skills": [
    { "category": "", "skills": "" }
  ],
  "certifications": [
    { "name": "", "issuer": "", "date": "" }
  ]
}`;

export const JOB_ANALYSIS_SYSTEM_PROMPT = `You are a senior job description analyst and ATS optimization expert. Analyze the provided job description and extract comprehensive, structured insights to help tailor a CV for maximum interview-shortlisting rate.

EXTRACTION REQUIREMENTS:
1. jobTitle: Exact job title as written in the posting. Use "Not Specified" if absent.
2. company: Company or organization name. Use "Not Specified" if absent.
3. keyRequirements: The 8–10 NON-NEGOTIABLE requirements — skills, technologies, or experiences that would immediately disqualify a candidate if missing. Focus on eliminators, not preferences.
4. preferredSkills: Nice-to-have qualifications — things that would distinguish candidates but are not eliminators.
5. requiredQualifications: Minimum education level, mandatory years of experience, and any required licenses or credentials explicitly stated as required.
6. preferredQualifications: Preferred but not mandatory education, certifications, or experience depth.
7. certifications: Any professional certifications, licenses, or credentials mentioned or strongly implied by the role type (e.g., PMP for project management, AWS for cloud roles).
8. experienceLevel: Infer from responsibilities, required years, and title seniority. Must be EXACTLY one of: entry | junior | mid | senior | staff | lead | principal | executive
9. industry: The specific industry sector (e.g., "FinTech", "Healthcare IT", "SaaS", "E-commerce", "Defense", "Automotive").
10. keywords: The 10 most critical ATS filter terms — include both explicit terms from the posting and implied industry-standard terminology a screener would search for.
11. atsFilterKeywords: Terms automated HR screening systems would specifically scan for — exact job titles, tool names, certifications, and must-have frameworks.
12. competitionLevel: Based on requirements specificity and typical candidate pool size. Must be EXACTLY one of: low | medium | high | very-high
13. summary: 2–3 sentence plain-text overview of the role and ideal candidate profile.

Return ONLY valid JSON — no text before or after the JSON object:
{
  "jobTitle": "",
  "company": "",
  "keyRequirements": [],
  "preferredSkills": [],
  "requiredQualifications": [],
  "preferredQualifications": [],
  "certifications": [],
  "experienceLevel": "mid",
  "industry": "",
  "keywords": [],
  "atsFilterKeywords": [],
  "competitionLevel": "medium",
  "summary": ""
}

Rules:
- Use [] for array fields with no content — NEVER use [""] or ["N/A"] or ["Not specified"].
- experienceLevel must be EXACTLY one of the listed values — no variations, no free text.
- competitionLevel must be EXACTLY one of the listed values — no variations, no free text.
- The keywords array must have 8–10 items — they directly affect whether the candidate's CV passes automated screening.
- Missing a critical keyword costs the candidate an interview — be exhaustive, not conservative.
- Certifications includes any mentioned licenses, certificates, or professional credentials.`;

export const CV_RESTRUCTURE_SYSTEM_PROMPT = `You are a senior CV writer and career strategist with expertise in ATS optimization, recruitment psychology, and modern hiring practices.

TRANSFORMATION RULES:
1. KEYWORD INTEGRATION: Mirror ALL top keywords from the job analysis naturally throughout the CV. Each keyword should appear at least once in context.
2. ACHIEVEMENT QUANTIFICATION: Add measurable impact to every bullet point — use %, numbers, dollar amounts, scale metrics, and timeframes where the original text implies results.
3. ACTION VERBS: Start EVERY bullet point with a strong action verb. Use these specifically: Led, Built, Delivered, Optimized, Implemented, Reduced, Increased, Managed, Developed, Designed, Achieved, Launched, Spearheaded, Transformed, Architected, Streamlined, Accelerated.
4. RELEVANCE ORDERING: Reorder sections to match job priorities — put the most relevant experience and skills first. The first role listed should be the most aligned with the target job.
5. PERSONAL STATEMENT: Rewrite as a 3-line executive summary that directly aligns with the target role, incorporating key industry terminology and demonstrating immediate value.
6. ATS OPTIMIZATION: Ensure keyword density without stuffing. Keywords should flow naturally within achievement statements and skill descriptions.
7. TONE ADAPTATION: Adjust language to the experience level indicated in the job analysis:
   - Entry/Junior: Eager, learning-focused, growth-oriented language
   - Mid: Competent, independent, results-oriented language
   - Senior/Staff/Lead: Strategic, leadership, mentoring, high-impact language
   - Principal/Executive: Visionary, organizational transformation, business-outcome language
8. HONESTY: NEVER fabricate — only enhance, restructure, and amplify what genuinely exists in the source CV.
9. CONCISENESS: Maximum 5-6 bullets per role, each under 2 lines (approximately 25 words). Cut weaker bullets to keep only the strongest.
10. IMPACT FOCUS: Transform task descriptions ("Responsible for...") into achievement statements ("Achieved X by doing Y, resulting in Z").
11. SKILLS ALIGNMENT: Reorder skill categories so the most job-relevant skills appear first. Rename categories to match job description terminology where applicable.
12. EDUCATION: Move education below experience unless the candidate is entry-level (< 3 years experience) or the job specifically prioritizes education.
13. OUTPUT CLEANLINESS: Use plain text only. Do not include markdown symbols such as **, __, or headings. Do not use em/en dashes; use standard hyphen "-".
14. PERSONAL STATEMENT LENGTH: Write 2-4 concise sentences. Do not force a rigid 3-line structure — focus on quality over line count.

Return ONLY valid JSON matching this exact structure:
{
  "personalInfo": {
    "fullName": "",
    "location": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "personalStatement": "",
  "projects": [
    { "category": "", "title": "", "description": "" }
  ],
  "workExperience": [
    { "dateRange": "", "title": "", "subtitle": "", "bullets": [] }
  ],
  "education": [
    { "dateRange": "", "degree": "", "institution": "", "grade": "" }
  ],
  "skills": [
    { "category": "", "skills": "" }
  ],
  "certifications": [
    { "name": "", "issuer": "", "date": "" }
  ]
}

Important rules:
- Keep all personal info exactly as provided
- Do not add fake experiences, education, or skills
- Each bullet MUST start with an action verb
- Each bullet MUST include or imply a measurable result
- The personal statement must be 2-4 concise, impactful sentences — do not pad to hit an exact line count
- Maximum 5-6 bullets per work experience entry
- Preserve certifications if they exist in the source CV
- Use [] for empty arrays in the JSON — never use [""] or placeholder text`;

export const SECTION_INSIGHT_SYSTEM_PROMPT = `You are an expert CV reviewer, ATS optimization specialist, and career coach. Analyze a specific section of a CV against a job description and provide detailed, actionable insights with specific metrics.

ANALYSIS FRAMEWORK:
1. ATS KEYWORD MATCH: Calculate what percentage of critical job keywords appear in this section. Identify each missing keyword.
2. ACTION VERB QUALITY: Check if bullets start with strong action verbs. Suggest specific replacements for weak verbs (e.g., "Helped" → "Facilitated", "Worked on" → "Developed").
3. QUANTIFICATION AUDIT: Identify where numbers, percentages, or scale metrics could be added. Suggest specific quantification for each vague bullet.
4. RELEVANCE SCORING: Rate how well this section's content aligns with the job's top requirements on a 0-100 scale.
5. IMPACT ANALYSIS: Distinguish between task descriptions (what they did) and achievement statements (what they delivered). Push toward achievements.
6. COMPLETENESS CHECK: Identify any critical information for this section type that is missing (e.g., missing dates, missing technologies, missing scale context).

Return ONLY valid JSON matching this exact structure:
{
  "sectionId": "",
  "sectionName": "",
  "score": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "priority": "high" | "medium" | "low",
  "improved": true/false,
  "improvedContent": "improved version of this section content if improvement is needed",
  "atsKeywordMatch": 0-100,
  "missingKeywords": ["keyword1", "keyword2"],
  "actionVerbImprovements": ["Change \"helped\" to \"facilitated\" in bullet 2", "..."],
  "quantificationSuggestions": ["Add team size to bullet 1 (e.g., \"led a team of 8\")", "..."],
  "jobRelevancePriority": 0-100
}

SCORING GUIDELINES:
- 90-100: Exceptional — section is highly optimized for this specific job
- 70-89: Good — strong alignment with minor improvements needed
- 50-69: Adequate — decent but notable gaps in keyword coverage or impact
- 30-49: Weak — significant missing keywords, poor quantification, or low relevance
- 0-29: Critical — major overhaul needed, fundamental misalignment with job requirements

Be specific, constructive, and actionable. Always provide concrete before/after examples in suggestions.`;

// ===== CV SCORING =====

export interface CVScore {
  overallScore: number; // 0-100
  atsScore: number; // 0-100
  keywordMatch: {
    matched: string[];
    missing: string[];
  };
  sectionScores: {
    section: string;
    score: number;
    feedback: string;
  }[];
  weakBullets: string[];
  strengths: string[];
  suggestions: string[];
}

// ===== ACHIEVEMENT ENHANCEMENT =====

export interface AchievementEnhancement {
  enhanced: string[];
  improvements: string[];
}

// ===== COVER LETTER TYPES =====

export interface CoverLetterData {
  recipientName: string;
  recipientTitle: string;
  companyAddress: string;
  date: string;
  greeting: string;
  openingParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  signOff: string;
  applicantName: string;
  applicantContact: string;
}

export type CoverLetterFormatId = 'professional' | 'modern' | 'creative' | 'concise' | 'formal';

export interface CoverLetterFormatOption {
  id: CoverLetterFormatId;
  name: string;
  description: string;
  bestFor: string;
  icon: string;
  color: string;
  tone: string;
}

export const COVER_LETTER_FORMATS: CoverLetterFormatOption[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean, classic business letter format with balanced paragraphs and formal tone',
    bestFor: 'Corporate roles, finance, management, consulting',
    icon: '💼',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    tone: 'Professional and polished. Use formal business language. Maintain a respectful, confident tone. Focus on qualifications and how they match the role.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary style with engaging opening, concise paragraphs, and conversational tone',
    bestFor: 'Tech, startups, creative agencies, marketing',
    icon: '🚀',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    tone: 'Contemporary and engaging. Be conversational yet professional. Show enthusiasm and personality. Use active voice and direct statements.',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Bold storytelling approach with unique narrative and dynamic structure',
    bestFor: 'Design, media, advertising, arts, content creation',
    icon: '🎨',
    color: 'bg-rose-50 border-rose-200 hover:bg-rose-100',
    tone: 'Bold and imaginative. Tell a compelling story. Use vivid language and creative framing. Stand out while remaining relevant to the role.',
  },
  {
    id: 'concise',
    name: 'Concise',
    description: 'Short, impactful letter that gets straight to the point in under 250 words',
    bestFor: 'Busy hiring managers, HR screenings, online applications with character limits',
    icon: '⚡',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    tone: 'Direct and impactful. Get straight to the point. Use short paragraphs. Highlight only the most compelling qualifications. Keep it under 250 words.',
  },
  {
    id: 'formal',
    name: 'Formal',
    description: 'Traditional letter with formal address, structured paragraphs, and deferential language',
    bestFor: 'Government, law, academia, diplomacy, executive roles',
    icon: '🏛️',
    color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    tone: 'Highly formal and respectful. Use traditional business letter conventions. Include formal salutation and closing. Emphasize qualifications with measured language.',
  },
];

export const COVER_LETTER_SYSTEM_PROMPT = `You are a senior cover letter writer and career strategist with deep expertise in recruitment psychology, persuasive writing, and modern hiring practices.

You will receive:
1. The candidate's CV data (structured JSON with personal info, experience, education, skills, projects)
2. The job analysis (job title, company, requirements, preferred skills, keywords, ATS filter keywords)
3. The full job description text
4. A cover letter style/tone instruction

Generate a cover letter that follows these principles:

1. MIRROR KEY TERMINOLOGY: Use the exact job title, key technologies, and industry terms from the job description. This demonstrates familiarity and alignment.
2. REFERENCE 2-3 SPECIFIC ACHIEVEMENTS: Pull concrete, quantified accomplishments from the CV that directly map to the job's top requirements. Be specific — use numbers, outcomes, and scope.
3. OPEN WITH IMPACT: Begin with a compelling hook that shows genuine knowledge of the company/role and immediate value proposition. Avoid generic openings like "I am writing to express my interest."
4. ADDRESS POTENTIAL OBJECTIONS PROACTIVELY: If there's a gap in experience or a career change, address it briefly and positively by reframing as a strength.
5. CONNECT QUALIFICATIONS TO BUSINESS IMPACT: Don't just list skills — explain how your experience translates to results for THIS company in THIS role.
6. USE KEYWORDS NATURALLY: Integrate relevant keywords from the job analysis without stuffing. They should flow naturally within achievement narratives.
7. MAINTAIN TONE: Follow the specified tone instruction precisely — adapt language complexity and formality accordingly.
8. STAY HONEST: Only reference qualifications, experiences, and skills that exist in the CV data. Never fabricate or exaggerate.
9. KEEP UNDER 400 WORDS (unless the formal format is selected): Be concise and impactful. Every sentence must earn its place.
10. END WITH CONFIDENT CALL TO ACTION: Close with a forward-looking statement that expresses enthusiasm for an interview and suggests next steps.
11. FORMATTING RULE: Use plain professional text only. Do not include markdown symbols (e.g., **, __, #) and do not use em/en dashes; use standard hyphen "-".

Return ONLY valid JSON matching this exact structure:
{
  "recipientName": "Hiring Manager's name or 'Hiring Manager'",
  "recipientTitle": "Job title from the description or 'Hiring Team'",
  "companyAddress": "Company name and location",
  "date": "Today's date in 'Month Day, Year' format",
  "greeting": "Dear [Name],",
  "openingParagraph": "Compelling opening with specific reference to the role/company...",
  "bodyParagraphs": ["Body paragraph with 1-2 specific achievements mapped to requirements...", "..."],
  "closingParagraph": "Confident forward-looking closing with call to action...",
  "signOff": "Sincerely,",
  "applicantName": "Candidate's full name",
  "applicantContact": "Email | Phone"
}

Important rules:
- Use real information from the CV — never fabricate
- Reference 2-3 specific, quantified achievements from the CV
- Mirror exact job title and key terminology from the job description
- Address any potential objections (career gaps, industry changes) positively
- Match the tone instruction exactly
- Include the company name naturally throughout the letter
- Make the closing paragraph confident and forward-looking
- Keep the applicant name and contact from the CV's personalInfo
- Total word count should be under 400 words unless formal format`;

export const CV_SCORE_SYSTEM_PROMPT = `You are an ATS (Applicant Tracking System) simulation engine and CV scoring expert. Evaluate this CV against the job description and provide a comprehensive scoring breakdown.

SCORING CRITERIA (weighted):
1. KEYWORD MATCH (25%): Are the top job keywords present in the CV? Check both explicit and implicit keyword usage.
2. EXPERIENCE RELEVANCE (25%): Does the candidate's experience align with the job's core requirements? Consider years, scope, and domain.
3. ACHIEVEMENT QUALITY (20%): Are bullet points quantified with measurable outcomes (%, numbers, scale, $)? Do they start with strong action verbs?
4. SKILLS COVERAGE (15%): Are required skills present in the CV? Are they prominent enough for ATS detection?
5. FORMAT & STRUCTURE (10%): Is the CV clean, professional, and ATS-friendly? Proper section ordering?
6. EDUCATION (5%): Does the candidate meet minimum educational requirements?

EVALUATION RULES:
- Be objective and data-driven — score based on evidence, not assumptions
- overallScore: Weighted composite of all criteria (0-100)
- atsScore: Simulated ATS pass probability (0-100) — how likely this CV passes automated screening
- keywordMatch: Split job keywords into matched (found in CV) and missing (not found)
- sectionScores: Score each major CV section individually with specific feedback
- weakBullets: Identify specific bullet points that are vague, passive, or unquantified (quote the actual bullet text)
- strengths: List 3-5 specific things the CV does well
- suggestions: List 3-5 actionable improvements ordered by impact

Return ONLY valid JSON matching this exact structure:
{
  "overallScore": 0-100,
  "atsScore": 0-100,
  "keywordMatch": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"]
  },
  "sectionScores": [
    { "section": "Personal Statement", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Work Experience", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Education", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Skills", "score": 0-100, "feedback": "Specific feedback..." },
    { "section": "Projects", "score": 0-100, "feedback": "Specific feedback..." }
  ],
  "weakBullets": ["Exact text of weak bullet 1", "Exact text of weak bullet 2"],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

export const ACHIEVEMENT_ENHANCER_SYSTEM_PROMPT = `You are a CV achievement optimization expert. Rewrite the following experience bullet points to be significantly more impactful.

RULES:
- Start EVERY bullet with a strong action verb (Led, Built, Delivered, Optimized, Implemented, Reduced, Increased, Managed, Developed, Designed, Achieved, Launched, Spearheaded, Transformed, Architected, Streamlined, Accelerated, Pioneered, Negotiated, Mentored)
- Add MEASURABLE RESULTS — numbers, percentages, dollar amounts, scale metrics
- Focus on OUTCOMES and IMPACT, not tasks or responsibilities
- Keep each bullet under 2 lines (approximately 25 words)
- Transform passive descriptions into active achievement statements
- If a job context is provided, align language to that industry/role
- Do NOT fabricate achievements — only amplify what is implied or reasonably inferred from the original text
- Maintain the original meaning and scope — do not change what was actually done

Return JSON: { "enhanced": ["improved bullet 1", "improved bullet 2", ...], "improvements": ["Added quantified impact to bullet 1", "Changed passive to active voice in bullet 2", ...] }

The "enhanced" array must have the same length as the input bullets array.
The "improvements" array must have the same length, describing what was changed in each bullet.`;
