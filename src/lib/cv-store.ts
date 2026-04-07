import { create } from 'zustand';
import type { ParsedCV, JobAnalysis, SectionInsight, CVFormatId, AIModelConfig, CoverLetterData, CoverLetterFormatId, CVScore } from './cv-types';
import { AVAILABLE_MODELS } from './cv-types';

export type BuilderStep = 'landing' | 'cv-input' | 'job-desc' | 'processing' | 'output';

const MAX_COVER_LETTER_VERSIONS = 10;

interface CVBuilderState {
  step: BuilderStep;
  sessionId: string | null;

  // Step 1: CV Input
  rawCvText: string;
  parsedCv: ParsedCV | null;
  isParsing: boolean;
  parseError: string | null;

  // Step 2: Job Description
  jobDescText: string;
  analyzedJob: JobAnalysis | null;
  isAnalyzing: boolean;
  analyzeError: string | null;

  // Step 3: Processing
  isRestructuring: boolean;
  restructureError: string | null;
  restructureProgress: string;
  modelUsed: string | null;

  // Step 4: Output
  tailoredCv: ParsedCV | null;
  pdfBlobUrl: string | null;
  isGeneratingPdf: boolean;

  // Multi-model support
  selectedModel: AIModelConfig;
  availableModelIds: string[];

  // CV format selection
  selectedFormat: CVFormatId;

  // AI insights per section
  sectionInsights: SectionInsight[];
  isGeneratingInsights: boolean;
  insightError: string | null;

  // CV Scoring
  cvScore: CVScore | null;
  isScoring: boolean;

  // Extraction metadata
  extractionMeta: {
    method: 'native' | 'ocr' | 'direct' | null;
    confidence: number;
    language: string;
    qualityReport: {
      hasEmail: boolean;
      hasPhone: boolean;
      hasEducation: boolean;
      hasExperience: boolean;
      hasSkills: boolean;
      hasProjects: boolean;
      wordCount: number;
      characterCount: number;
      sectionCount: number;
      missingSections: string[];
      qualityScore: number;
      suggestions: string[];
    } | null;
    fileName: string | null;
  } | null;

  // Cover Letter
  coverLetter: CoverLetterData | null;
  selectedCoverLetterFormat: CoverLetterFormatId;
  isGeneratingCoverLetter: boolean;
  coverLetterError: string | null;
  coverLetterVersions: CoverLetterData[];

  // Actions
  setStep: (step: BuilderStep) => void;
  setSessionId: (id: string) => void;
  setRawCvText: (text: string) => void;
  setParsedCv: (cv: ParsedCV | null) => void;
  setIsParsing: (val: boolean) => void;
  setParseError: (err: string | null) => void;
  setJobDescText: (text: string) => void;
  setAnalyzedJob: (analysis: JobAnalysis) => void;
  setIsAnalyzing: (val: boolean) => void;
  setAnalyzeError: (err: string | null) => void;
  setIsRestructuring: (val: boolean) => void;
  setRestructureError: (err: string | null) => void;
  setRestructureProgress: (msg: string) => void;
  setModelUsed: (model: string | null) => void;
  setTailoredCv: (cv: ParsedCV) => void;
  setPdfBlobUrl: (url: string | null) => void;
  setIsGeneratingPdf: (val: boolean) => void;
  setSelectedModel: (model: AIModelConfig) => void;
  setSelectedFormat: (format: CVFormatId) => void;
  setSectionInsights: (insights: SectionInsight[]) => void;
  setIsGeneratingInsights: (val: boolean) => void;
  setInsightError: (err: string | null) => void;
  setCoverLetter: (cl: CoverLetterData | null) => void;
  setSelectedCoverLetterFormat: (format: CoverLetterFormatId) => void;
  setIsGeneratingCoverLetter: (val: boolean) => void;
  setCoverLetterError: (err: string | null) => void;
  addCoverLetterVersion: (cl: CoverLetterData) => void;
  setCvScore: (score: CVScore | null) => void;
  setIsScoring: (val: boolean) => void;
  setExtractionMeta: (meta: CVBuilderState['extractionMeta']) => void;
  reset: () => void;
}

