'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  FileCode,
  RotateCcw,
  Edit3,
  Eye,
  User,
  Briefcase,
  GraduationCap,
  Code2,
  FileText,
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Palette,
  Mail,
  Copy,
  BookOpen,
  Gauge,
  Target,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useCVBuilderStore } from '@/lib/cv-store';
import { generatePdf, generatePythonScript, generateInsights, generateCoverLetter, generateCoverLetterPdf } from '@/lib/api-calls';
import { CV_FORMATS, COVER_LETTER_FORMATS } from '@/lib/cv-types';
import type { ParsedCV, SectionInsight, CoverLetterData, CoverLetterFormatId } from '@/lib/cv-types';
import { toast } from '@/hooks/use-toast';

// Map section store keys to section IDs used by the insights API
const SECTION_IDS: Record<string, string> = {
  personal: 'personal',
  statement: 'statement',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
  skills: 'skills',
};

// Section icon accent colors (kept hardcoded per design system exceptions for semantic colors)
const SECTION_ACCENT_COLORS: Record<string, string> = {
  personal: 'border-l-primary',
  statement: 'border-l-[#15be53]',
  experience: 'border-l-[#9b6829]',
  education: 'border-l-[#15be53]',
  projects: 'border-l-primary',
  skills: 'border-l-primary',
};

function getScoreColorHex(score: number): string {
  if (score >= 75) return '#15be53';
  if (score >= 50) return '#9b6829';
  return '#ea2261';
}

function getPriorityBorderColor(priority: SectionInsight['priority']): string {
  const map = {
    high: 'border-l-[#ea2261]',
    medium: 'border-l-[#9b6829]',
    low: 'border-l-[#15be53]',
  };
  return map[priority];
}

function getPriorityBadge(priority: SectionInsight['priority']) {
  const map = {
    high: { label: 'High Priority', className: 'bg-[#ea2261]/10 text-[#ea2261] border-[#ea2261]/30' },
    medium: { label: 'Medium', className: 'bg-[#9b6829]/10 text-[#9b6829] border-[#9b6829]/30' },
    low: { label: 'Low', className: 'bg-[rgba(21,190,83,0.1)] text-[#108c3d] border-[rgba(21,190,83,0.3)]' },
  };
  const { label, className } = map[priority];
  return <Badge variant="outline" className={`text-[10px] rounded-[4px] ${className}`}>{label}</Badge>;
}

/* ── Animated Number ──────────────────────────────────────────── */

function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <span className={className}>{displayValue}</span>;
}

/* ── CV Score SVG ───────────────────────────────────────────────── */

function CVScoreRing({ score, size = 140, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColorHex(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Glow effect behind the ring */}
      <div
        className="absolute rounded-full blur-xl opacity-25"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          backgroundColor: color,
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5edf5"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          className="text-3xl font-semibold text-foreground tabular-nums"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, type: 'spring', stiffness: 200 }}
        >
          <AnimatedNumber value={score} />
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-light">/100</span>
      </div>
    </div>
  );
}

/* ── Insight Card ────────────────────────────────────────────────── */

