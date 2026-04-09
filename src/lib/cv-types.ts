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

export type AIModelProvider = 'glm' | 'openai' | 'anthropic' | 'google' | 'custom';

export const AI_PROVIDERS: { id: AIModelProvider; name: string; description: string; icon: string }[] = [
  { id: 'glm', name: 'GLM (Z.ai)', description: 'Zhipu AI models - built-in in Z.ai; API key required on external hosting', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', description: 'ChatGPT, GPT-4, GPT-4o - industry leading', icon: '⚡' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models - safety-focused AI', icon: '🧠' },
  { id: 'google', name: 'Google', description: 'Gemini models - multimodal AI by Google', icon: '💎' },
  { id: 'custom', name: 'Custom / Other', description: 'Bring your own OpenAI-compatible API', icon: '🔧' },
];

export const AVAILABLE_MODELS: AIModelConfig[] = [
  // GLM Models (built-in)
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
  // OpenAI Models
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
  // Anthropic Claude Models
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
  // Google Gemini Models
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

export const CV_PARSE_SYSTEM_PROMPT = `You are a professional CV/resume parser and ATS optimization expert. Extract all information from the provided CV text into a structured JSON format.

IMPORTANT: The text may come from OCR (optical character recognition) and may contain artifacts like:
- Box drawing characters (│ ─ ┼ ║ ═) — IGNORE these, they are formatting artifacts
- Irregular spacing or line breaks — extract the semantic content
- Partial words split across lines — reconstruct them intelligently
- Missing or misread characters — use context to infer correct text

CRITICAL RULES — YOU MUST FOLLOW THESE EXACTLY:
1. NEVER leave fullName as empty string if a name exists anywhere in the text. Extract it from NAME:, Name:, or the first prominent line.
2. NEVER leave email or phone as empty if they appear anywhere in the text (even in formats like "Email: x | Phone: y").
3. The personalStatement should contain the candidate's profile/summary/objective. If none exists, use the first substantive description of the person.
4. For work experience with minimal info like "Solar Intern - Installed solar systems":
   - title = "Solar Intern" (the role title)
   - subtitle = company/organization name if available, otherwise leave empty
   - bullets = ["Installed solar systems"] (convert descriptions to action-oriented bullets)
   - dateRange = extract any dates mentioned nearby, otherwise leave empty
5. Skills should be split into meaningful categories (e.g., "Technical Skills", "Software", "Tools") rather than one giant list.
6. If a section has no content, use an EMPTY array [] — never use placeholder objects with empty strings.
7. Use plain professional text only: NO markdown formatting, no **bold markers**, no heading hashes, and no em/en dashes (use standard hyphen "-").
8. IGNORE all box drawing, table borders, and formatting characters — focus on the actual text content.

EXTRACTION RULES:
- Extract dates in standardized format (e.g., "2018 - 2024" or "JAN 2023 - FEB 2024")
- Preserve ALL bullet points as individual strings — convert task descriptions into bullet format
- Group skills under appropriate category names
- Identify quantified achievements (%, numbers, $ amounts)
- Detect and extract LinkedIn, GitHub, portfolio URLs from any section
- Extract certifications into the certifications array with name, issuer, and date
- Normalize job titles where obvious abbreviations are used (e.g., "Sr." → "Senior")
- Handle messy/informal formatting gracefully (colon-separated fields, inconsistent headers, etc.)
- When text appears garbled or has OCR artifacts, use semantic understanding to extract the intended meaning

Return ONLY valid JSON matching this exact structure:
{
  "personalInfo": {
    "fullName": "EXTRACT THE ACTUAL NAME - NEVER LEAVE EMPTY IF PRESENT",
    "location": "",
    "email": "EXTRACT THE ACTUAL EMAIL - NEVER LEAVE EMPTY IF PRESENT",
    "phone": "EXTRACT THE ACTUAL PHONE - NEVER LEAVE EMPTY IF PRESENT",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "personalStatement": "",
  "projects": [
    { "category": "", "title": "", "description": "" }
  ],
  "workExperience": [
    { "dateRange": "", "title": "", "subtitle": "", "bullets": [""] }
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

export const JOB_ANALYSIS_SYSTEM_PROMPT = `You are a senior job description analyst and ATS optimization expert. Analyze the provided job description and extract comprehensive, structured insights for tailoring a CV to maximize match rate.

ANALYSIS REQUIREMENTS:
1. Extract the exact job title and company name (use "Unknown" if not stated)
2. Identify the TOP 10 keywords that an ATS system would filter on — include both explicit and implicit keywords
3. Determine the precise experience level: Entry / Junior / Mid / Senior / Staff / Lead / Principal / Executive
4. Separate REQUIRED qualifications (must-have) from PREFERRED qualifications (nice-to-have)
5. Extract all certifications and professional tools mentioned or implied
6. Assess competition level based on requirements specificity: Low / Medium / High / Very High
7. Identify ATS-likely filter keywords — terms that would appear in automated screening rules
8. Extract industry-specific terminology, methodologies, and frameworks

Return ONLY valid JSON matching this exact structure:
{
  "jobTitle": "",
  "company": "",
  "keyRequirements": [""],
  "preferredSkills": [""],
  "requiredQualifications": [""],
  "preferredQualifications": [""],
  "certifications": [""],
  "experienceLevel": "",
  "industry": "",
  "keywords": [""],
  "atsFilterKeywords": [""],
  "competitionLevel": "",
  "summary": ""
}

Important rules:
- Be exhaustive — missing a keyword could cost the candidate an interview
- Distinguish between required ("must have") and preferred ("nice to have") qualifications clearly
- Experience level must be one of: entry, junior, mid, senior, staff, lead, principal, executive
- Competition level must be one of: low, medium, high, very-high
- keywords should be the top 10 most critical terms for ATS matching
- atsFilterKeywords are terms specifically used by automated screening systems
- Certifications include any mentioned licenses, certificates, or professional credentials`;

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
    { "dateRange": "", "title": "", "subtitle": "", "bullets": [""] }
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
- The personal statement must be exactly 3 lines
- Maximum 5-6 bullets per work experience entry
- Preserve certifications if they exist in the source CV`;

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