const defaultModel = AVAILABLE_MODELS.find(m => m.id === 'glm-4-plus') || AVAILABLE_MODELS[0];

const initialState = {
  step: 'landing' as BuilderStep,
  sessionId: null as string | null,
  rawCvText: '',
  parsedCv: null as ParsedCV | null,
  isParsing: false,
  parseError: null as string | null,
  jobDescText: '',
  analyzedJob: null as JobAnalysis | null,
  isAnalyzing: false,
  analyzeError: null as string | null,
  isRestructuring: false,
  restructureError: null as string | null,
  restructureProgress: '',
  modelUsed: null as string | null,
  tailoredCv: null as ParsedCV | null,
  pdfBlobUrl: null as string | null,
  isGeneratingPdf: false,
  selectedModel: defaultModel,
  availableModelIds: AVAILABLE_MODELS.map(m => m.id),
  selectedFormat: 'europass' as CVFormatId,
  sectionInsights: [] as SectionInsight[],
  isGeneratingInsights: false,
  insightError: null as string | null,
  coverLetter: null as CoverLetterData | null,
  selectedCoverLetterFormat: 'professional' as CoverLetterFormatId,
  isGeneratingCoverLetter: false,
  coverLetterError: null as string | null,
  coverLetterVersions: [] as CoverLetterData[],
  cvScore: null as CVScore | null,
  isScoring: false,
  extractionMeta: null as CVBuilderState['extractionMeta'],
};

export const useCVBuilderStore = create<CVBuilderState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setSessionId: (id) => set({ sessionId: id }),
  setRawCvText: (text) => set({ rawCvText: text }),
  setParsedCv: (cv) => set({ parsedCv: cv }),
  setIsParsing: (val) => set({ isParsing: val }),
  setParseError: (err) => set({ parseError: err }),
  setJobDescText: (text) => set({ jobDescText: text }),
  setAnalyzedJob: (analysis) => set({ analyzedJob: analysis }),
  setIsAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalyzeError: (err) => set({ analyzeError: err }),
  setIsRestructuring: (val) => set({ isRestructuring: val }),
  setRestructureError: (err) => set({ restructureError: err }),
  setRestructureProgress: (msg) => set({ restructureProgress: msg }),
  setModelUsed: (model) => set({ modelUsed: model }),
  setTailoredCv: (cv) => set({ tailoredCv: cv }),

  // Fixed: revoke previous blob URL to prevent memory leak
  setPdfBlobUrl: (url) => {
    const prev = get().pdfBlobUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ pdfBlobUrl: url });
  },

  setIsGeneratingPdf: (val) => set({ isGeneratingPdf: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedFormat: (format) => set({ selectedFormat: format }),
  setSectionInsights: (insights) => set({ sectionInsights: insights }),
  setIsGeneratingInsights: (val) => set({ isGeneratingInsights: val }),
  setInsightError: (err) => set({ insightError: err }),
  setCoverLetter: (cl) => set({ coverLetter: cl }),
  setSelectedCoverLetterFormat: (format) => set({ selectedCoverLetterFormat: format }),
  setIsGeneratingCoverLetter: (val) => set({ isGeneratingCoverLetter: val }),
  setCoverLetterError: (err) => set({ coverLetterError: err }),

  // Fixed: cap versions to prevent unbounded growth
  addCoverLetterVersion: (cl) => set((state) => {
    const versions = [...state.coverLetterVersions, cl];
    // Keep only the most recent N versions
    if (versions.length > MAX_COVER_LETTER_VERSIONS) {
      versions.splice(0, versions.length - MAX_COVER_LETTER_VERSIONS);
    }
    return { coverLetterVersions: versions };
  }),
  setCvScore: (score) => set({ cvScore: score }),
  setIsScoring: (val) => set({ isScoring: val }),
  setExtractionMeta: (meta) => set({ extractionMeta: meta }),

  // Fixed: revoke blob URL on reset
  reset: () => {
    const prev = get().pdfBlobUrl;
    if (prev) URL.revokeObjectURL(prev);
    set(initialState);
  },
}));