function InsightCard({
  insight,
  onApply,
}: {
  insight: SectionInsight;
  onApply: (content: string) => void;
}) {
  const priorityBorder = getPriorityBorderColor(insight.priority);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, x: -8 }}
      animate={{ opacity: 1, height: 'auto', x: 0 }}
      exit={{ opacity: 0, height: 0, x: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`mt-3 p-3 rounded-[6px] border border-border border-l-[3px] ${priorityBorder} bg-muted space-y-2.5`}
    >
      {/* Score bar with gradient fill */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-normal text-muted-foreground w-10">Score</span>
        <div className="flex-1">
          <div className="relative h-2.5 rounded-[4px] bg-border overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${insight.score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-[4px] bg-gradient-to-r from-primary to-primary/70"
            />
          </div>
        </div>
        <span className="text-xs font-normal text-foreground w-8 text-right">{insight.score}</span>
        {getPriorityBadge(insight.priority)}
      </div>

      {/* Strengths */}
      {insight.strengths.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-normal text-[#108c3d] uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Strengths
          </p>
          <ul className="space-y-0.5">
            {insight.strengths.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 font-light">
                <span className="text-[#15be53] mt-0.5 shrink-0">&#10003;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {insight.weaknesses.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-normal text-[#ea2261] uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Weaknesses
          </p>
          <ul className="space-y-0.5">
            {insight.weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 font-light">
                <span className="text-[#ea2261] mt-0.5 shrink-0">&#9888;</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {insight.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-normal text-[#9b6829] uppercase tracking-wide flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> Suggestions
          </p>
          <ul className="space-y-0.5">
            {insight.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 font-light">
                <span className="text-[#9b6829] mt-0.5 shrink-0">&#128161;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Apply Improvement — more prominent with gradient */}
      {insight.improved && insight.improvedContent && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full mt-1 border border-[#b9b9f9] text-primary bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 hover:text-[#4434d4] hover:border-primary text-xs rounded-[4px] font-normal shadow-sm hover:shadow-md transition-all duration-200"
          onClick={() => onApply(insight.improvedContent!)}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Apply AI Improvement
        </Button>
      )}
    </motion.div>
  );
}

/* ── Section Card wrapper for consistent styling ──────────────── */

function SectionCard({
  sectionKey,
  children,
  icon,
  title,
  badge,
}: {
  sectionKey: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}) {
  const accentClass = SECTION_ACCENT_COLORS[sectionKey] || 'border-l-primary';

  return (
    <Card className={`py-4 border border-border border-l-[3px] ${accentClass} rounded-[6px] bg-white transition-shadow duration-200 hover:shadow-sm`}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer flex-1 rounded-[4px] px-2 py-1.5 -mx-2 -my-1.5 group hover:bg-secondary/30 transition-colors duration-200">
            {icon}
            <CardTitle role="heading" aria-level={3} className="text-sm font-normal text-foreground group-hover:text-primary transition-colors duration-200">{title}</CardTitle>
            {badge}
          </div>
          {children}
        </div>
      </CardHeader>
    </Card>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */

export function OutputStep() {
  const {
    tailoredCv,
    analyzedJob,
    jobDescText,
    modelUsed,
    isGeneratingPdf,
    setIsGeneratingPdf,
    setPdfBlobUrl,
    setStep,
    reset,
    setTailoredCv,
    selectedFormat,
    setSelectedFormat,
    sectionInsights,
    setSectionInsights,
    isGeneratingInsights,
    setIsGeneratingInsights,
    insightError,
    setInsightError,
    coverLetter,
    setCoverLetter,
    selectedCoverLetterFormat,
    setSelectedCoverLetterFormat,
    isGeneratingCoverLetter,
    setIsGeneratingCoverLetter,
    coverLetterError,
    setCoverLetterError,
    coverLetterVersions,
    addCoverLetterVersion,
  } = useCVBuilderStore();

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingClPdf, setIsGeneratingClPdf] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [editableCv, setEditableCv] = useState<ParsedCV | null>(null);
  const [editableCoverLetter, setEditableCoverLetter] = useState<CoverLetterData | null>(null);
  const [showCoverLetterPreview, setShowCoverLetterPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    personal: true,
    statement: true,
    experience: true,
    education: true,
    projects: true,
    skills: true,
  });
  const [generatingSectionInsight, setGeneratingSectionInsight] = useState<Record<string, boolean>>({});

  const cv = editableCv || tailoredCv;
  const hasJobAnalysis = !!analyzedJob && !!jobDescText;
  const cl = editableCoverLetter || coverLetter;
  const activeClFormat = COVER_LETTER_FORMATS.find((f) => f.id === selectedCoverLetterFormat) || COVER_LETTER_FORMATS[0];
  const activeFormat = CV_FORMATS.find((f) => f.id === selectedFormat) || CV_FORMATS[0];

  // Calculate overall CV score
  const overallScore = sectionInsights.length > 0
    ? Math.round(sectionInsights.reduce((sum, si) => sum + si.score, 0) / sectionInsights.length)
    : 0;

  const atsScore = (() => {
    const atsInsight = sectionInsights.find((si) => si.sectionId === 'skills' || si.sectionId === 'experience');
    return atsInsight ? atsInsight.score : 0;
  })();

  const keywordCount = analyzedJob?.keywords?.length || 0;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updatePersonalInfo = useCallback(
    (field: string, value: string) => {
      if (!cv) return;
      const base = editableCv || tailoredCv!;
      const updated = {
        ...base,
        personalInfo: { ...cv.personalInfo, [field]: value },
      };
      setEditableCv(updated);
      setTailoredCv(updated);
    },
    [cv, editableCv, tailoredCv, setTailoredCv],
  );

  const updateStatement = useCallback(
    (value: string) => {
      if (!cv) return;
      const base = editableCv || tailoredCv!;
      const updated = { ...base, personalStatement: value };
      setEditableCv(updated);
      setTailoredCv(updated);
    },
    [cv, editableCv, tailoredCv, setTailoredCv],
  );

  const downloadPdf = useCallback(async () => {
    if (!cv) return;
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdf(cv, selectedFormat);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cv.personalInfo.fullName || 'cv'}_${selectedFormat}_cv.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'PDF Downloaded', description: `Your CV has been downloaded as ${activeFormat.name} PDF.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      toast({ title: 'PDF Generation Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [cv, selectedFormat, activeFormat, setIsGeneratingPdf, setPdfBlobUrl]);

  const downloadScript = useCallback(async () => {
    if (!cv) return;
    setIsGeneratingScript(true);
    try {
      const blob = await generatePythonScript(cv);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cv.personalInfo.fullName || 'cv'}_europass_generator.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Script Downloaded', description: 'Python fpdf2 script has been downloaded.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate script';
      toast({ title: 'Script Generation Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingScript(false);
    }
  }, [cv]);

  const generateSingleSectionInsight = useCallback(
    async (sectionKey: string) => {
      if (!cv || !analyzedJob || !jobDescText) return;
      const sectionId = SECTION_IDS[sectionKey];
      if (!sectionId) return;
      setGeneratingSectionInsight((prev) => ({ ...prev, [sectionKey]: true }));
      setInsightError(null);
      try {
        const results = await generateInsights(cv, analyzedJob, jobDescText, sectionId);
        setSectionInsights([...sectionInsights.filter((si) => si.sectionId !== sectionId), ...results]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate insight';
        setInsightError(message);
        toast({ title: 'Insight Error', description: message, variant: 'destructive' });
      } finally {
        setGeneratingSectionInsight((prev) => ({ ...prev, [sectionKey]: false }));
      }
    },
    [cv, analyzedJob, jobDescText, sectionInsights, setSectionInsights, setInsightError],
  );

  const generateAllInsights = useCallback(async () => {
    if (!cv || !analyzedJob || !jobDescText) return;
    setIsGeneratingInsights(true);
    setInsightError(null);
    setGeneratingSectionInsight({ personal: true, statement: true, experience: true, education: true, projects: true, skills: true });
    try {
      const results = await generateInsights(cv, analyzedJob, jobDescText);
      setSectionInsights(results);
      toast({ title: 'All Insights Generated', description: `Analyzed ${results.length} sections of your CV.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate insights';
      setInsightError(message);
      toast({ title: 'Insights Generation Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingInsights(false);
      setGeneratingSectionInsight({});
    }
  }, [cv, analyzedJob, jobDescText, setIsGeneratingInsights, setSectionInsights, setInsightError]);

  const applyImprovement = useCallback(
    (sectionId: string, content: string) => {
      if (!cv) return;
      const base = editableCv || tailoredCv!;
      let updated: ParsedCV;

      try {
        switch (sectionId) {
          case 'statement':
            updated = { ...base, personalStatement: content };
            break;
          case 'skills':
            updated = {
              ...base,
              skills: content.split('\n').filter(Boolean).map((line) => {
                const colonIdx = line.indexOf(':');
                if (colonIdx > 0) return { category: line.slice(0, colonIdx).trim(), skills: line.slice(colonIdx + 1).trim() };
                return { category: 'Skills', skills: line.trim() };
              }),
            };
            break;
          case 'personal': {
            // Try to parse as JSON (object of field updates) or treat as formatted text
            try {
              const parsed = JSON.parse(content);
              if (typeof parsed === 'object' && parsed !== null) {
                updated = { ...base, personalInfo: { ...base.personalInfo, ...parsed } };
              } else {
                updated = base; // Can't apply non-object to personalInfo
              }
            } catch {
              updated = base; // Not valid JSON, can't apply to personalInfo fields
            }
            break;
          }
          case 'experience': {
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                updated = { ...base, workExperience: parsed };
              } else {
                updated = base;
              }
            } catch {
              updated = base;
            }
            break;
          }
          case 'education': {
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                updated = { ...base, education: parsed };
              } else {
                updated = base;
              }
            } catch {
              updated = base;
            }
            break;
          }
          case 'projects': {
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                updated = { ...base, projects: parsed };
              } else {
                updated = base;
              }
            } catch {
              updated = base;
            }
            break;
          }
          default:
            updated = base;
        }
      } catch {
        updated = base;
      }

      setEditableCv(updated);
      setTailoredCv(updated);

      // Only show success toast if something actually changed
      if (updated !== base || sectionId === 'statement' || sectionId === 'skills') {
        toast({ title: 'Improvement Applied', description: 'The section has been updated with AI suggestions.' });
      } else {
        toast({ title: 'Could Not Apply', description: 'The improvement format could not be applied to this section.', variant: 'destructive' });
      }
    },
    [cv, editableCv, tailoredCv, setTailoredCv],
  );

  const getInsightForSection = (sectionKey: string): SectionInsight | undefined => {
    const sectionId = SECTION_IDS[sectionKey];
    return sectionInsights.find((si) => si.sectionId === sectionId);
  };

  // ===== Cover Letter Functions =====
  const handleGenerateCoverLetter = useCallback(async (formatId: CoverLetterFormatId) => {
    if (!cv || !analyzedJob || !jobDescText) return;
    setIsGeneratingCoverLetter(true);
    setCoverLetterError(null);
    try {
      const { coverLetter: newCl, model } = await generateCoverLetter(cv, analyzedJob, jobDescText, formatId, modelUsed || undefined);
      setCoverLetter(newCl);
      setEditableCoverLetter(newCl);
      addCoverLetterVersion(newCl);
      toast({ title: 'Cover Letter Generated', description: `${COVER_LETTER_FORMATS.find(f => f.id === formatId)?.name} cover letter created with ${model}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate cover letter';
      setCoverLetterError(message);
      toast({ title: 'Cover Letter Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }, [cv, analyzedJob, jobDescText, modelUsed, setIsGeneratingCoverLetter, setCoverLetterError, setCoverLetter, addCoverLetterVersion]);

  const handleDownloadCoverLetterPdf = useCallback(async () => {
    if (!cl) return;
    setIsGeneratingClPdf(true);
    try {
      const blob = await generateCoverLetterPdf(cl, selectedCoverLetterFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cl.applicantName || 'cover_letter'}_${selectedCoverLetterFormat}_cover_letter.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Cover Letter PDF Downloaded', description: `Your ${activeClFormat.name} cover letter has been downloaded.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      toast({ title: 'PDF Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingClPdf(false);
    }
  }, [cl, selectedCoverLetterFormat, activeClFormat]);

  const handleCopyCoverLetter = useCallback(() => {
    if (!cl) return;
    const fullText = [cl.greeting, '', cl.openingParagraph, '', ...cl.bodyParagraphs.flatMap(p => [p, '']), cl.closingParagraph, '', cl.signOff, cl.applicantName, cl.applicantContact].join('\n');
    navigator.clipboard.writeText(fullText);
    toast({ title: 'Copied to Clipboard', description: 'Cover letter text copied successfully.' });
  }, [cl]);

  if (!cv) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Skeleton className="w-full max-w-2xl h-96 rounded-[8px]" />
      </div>
    );
  }

  // Helper for section action buttons (insights + toggle)
  const renderSectionActions = (sectionKey: string) => (
    <div className="flex items-center gap-1.5">
      {hasJobAnalysis && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Get AI insights for ${sectionKey}`}
              className="h-7 w-7 text-primary hover:text-[#4434d4] hover:bg-secondary"
              onClick={(e) => { e.stopPropagation(); generateSingleSectionInsight(sectionKey); }}
              disabled={generatingSectionInsight[sectionKey]}
            >
              {generatingSectionInsight[sectionKey]
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className="w-3.5 h-3.5" /></motion.div>
                : <Sparkles className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Get AI Insights</TooltipContent>
        </Tooltip>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Toggle ${sectionKey} section`}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); toggleSection(sectionKey); }}
      >
        {expandedSections[sectionKey] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => setStep('processing')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-light text-foreground tracking-tight">Step 4 of 4: Your Tailored CV</h2>
        </div>
        <div className="w-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left panel - Editable form ─────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Cover Letter Preview */}
          <AnimatePresence>
            {cl && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <Card className="py-4 border-[#b9b9f9] bg-gradient-to-br from-white to-secondary/50 rounded-[6px] relative overflow-hidden">
                  {/* Gradient top border accent */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-primary/50 to-transparent" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <CardTitle role="heading" aria-level={3} className="text-sm font-normal text-foreground">
                          Cover Letter
                          <Badge variant="outline" className="ml-2 text-[10px] rounded-[4px] border-[#b9b9f9] text-primary">
                            {activeClFormat.name}
                          </Badge>
                        </CardTitle>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Toggle cover letter preview" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowCoverLetterPreview(!showCoverLetterPreview)}>
                        {showCoverLetterPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <AnimatePresence initial={false}>
                    {showCoverLetterPreview && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <CardContent className="space-y-4">
                          {/* Recipient info */}
                          <div className="text-xs text-muted-foreground space-y-0.5 font-light">
                            {cl.recipientName && <p>{cl.recipientName}</p>}
                            {cl.recipientTitle && <p>{cl.recipientTitle}</p>}
                            {cl.companyAddress && <p>{cl.companyAddress}</p>}
                            <p className="pt-1">{cl.date}</p>
                          </div>
                          <Separator className="bg-border" />
                          {/* Greeting */}
                          <Textarea value={cl.greeting} onChange={(e) => { const updated = { ...cl, greeting: e.target.value }; setEditableCoverLetter(updated); setCoverLetter(updated); }} className="text-sm min-h-[32px] resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 font-normal text-foreground" />
                          {/* Opening paragraph */}
                          <Textarea value={cl.openingParagraph} onChange={(e) => { const updated = { ...cl, openingParagraph: e.target.value }; setEditableCoverLetter(updated); setCoverLetter(updated); }} className="text-xs leading-relaxed min-h-[60px] resize-y bg-white border border-border rounded-[6px] p-2.5 font-light" />
                          {/* Body paragraphs */}
                          {cl.bodyParagraphs.map((para, idx) => (
                            <Textarea key={idx} value={para} onChange={(e) => { const updatedParas = [...cl.bodyParagraphs]; updatedParas[idx] = e.target.value; const updated = { ...cl, bodyParagraphs: updatedParas }; setEditableCoverLetter(updated); setCoverLetter(updated); }} className="text-xs leading-relaxed min-h-[60px] resize-y bg-white border border-border rounded-[6px] p-2.5 font-light" />
                          ))}
                          {/* Closing paragraph */}
                          <Textarea value={cl.closingParagraph} onChange={(e) => { const updated = { ...cl, closingParagraph: e.target.value }; setEditableCoverLetter(updated); setCoverLetter(updated); }} className="text-xs leading-relaxed min-h-[60px] resize-y bg-white border border-border rounded-[6px] p-2.5 font-light" />
                          <Separator className="bg-border" />
                          {/* Sign-off block */}
                          <div className="text-xs text-muted-foreground space-y-0.5 font-light">
                            <Textarea value={cl.signOff} onChange={(e) => { const updated = { ...cl, signOff: e.target.value }; setEditableCoverLetter(updated); setCoverLetter(updated); }} className="text-sm min-h-[32px] resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 font-normal text-foreground" />
                            <p className="font-normal text-foreground">{cl.applicantName}</p>
                            <p className="text-muted-foreground">{cl.applicantContact}</p>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal Info Section */}
          <SectionCard sectionKey="personal" icon={<User className="w-4 h-4 text-primary" />} title="Personal Information">
            {renderSectionActions('personal')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.personal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Full Name', field: 'fullName' },
                        { label: 'Location', field: 'location' },
                        { label: 'Email', field: 'email' },
                        { label: 'Phone', field: 'phone' },
                        { label: 'LinkedIn', field: 'linkedin' },
                        { label: 'GitHub', field: 'github' },
                      ].map(({ label, field }) => (
                        <div key={field} className="space-y-1.5">
                          <Label className="text-xs text-foreground font-normal">{label}</Label>
                          <Input value={cv.personalInfo[field as keyof typeof cv.personalInfo]} onChange={(e) => updatePersonalInfo(field, e.target.value)} className="text-sm h-8 border-border rounded-[4px] focus-visible:ring-primary" />
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {getInsightForSection('personal') && <InsightCard insight={getInsightForSection('personal')!} onApply={(content) => applyImprovement('personal', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal Statement */}
          <SectionCard sectionKey="statement" icon={<FileText className="w-4 h-4 text-[#15be53]" />} title="Personal Statement">
            {renderSectionActions('statement')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.statement && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0">
                    <Textarea value={cv.personalStatement} onChange={(e) => updateStatement(e.target.value)} className="text-sm min-h-[80px] resize-y border-border rounded-[4px] font-light focus-visible:ring-primary" />
                    <AnimatePresence>
                      {getInsightForSection('statement') && <InsightCard insight={getInsightForSection('statement')!} onApply={(content) => applyImprovement('statement', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Work Experience */}
          <SectionCard
            sectionKey="experience"
            icon={<Briefcase className="w-4 h-4 text-[#9b6829]" />}
            title="Work Experience"
            badge={<Badge variant="secondary" className="text-[10px] bg-secondary text-primary rounded-[4px]">{cv.workExperience.length}</Badge>}
          >
            {renderSectionActions('experience')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.experience && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0 space-y-3">
                    {cv.workExperience.map((exp, idx) => (
                      <div key={idx} className="border border-border rounded-[6px] p-3">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-light">Title</Label>
                            <p className="text-sm font-normal text-foreground">{exp.title}</p>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-light">Company</Label>
                            <p className="text-sm text-foreground font-light">{exp.subtitle}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1.5 font-light">{exp.dateRange}</p>
                        <ul className="space-y-1">
                          {exp.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5 font-light">
                              <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <AnimatePresence>
                      {getInsightForSection('experience') && <InsightCard insight={getInsightForSection('experience')!} onApply={(content) => applyImprovement('experience', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Education */}
          <SectionCard
            sectionKey="education"
            icon={<GraduationCap className="w-4 h-4 text-[#15be53]" />}
            title="Education"
            badge={<Badge variant="secondary" className="text-[10px] bg-secondary text-primary rounded-[4px]">{cv.education.length}</Badge>}
          >
            {renderSectionActions('education')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.education && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0 space-y-3">
                    {cv.education.map((edu, idx) => (
                      <div key={idx} className="border border-border rounded-[6px] p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-light">Degree</Label>
                            <p className="text-sm font-normal text-foreground">{edu.degree}</p>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-light">Institution</Label>
                            <p className="text-sm text-foreground font-light">{edu.institution}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-xs text-muted-foreground font-light">{edu.dateRange}</p>
                          {edu.grade && (
                            <>
                              <span className="text-border">&#8226;</span>
                              <p className="text-xs text-foreground font-light">Grade: {edu.grade}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <AnimatePresence>
                      {getInsightForSection('education') && <InsightCard insight={getInsightForSection('education')!} onApply={(content) => applyImprovement('education', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Projects */}
          <SectionCard
            sectionKey="projects"
            icon={<Lightbulb className="w-4 h-4 text-primary" />}
            title="Projects"
            badge={<Badge variant="secondary" className="text-[10px] bg-secondary text-primary rounded-[4px]">{cv.projects.length}</Badge>}
          >
            {renderSectionActions('projects')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.projects && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0 space-y-3">
                    {cv.projects.map((proj, idx) => (
                      <div key={idx} className="border border-border rounded-[6px] p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] rounded-[4px] border-[#b9b9f9] text-primary">{proj.category}</Badge>
                          <p className="text-sm font-normal text-foreground">{proj.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed font-light">{proj.description}</p>
                      </div>
                    ))}
                    {cv.projects.length === 0 && <p className="text-xs text-muted-foreground italic font-light">No projects listed</p>}
                    <AnimatePresence>
                      {getInsightForSection('projects') && <InsightCard insight={getInsightForSection('projects')!} onApply={(content) => applyImprovement('projects', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skills */}
          <SectionCard
            sectionKey="skills"
            icon={<Code2 className="w-4 h-4 text-primary" />}
            title="Skills"
            badge={<Badge variant="secondary" className="text-[10px] bg-secondary text-primary rounded-[4px]">{cv.skills.length}</Badge>}
          >
            {renderSectionActions('skills')}
          </SectionCard>
          <AnimatePresence initial={false}>
            {expandedSections.skills && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0">
                    <div className="space-y-2">
                      {cv.skills.map((skill, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[11px] mt-0.5 shrink-0 border-border rounded-[4px] text-foreground">{skill.category}</Badge>
                          <p className="text-xs text-muted-foreground leading-relaxed font-light">{skill.skills}</p>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {getInsightForSection('skills') && <InsightCard insight={getInsightForSection('skills')!} onApply={(content) => applyImprovement('skills', content)} />}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Certifications */}
          {cv.certifications && cv.certifications.length > 0 && (
            <SectionCard
              sectionKey="certifications"
              icon={<Shield className="w-4 h-4 text-[#9b6829]" />}
              title="Certifications"
              badge={<Badge variant="secondary" className="text-[10px] bg-secondary text-[#9b6829] rounded-[4px]">{cv.certifications.length}</Badge>}
            >
              {renderSectionActions('certifications')}
            </SectionCard>
          )}
          <AnimatePresence initial={false}>
            {cv.certifications && cv.certifications.length > 0 && expandedSections.certifications !== false && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden -mt-4"
              >
                <Card className="px-6 pb-4 pt-2 border border-border border-t-0 rounded-b-[6px] rounded-t-none">
                  <CardContent className="p-0 space-y-2">
                    {cv.certifications.map((cert, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-[4px] bg-muted/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15be53] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-normal text-foreground">{cert.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-light">
                            {cert.issuer && <span>{cert.issuer}</span>}
                            {cert.issuer && cert.date && <span className="text-border">&#8226;</span>}
                            {cert.date && <span>{cert.date}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right panel - Format Selection, Score & Actions ── */}
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6 lg:self-start">

          {/* CV Score Card */}
          {sectionInsights.length > 0 && (
            <Card className="border border-border rounded-[8px] shadow-stripe-sm bg-white">
              <CardContent className="py-5">
                <h3 className="text-sm font-normal text-foreground mb-4 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  CV Score
                </h3>
                <div className="flex flex-col items-center">
                  <CVScoreRing score={overallScore} />
                  <div className="flex items-center gap-4 mt-4 w-full">
                    <motion.div
                      className="flex-1 text-center p-2.5 rounded-[6px] bg-muted"
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <Target className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground font-light">ATS Score</p>
                      <p className="text-sm font-normal text-foreground tabular-nums">{atsScore || overallScore}</p>
                    </motion.div>
                    <motion.div
                      className="flex-1 text-center p-2.5 rounded-[6px] bg-muted"
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <Zap className="w-4 h-4 mx-auto mb-1 text-[#9b6829]" />
                      <p className="text-[10px] text-muted-foreground font-light">Keywords</p>
                      <p className="text-sm font-normal text-foreground tabular-nums">{keywordCount}</p>
                    </motion.div>
                    <motion.div
                      className="flex-1 text-center p-2.5 rounded-[6px] bg-muted"
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <Sparkles className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground font-light">Sections</p>
                      <p className="text-sm font-normal text-foreground tabular-nums">{sectionInsights.length}</p>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CV Format Selection */}
          <Card className="py-4 border border-border rounded-[6px] bg-white">
            <CardContent>
              <h3 className="text-sm font-normal text-foreground mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                CV Format
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-stripe" role="radiogroup" aria-label="CV Format Selection">
                {CV_FORMATS.map((format) => {
                  const isActive = selectedFormat === format.id;
                  return (
                    <button
                      key={format.id}
                      role="radio"
                      aria-checked={isActive}
                      aria-label={format.name}
                      onClick={() => setSelectedFormat(format.id)}
                      className={`flex-shrink-0 w-[120px] p-2.5 rounded-[6px] border-2 text-left transition-all duration-200 ${isActive ? 'border-primary bg-secondary shadow-stripe-sm' : 'border-transparent bg-muted hover:bg-secondary opacity-70 hover:opacity-100'}`}
                    >
                      <div className="text-lg mb-1">{format.icon}</div>
                      <p className={`text-xs font-normal leading-tight ${isActive ? 'text-foreground' : 'text-foreground'}`}>{format.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2 font-light">{format.description}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-light">Best for: <span className="text-foreground">{activeFormat.bestFor}</span></p>
            </CardContent>
          </Card>

          {/* Actions card - Export & Download */}
          <Card className="py-4 border border-border rounded-[6px] bg-white">
            <CardContent>
              <h3 className="text-sm font-normal text-foreground mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Export & Download
              </h3>
              <div className="space-y-2">
                <Button
                  onClick={downloadPdf}
                  disabled={isGeneratingPdf}
                  className="w-full bg-primary hover:bg-[#4434d4] justify-start rounded-[4px] font-normal text-white shadow-stripe-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-stripe"
                >
                  {isGeneratingPdf
                    ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Download className="w-4 h-4" /></motion.div>Generating PDF...</>)
                    : (<><Download className="w-4 h-4" />Download PDF ({activeFormat.name})</>)
                  }
                </Button>
                <Button variant="ghost" onClick={downloadScript} disabled={isGeneratingScript} className="w-full justify-start border border-border rounded-[4px] font-normal text-foreground hover:bg-muted">
                  {isGeneratingScript
                    ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><FileCode className="w-4 h-4" /></motion.div>Generating Script...</>)
                    : (<><FileCode className="w-4 h-4" />Download Python Script</>)
                  }
                </Button>
              </div>

              <Separator className="my-3 bg-border" />

              <div className="space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground font-normal" onClick={() => { setEditableCv(null); setStep('job-desc'); }}>
                  <Edit3 className="w-4 h-4 mr-2" />Make Another Version
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground font-normal" onClick={reset}>
                  <RotateCcw className="w-4 h-4 mr-2" />Start Over
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cover Letter Generation */}
          {hasJobAnalysis && (
            <Card className="py-4 border-[#b9b9f9] bg-gradient-to-br from-secondary/50 to-white rounded-[6px] relative overflow-hidden">
              {/* Gradient top border accent */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#b9b9f9] to-transparent" />
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowCoverLetterPreview(!showCoverLetterPreview)}>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <CardTitle role="heading" aria-level={3} className="text-sm font-normal text-foreground">Cover Letter</CardTitle>
                    {coverLetterVersions.length > 0 && <Badge variant="secondary" className="text-[10px] bg-secondary text-primary rounded-[4px]">{coverLetterVersions.length} version{coverLetterVersions.length > 1 ? 's' : ''}</Badge>}
                  </div>
                  {showCoverLetterPreview ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              <AnimatePresence>
                {showCoverLetterPreview && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                    <CardContent>
                      <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-3 scrollbar-stripe" role="radiogroup" aria-label="Cover Letter Format Selection">
                        {COVER_LETTER_FORMATS.map((format) => {
                          const isActive = selectedCoverLetterFormat === format.id;
                          return (
                            <button key={format.id} role="radio" aria-checked={isActive} aria-label={format.name} onClick={() => setSelectedCoverLetterFormat(format.id)} className={`flex-shrink-0 w-[95px] p-2 rounded-[6px] border text-left transition-all duration-200 ${isActive ? 'border-primary bg-secondary shadow-stripe-sm' : 'border-transparent bg-muted hover:bg-secondary opacity-60 hover:opacity-100'}`}>
                              <div className="text-base mb-0.5">{format.icon}</div>
                              <p className={`text-[10px] font-normal leading-tight ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{format.name}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3 font-light">Best for: <span className="text-foreground">{activeClFormat.bestFor}</span></p>
                      <Button onClick={() => handleGenerateCoverLetter(selectedCoverLetterFormat)} disabled={isGeneratingCoverLetter} className="w-full border border-[#b9b9f9] text-primary bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/15 hover:to-primary/20 hover:text-[#4434d4] justify-start mb-2 rounded-[4px] font-normal shadow-sm hover:shadow-md transition-all duration-200">
                        {isGeneratingCoverLetter
                          ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className="w-4 h-4" /></motion.div>Generating {activeClFormat.name} Cover Letter...</>)
                          : (<><Sparkles className="w-4 h-4" />Generate {activeClFormat.name} Cover Letter</>)
                        }
                      </Button>
                      {coverLetterError && <p className="text-xs text-[#ea2261] mt-2">{coverLetterError}</p>}
                      {cl && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
                          <Separator className="bg-border" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleDownloadCoverLetterPdf} disabled={isGeneratingClPdf} className="flex-1 bg-primary hover:bg-[#4434d4] justify-start text-xs rounded-[4px] font-normal text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-stripe-sm">
                              {isGeneratingClPdf
                                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Download className="w-3.5 h-3.5 mr-1.5" /></motion.div>
                                : <Download className="w-3.5 h-3.5 mr-1.5" />
                              }
                              PDF ({activeClFormat.name})
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCopyCoverLetter} className="flex-1 justify-start text-xs border border-border rounded-[4px] font-normal text-foreground hover:bg-muted">
                              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy Text
                            </Button>
                          </div>
                          <Button size="sm" variant="ghost" className="w-full justify-start text-muted-foreground text-xs font-normal" onClick={() => { const otherFormats = COVER_LETTER_FORMATS.filter(f => f.id !== selectedCoverLetterFormat); if (otherFormats.length > 0) { const nextFormat = otherFormats[coverLetterVersions.length % otherFormats.length]; setSelectedCoverLetterFormat(nextFormat.id); handleGenerateCoverLetter(nextFormat.id); } }}>
                            <BookOpen className="w-3.5 h-3.5 mr-1.5" />Generate Different Version
                          </Button>
                        </motion.div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {/* Generate All AI Insights */}
          {hasJobAnalysis && (
            <Card className="py-4 border border-border rounded-[6px] bg-white">
              <CardContent>
                <h3 className="text-sm font-normal text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Section Analysis
                </h3>
                <p className="text-xs text-muted-foreground mb-3 font-light">
                  Analyze each section of your CV against the job description.
                </p>
                <Button onClick={generateAllInsights} disabled={isGeneratingInsights} className="w-full border border-[#b9b9f9] text-primary bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/15 hover:to-primary/20 hover:text-[#4434d4] justify-start rounded-[4px] font-normal shadow-sm hover:shadow-md transition-all duration-200">
                  {isGeneratingInsights
                    ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className="w-4 h-4" /></motion.div>Analyzing All Sections...</>)
                    : (<><Sparkles className="w-4 h-4" />Generate All AI Insights</>)
                  }
                </Button>
                {insightError && <p className="text-xs text-[#ea2261] mt-2">{insightError}</p>}
                {sectionInsights.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-normal">Insights generated for {sectionInsights.length} section(s)</p>
                    <div className="flex flex-wrap gap-1">
                      {sectionInsights.map((si) => (
                        <Badge key={si.sectionId} variant="outline" className={`text-[10px] rounded-[4px] ${si.score >= 75 ? 'border-[rgba(21,190,83,0.4)] text-[#108c3d] bg-[rgba(21,190,83,0.1)]' : si.score >= 50 ? 'border-[#9b6829]/30 text-[#9b6829] bg-[#9b6829]/10' : 'border-[#ea2261]/30 text-[#ea2261] bg-[#ea2261]/10'}`}>
                          {si.sectionName}: {si.score}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Model used */}
          <Card className="py-4 border border-border rounded-[6px] bg-white">
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-normal text-muted-foreground">AI Model Used</span>
              </div>
              <Badge variant="outline" className="mt-2 border-[#b9b9f9] text-primary rounded-[4px]">
                {modelUsed || 'GLM-4 Plus'}
              </Badge>
            </CardContent>
          </Card>

          {/* What Changed comparison */}
          <Card className="py-4 border border-border rounded-[6px] bg-white">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowComparison(!showComparison)}>
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#9b6829]" />
                  <CardTitle role="heading" aria-level={3} className="text-sm font-normal text-foreground">What Changed</CardTitle>
                </div>
                {showComparison ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {showComparison && (
              <CardContent className="pt-2">
                <div className="space-y-2.5 text-xs">
                  {[
                    { color: 'bg-[#15be53]', title: 'Personal Statement Rewritten', desc: 'Tailored to align with the target role\'s requirements' },
                    { color: 'bg-primary', title: 'Experience Reordered', desc: 'Most relevant positions moved to the top' },
                    { color: 'bg-[#9b6829]', title: 'Keywords Optimized', desc: 'Job-specific keywords integrated throughout' },
                    { color: 'bg-[#ea2261]', title: 'Bullet Points Enhanced', desc: 'Strengthened with action verbs and measurable results' },
                    { color: 'bg-[#b9b9f9]', title: 'Skills Prioritized', desc: 'Matching skills emphasized based on job analysis' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color} mt-1.5 shrink-0`} />
                      <div>
                        <p className="font-normal text-foreground">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 font-light">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
