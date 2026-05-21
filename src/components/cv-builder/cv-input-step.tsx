'use client';

import { useCallback, useRef, useState, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Briefcase,
  GraduationCap,
  Code2,
  ImageIcon,
  File,
  Info,
  RefreshCw,
  FileUp,
  FileSearch,
  Eye,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Pencil,
  Globe,
  AlertTriangle,
  Shield,
  Sparkles,
  BarChart3,
  LayoutList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCVBuilderStore } from '@/lib/cv-store';
import { parseCv, extractFile, type ExtractFileResult } from '@/lib/api-calls';
import { toast } from '@/hooks/use-toast';

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const ACCEPTED_EXTENSIONS = ['.txt', '.docx'];
const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const AUTO_PARSE_MIN_LENGTH = 50;

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
};

/* ═══════════════════════════════════════════════════════════
   Helper Types & Functions
   ═══════════════════════════════════════════════════════════ */

type FileTypeCategory = 'pdf' | 'image' | 'text' | 'docx';

function getFileTypeCategory(fileName: string): FileTypeCategory {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return 'image';
  if (ext === 'docx') return 'docx';
  return 'text';
}

function _getFileTypeIcon(type: FileTypeCategory, className?: string) {
  switch (type) {
    case 'pdf':
      return <FileText className={className ?? 'w-5 h-5'} />;
    case 'image':
      return <ImageIcon className={className ?? 'w-5 h-5'} />;
    case 'docx':
      return <FileText className={className ?? 'w-5 h-5'} />;
    case 'text':
      return <File className={className ?? 'w-5 h-5'} />;
  }
}

function isAcceptedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
}

function getQualityColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 70) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 40) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
}

function getQualityBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getQualityLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Low';
}

function getMethodBadge(method: 'native' | 'ocr' | 'direct') {
  switch (method) {
    case 'native':
      return { label: 'Native Text', icon: <FileText className="w-3 h-3" />, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'ocr':
      return { label: 'AI OCR', icon: <Eye className="w-3 h-3" />, className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'direct':
      return { label: 'Direct', icon: <File className="w-3 h-3" />, className: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-emerald-600';
  if (confidence >= 40) return 'text-amber-600';
  return 'text-red-600';
}

/* ═══════════════════════════════════════════════════════════
   CvInputStep Component
   ═══════════════════════════════════════════════════════════ */

export function CvInputStep() {
  const {
    rawCvText,
    parsedCv,
    isParsing,
    parseError,
    sessionId,
    setRawCvText,
    setParsedCv,
    setIsParsing,
    setParseError,
    setStep,
    setSessionId,
    setModelUsed,
    setExtractionMeta,
  } = useCVBuilderStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* ── Server health check ── */
  const [serverOnline, setServerOnline] = useState(true);
  useEffect(() => {
    const checkServer = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/extract-file', { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        setServerOnline(res.ok || res.status === 405); // 405 = method not allowed but server is up
      } catch {
        setServerOnline(false);
      }
    };
    // Check once on mount, then every 30s
    checkServer();
    const interval = setInterval(checkServer, 30_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Local state ── */
  const [activeTab, setActiveTab] = useState<string>('paste');
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);

  // Full extraction result (metadata for quality display)
  const [extractionResult, setExtractionResult] = useState<ExtractFileResult | null>(null);

  // In-progress extraction info (for progress indicator)
  const [processingFileName, setProcessingFileName] = useState<string | null>(null);
  const [processingFileType, setProcessingFileType] = useState<FileTypeCategory>('text');
  const [extractionPhase, setExtractionPhase] = useState(0);

  // Text preview
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  /* ── Extraction phase animation ── */
  useEffect(() => {
    phaseTimersRef.current.forEach(clearTimeout);
    phaseTimersRef.current = [];

    if (!isExtracting) {
      setExtractionPhase(0);
      return;
    }

    // Phase 1 starts immediately
    setExtractionPhase(1);

    const isPdfOrImage = processingFileType === 'pdf' || processingFileType === 'image';

    // Phase 2 after 1 second
    const t1 = setTimeout(() => setExtractionPhase(2), 1000);
    phaseTimersRef.current.push(t1);

    // Phase 3 for OCR-sensitive formats
    if (isPdfOrImage) {
      const t2 = setTimeout(() => setExtractionPhase(3), 2000);
      phaseTimersRef.current.push(t2);
    }

    return () => {
      phaseTimersRef.current.forEach(clearTimeout);
      phaseTimersRef.current = [];
    };
  }, [isExtracting, processingFileType]);

  /* ── Derived data ── */
  const qualityReport = extractionResult?.qualityReport;
  const methodBadge = extractionResult ? getMethodBadge(extractionResult.extractionMethod) : null;
  const detectedLanguage = extractionResult
    ? LANGUAGE_MAP[extractionResult.detectedLanguage] || extractionResult.detectedLanguage
    : null;

  const isAnyLoading = isParsing || isExtracting;

  /* ── AI Parse ── */
  const handleParse = useCallback(async () => {
    if (!rawCvText.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parseCv(rawCvText, sessionId || undefined);
      setParsedCv(result.data);
      // Store sessionId and model in Zustand for downstream steps
      if (result.sessionId) setSessionId(result.sessionId);
      if (result.model) setModelUsed(result.model);
      toast({
        title: 'CV Parsed Successfully',
        description: `Parsed with ${result.model}${result.cached ? ' (cached)' : ''} in ${result.parseTimeMs ? `${(result.parseTimeMs / 1000).toFixed(1)}s` : ''}. All sections extracted.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CV';
      setParseError(message);
      toast({
        title: 'Parse Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  }, [rawCvText, sessionId, setIsParsing, setParseError, setParsedCv, setSessionId, setModelUsed]);

  /* ── File Extraction ── */
  // Store last uploaded file for retry
  const lastFileRef = useRef<File | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!isAcceptedFile(file)) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a .txt or .docx file, or paste your CV text directly.',
          variant: 'destructive',
        });
        return;
      }

      // Warn for large files (>5MB) but still allow upload
      const FIVE_MB = 5 * 1024 * 1024;
      if (file.size > FIVE_MB) {
        toast({
          title: 'Large File Warning',
          description: `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Large files may take longer to process. If upload fails, try pasting your CV text directly.`,
          variant: 'default',
        });
      }

      // Store file for retry
      lastFileRef.current = file;
      setLastFileName(file.name);

      // Reset previous extraction state
      setExtractError(null);
      setExtractWarning(null);
      setExtractionResult(null);
      setIsExtracting(true);
      setProcessingFileName(file.name);
      setProcessingFileType(getFileTypeCategory(file.name));
      setShowFullPreview(false);
      setIsPreviewOpen(true);

      try {
        const result = await extractFile(file, { fast: false, parse: false, timeoutMs: 90_000 });

        // Populate the paste textarea so user can see/edit
        setRawCvText(result.text);

        // Store full extraction result for quality display
        setExtractionResult(result);

        // Show warning if present (e.g., scanned PDF)
        if (result.warning) {
          setExtractWarning(result.warning);
        }

        // Store extraction metadata in Zustand
        setExtractionMeta({
          method: result.extractionMethod,
          confidence: result.confidence,
          language: result.detectedLanguage,
          qualityReport: result.qualityReport,
          fileName: result.fileName,
        });

        toast({
          title: 'File Extracted',
          description: `Extracted ${result.text.length.toLocaleString()} characters from ${file.name}.`,
        });

        // Prefer server-side parsed data from extract-file when available
        if (result.data) {
          setParsedCv(result.data);
          if (result.model) setModelUsed(result.model);
          toast({
            title: 'CV Parsed Successfully',
            description: `Parsed with ${result.model || 'AI model'} from uploaded file. All sections extracted.`,
          });
        } else if (result.partialSuccess && result.parseError) {
          setParseError(result.parseError);
          toast({
            title: 'Parse Error',
            description: result.parseError,
            variant: 'destructive',
          });
        } else if (result.text.trim().length > AUTO_PARSE_MIN_LENGTH) {
          // Fallback: parse extracted text in a separate call
          setIsParsing(true);
          setParseError(null);
          try {
            const parsed = await parseCv(result.text, sessionId || undefined);
            setParsedCv(parsed.data);
            if (parsed.sessionId) setSessionId(parsed.sessionId);
            if (parsed.model) setModelUsed(parsed.model);
            toast({
              title: 'CV Parsed Successfully',
              description: `Parsed with ${parsed.model} from uploaded file. All sections extracted.`,
            });
          } catch (parseErr) {
            const message = parseErr instanceof Error ? parseErr.message : 'Failed to parse CV';
            setParseError(message);
            toast({
              title: 'Parse Error',
              description: message,
              variant: 'destructive',
            });
          } finally {
            setIsParsing(false);
          }
        }
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Failed to extract file content';
        // Distinguish error types for better UX
        const isNetworkError = rawMessage === 'NETWORK_ERROR' ||
          rawMessage.includes('Failed to fetch') ||
          rawMessage.includes('NetworkError');
        const isGatewayError = !isNetworkError &&
          (rawMessage.includes('502') || rawMessage.includes('503') || rawMessage.includes('504'));
        const isTimeout = rawMessage.includes('timed out') || rawMessage.includes('Timeout');

        let displayMessage: string;
        let toastTitle: string;
        let toastDescription: string;

        if (isNetworkError) {
          displayMessage = 'The server is currently unreachable. This usually resolves within a few seconds. Please try again.';
          toastTitle = 'Server Unreachable';
          toastDescription = 'The server may be restarting. Click "Retry Upload" to try again.';
        } else if (isGatewayError) {
          displayMessage = 'The server could not process your request. This is usually a temporary issue.';
          toastTitle = 'Server Busy';
          toastDescription = 'The server is under heavy load. Retried multiple times automatically.';
        } else if (isTimeout) {
          displayMessage = 'The request took too long. The file may be too large or the server is busy.';
          toastTitle = 'Request Timed Out';
          toastDescription = 'Try a smaller file or paste your CV text directly.';
        } else {
          displayMessage = rawMessage;
          toastTitle = 'Extraction Failed';
          toastDescription = displayMessage.length > 150 ? displayMessage.substring(0, 150) + '...' : displayMessage;
        }

        setExtractError(displayMessage);
        console.error('[CvInputStep] File extraction error:', rawMessage);
        toast({
          title: toastTitle,
          description: toastDescription,
          variant: 'destructive',
        });
      } finally {
        setIsExtracting(false);
        setProcessingFileName(null);
      }
    },
    [setRawCvText, sessionId, setIsParsing, setParseError, setParsedCv, setSessionId, setModelUsed, setExtractionMeta],
  );

  /* ── Retry Upload (same file) ── */
  const [retryCount, setRetryCount] = useState(0);
  const handleRetryUpload = useCallback(() => {
    if (lastFileRef.current) {
      setRetryCount(prev => prev + 1);
      setExtractError(null);
      handleFileUpload(lastFileRef.current);
    }
  }, [handleFileUpload]);

  /* ── Drag & Drop ── */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /* ── Drop zone keyboard handler ── */
  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  /* ── Reset handler ── */
  const handleReset = useCallback(() => {
    setParsedCv(null);
    setRawCvText('');
    setExtractWarning(null);
    setExtractError(null);
    setExtractionResult(null);
    setExtractionPhase(0);
    setShowFullPreview(false);
    setIsPreviewOpen(true);
    lastFileRef.current = null;
    setLastFileName(null);
  }, [setParsedCv, setRawCvText]);

  /* ── Phase configuration for progress indicator ── */
  const showOcrPhase = processingFileType === 'pdf' || processingFileType === 'image';
  const phaseConfig = [
    { number: 1, label: 'Read', icon: <FileUp className="w-4 h-4" /> },
    { number: 2, label: 'Extract', icon: <FileSearch className="w-4 h-4" /> },
    { number: 3, label: 'AI OCR', icon: <Eye className="w-4 h-4" /> },
  ].filter((p) => p.number !== 3 || showOcrPhase);

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => setStep('landing')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-foreground tracking-tight">Step 1 of 4: Upload Your CV</h2>
          {/* Server status indicator */}
          {!serverOnline && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Server reconnecting…
            </motion.div>
          )}
        </div>
        <div className="w-20" />
      </div>

      {/* ── Extraction warning banner ── */}
      <AnimatePresence>
        {extractWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert className="border-amber-300 bg-amber-50 text-amber-800">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Low Quality Extraction</AlertTitle>
              <AlertDescription className="text-amber-700">
                {extractWarning} You may get better results by pasting the text directly or using a higher quality scan.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Extraction error banner ── */}
      <AnimatePresence>
        {extractError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {extractError.includes('unreachable') ? 'Server Unreachable' :
                 extractError.includes('busy') ? 'Server Busy' :
                 extractError.includes('timed out') ? 'Request Timed Out' :
                 'File Extraction Failed'}
              </AlertTitle>
              <AlertDescription>
                <div className="whitespace-pre-line mb-3">{extractError}</div>
                <div className="flex flex-wrap gap-2">
                  {lastFileName && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                      onClick={handleRetryUpload}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Retry Upload{retryCount > 0 ? ` (${retryCount})` : ''}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => {
                      setExtractError(null);
                      setActiveTab('paste');
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Paste Text Instead
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => {
                      setExtractError(null);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Try Different File
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          Quality Report Card (shown after extraction)
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {extractionResult && !extractError && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <Card className="border-border bg-white shadow-stripe-sm rounded-2xl relative overflow-hidden">
              {/* Gradient accent line at top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-[#b9b9f9] to-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-medium text-foreground">
                      Extraction Report
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                    {extractionResult.fileName}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Score / Method / Confidence ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Quality Score */}
                  <div
                    className={`rounded-xl p-4 border ${getQualityColor(qualityReport?.qualityScore ?? 0).bg} ${getQualityColor(qualityReport?.qualityScore ?? 0).border}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Quality Score
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${getQualityColor(qualityReport?.qualityScore ?? 0).border} ${getQualityColor(qualityReport?.qualityScore ?? 0).text}`}
                      >
                        {getQualityLabel(qualityReport?.qualityScore ?? 0)}
                      </Badge>
                    </div>
                    <p className={`text-4xl font-bold leading-tight ${getQualityColor(qualityReport?.qualityScore ?? 0).text}`}>
                      {qualityReport?.qualityScore ?? 0}
                      <span className="text-sm font-normal text-muted-foreground/60">/100</span>
                    </p>
                    {/* Custom progress bar (not shadcn Progress to allow color customization) */}
                    <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden mt-2.5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${getQualityBarColor(qualityReport?.qualityScore ?? 0)}`}
                        style={{ width: `${qualityReport?.qualityScore ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Extraction Method */}
                  <div className="rounded-xl p-3 border border-border bg-muted hover:shadow-sm hover:border-primary/20 transition-all duration-200 cursor-default">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Method
                    </span>
                    <div className="mt-2.5">
                      {methodBadge && (
                        <Badge variant="outline" className={methodBadge.className}>
                          {methodBadge.icon}
                          {methodBadge.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-2">
                      {extractionResult.extractionMethod === 'ocr'
                        ? 'Vision AI was used to read the document'
                        : extractionResult.extractionMethod === 'native'
                          ? 'Text was extracted natively from the file'
                          : 'Plain text was read directly'}
                    </p>
                  </div>

                  {/* Confidence + Language */}
                  <div className="rounded-xl p-3 border border-border bg-muted hover:shadow-sm hover:border-primary/20 transition-all duration-200 cursor-default">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Confidence
                      </span>
                      {detectedLanguage && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                          <Globe className="w-2.5 h-2.5 mr-0.5" />
                          {detectedLanguage}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${getConfidenceColor(extractionResult.confidence)}`}>
                      {extractionResult.confidence}%
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {extractionResult.confidence >= 70
                        ? 'High confidence extraction'
                        : extractionResult.confidence >= 40
                          ? 'Moderate confidence — review recommended'
                          : 'Low confidence — consider pasting text directly'}
                    </p>
                  </div>
                </div>

                {/* ── Stats row with divider dots ── */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{qualityReport?.wordCount ?? 0} words</span>
                  </div>
                  <span className="text-muted-foreground/30 text-base leading-none">·</span>
                  <div className="flex items-center gap-1">
                    <span>{qualityReport?.characterCount ?? 0} characters</span>
                  </div>
                  <span className="text-muted-foreground/30 text-base leading-none">·</span>
                  <div className="flex items-center gap-1">
                    <LayoutList className="w-3 h-3" />
                    <span>{qualityReport?.sectionCount ?? 0} sections</span>
                  </div>
                </div>

                {/* ── Missing Sections (softer amber) ── */}
                {qualityReport && qualityReport.missingSections.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50/40 border border-amber-200/60 rounded-xl p-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-amber-700 font-medium">Missing sections:</span>
                      {qualityReport.missingSections.map((section) => (
                        <Badge
                          key={section}
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700 border-amber-200/60 capitalize"
                        >
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          Text Preview Panel (collapsible, after extraction)
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {extractionResult && !extractError && extractionResult.text.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="mb-4"
          >
            <Collapsible open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <Card className="border-border bg-white overflow-hidden rounded-2xl">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-3 cursor-pointer hover:bg-secondary/60 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <CardTitle className="text-sm font-medium text-foreground">
                          Extracted Text Preview
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {extractionResult.text.length.toLocaleString()} chars
                        </Badge>
                      </div>
                      {isPreviewOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    <div className="relative rounded-xl border border-border overflow-hidden">
                      <pre className="text-xs font-mono text-foreground/80 bg-muted p-4 whitespace-pre-wrap break-words overflow-y-auto max-h-96 scrollbar-stripe">
                        {showFullPreview
                          ? extractionResult.text
                          : extractionResult.text.slice(0, 500) +
                            (extractionResult.text.length > 500 ? '...' : '')}
                      </pre>
                      {/* Faded overlay when truncated — subtle gradient fade */}
                      {!showFullPreview && extractionResult.text.length > 500 && (
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-muted via-muted/60 to-transparent pointer-events-none" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowFullPreview(!showFullPreview)}
                      >
                        {showFullPreview ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3 mr-1" />
                            View Full Text
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-primary text-primary hover:bg-secondary hover:shadow-glow-sm transition-shadow duration-200"
                        onClick={() => setActiveTab('paste')}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit Text
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          Suggestions Display
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {extractionResult &&
          !extractError &&
          qualityReport &&
          qualityReport.suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.25, delay: 0.2 }}
              className="mb-4"
            >
              <Card className="border-border bg-white rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-sm font-medium text-foreground">
                      Improvement Suggestions
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      {qualityReport.suggestions.length} tips
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-stripe pr-1">
                    {qualityReport.suggestions.map((suggestion, i) => {
                      const isCritical =
                        suggestion.toLowerCase().includes('missing') ||
                        suggestion.toLowerCase().includes('required') ||
                        suggestion.toLowerCase().includes('important');
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs ${
                            isCritical
                              ? 'bg-red-50 border border-red-100'
                              : 'bg-amber-50/60 border border-amber-100/80'
                          }`}
                        >
                          <Lightbulb
                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                              isCritical ? 'text-red-500' : 'text-amber-500'
                            }`}
                          />
                          <span className={isCritical ? 'text-red-800' : 'text-amber-800'}>
                            {suggestion}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          Tabs
          ═══════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="paste" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <FileText className="w-4 h-4 mr-1.5" />
            Paste CV Text
          </TabsTrigger>
          <TabsTrigger value="upload" disabled={isExtracting} className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <Upload className="w-4 h-4 mr-1.5" />
            Upload File
          </TabsTrigger>
        </TabsList>

        {/* ── Paste Tab ── */}
        <TabsContent value="paste">
          <Textarea
            placeholder={
              'Paste your CV text here...\n\nExample:\n\nJohn Doe\nSoftware Engineer\njohn@example.com | +1-234-567-8900\nLinkedIn: linkedin.com/in/johndoe\nGitHub: github.com/johndoe\n\nPROFESSIONAL SUMMARY\nExperienced software engineer with 5+ years of expertise...\n\nEXPERIENCE\nSenior Developer at Tech Corp (Jan 2022 - Present)\n- Led development of microservices architecture...\n- Reduced API response times by 40%...'
            }
            value={rawCvText}
            onChange={(e) => {
              setRawCvText(e.target.value);
            }}
            className="min-h-[300px] text-sm font-mono resize-y"
          />
          {rawCvText && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {rawCvText.length.toLocaleString()} characters
            </p>
          )}
        </TabsContent>

        {/* ── Upload Tab ── */}
        <TabsContent value="upload">
          {/* Multi-step progress indicator */}
          {isExtracting && (
            <div className="border-2 border-[#b9b9f9] border-dashed rounded-2xl p-10 text-center bg-secondary/40">
              {/* Phase step indicators */}
              <div className="flex items-center justify-center gap-1 mb-6">
                {phaseConfig.map((phase, index) => {
                  const isActive = extractionPhase === phase.number;
                  const isCompleted = extractionPhase > phase.number;
                  const showConnector = index > 0;

                  return (
                    <Fragment key={phase.number}>
                      {showConnector && (
                        <div className="relative w-8 h-0.5 overflow-hidden">
                          <div
                            className={`absolute inset-0 transition-colors duration-500 ${
                              isCompleted || isActive ? 'bg-primary' : 'bg-border'
                            }`}
                          />
                          {/* Shimmer overlay on active connector */}
                          {(isCompleted || isActive) && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                          )}
                        </div>
                      )}
                      <motion.div
                        initial={false}
                        animate={{
                          scale: isActive ? 1.1 : 1,
                        }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            isActive
                              ? 'border-primary bg-primary text-white shadow-stripe-sm'
                              : isCompleted
                                ? 'border-[#15be53] bg-[#15be53] text-white'
                                : 'border-border bg-white text-muted-foreground/40'
                          }`}
                        >
                          {isActive ? (
                            <span className="animate-pulse">{phase.icon}</span>
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-medium">{phase.number}</span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-medium transition-colors ${
                            isActive
                              ? 'text-primary'
                              : isCompleted
                                ? 'text-[#15be53]'
                                : 'text-muted-foreground/40'
                          }`}
                        >
                          {phase.label}
                        </span>
                      </motion.div>
                    </Fragment>
                  );
                })}
              </div>

              {/* Phase description — visually distinct container */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={extractionPhase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center justify-center rounded-lg bg-secondary/60 px-5 py-2 mb-2"
                >
                  <p className="text-sm font-medium text-primary">
                    {extractionPhase === 1 && 'Reading file...'}
                    {extractionPhase === 2 && 'Extracting text...'}
                    {extractionPhase === 3 && 'AI is reading your document...'}
                  </p>
                </motion.div>
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">
                {processingFileName
                  ? `Processing ${processingFileName}`
                  : 'This may take a few seconds for images or large files'}
              </p>
            </div>
          )}

          {/* Drop zone (hidden during extraction) */}
          {!isExtracting && (
            <div
              role="button"
              tabIndex={0}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onKeyDown={handleDropZoneKeyDown}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 outline-none
                focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${
                  isDragging
                    ? 'border-primary bg-secondary scale-[1.02] shadow-glow-sm'
                    : extractError
                      ? 'border-red-300 bg-red-50/50 hover:border-red-400'
                      : 'border-border hover:border-[#b9b9f9] hover:bg-secondary/30'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(',')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                    // Reset file input so same file can be re-uploaded
                    e.target.value = '';
                  }
                }}
              />
              <Upload
                className={`w-10 h-10 mx-auto mb-4 transition-colors ${
                  isDragging ? 'text-primary' : extractError ? 'text-red-400' : 'text-muted-foreground'
                }`}
              />
              <p className="text-sm font-medium text-foreground mb-1">
                {isDragging ? 'Drop your file here' : 'Drag & drop your CV file'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">or click to browse your computer</p>
              {/* File type icons in visually appealing pill badges */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { icon: <File className="w-3.5 h-3.5" />, label: 'TXT', color: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: 'DOCX', color: 'text-violet-600', bg: 'bg-violet-50' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-1.5 text-[10px] font-medium ${item.color} ${item.bg} rounded-full px-2.5 py-1 border border-transparent`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════
          Action Buttons
          ═══════════════════════════════════════════════════ */}
      <div className="flex justify-end mt-4 gap-3">
        {!parsedCv && (
          <Button
            onClick={handleParse}
            disabled={!rawCvText.trim() || isAnyLoading}
            className="bg-primary hover:bg-[#4631d8] shadow-stripe-sm hover:shadow-glow-sm transition-shadow duration-200"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="animate-pulse">Parsing CV...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Parse CV
              </>
            )}
          </Button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          Parse Error State
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {parseError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Failed to parse CV</p>
                    <p className="text-xs text-red-600 mt-1">{parseError}</p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-100"
                        onClick={handleParse}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Retry Parse
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-muted-foreground hover:bg-muted"
                        onClick={() => {
                          setParseError(null);
                          setParsedCv(null);
                        }}
                      >
                        Edit Text
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          Success State — Parsed Data (enhanced with quality)
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {parsedCv && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6"
          >
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <CardTitle className="text-base text-emerald-800">CV Parsed Successfully</CardTitle>
                  </div>
                  {/* Quality & confidence badges from extraction */}
                  {extractionResult && qualityReport && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getQualityColor(qualityReport.qualityScore).border} ${getQualityColor(qualityReport.qualityScore).text}`}
                      >
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        Quality: {qualityReport.qualityScore}/100
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getConfidenceColor(extractionResult.confidence)}`}
                      >
                        Confidence: {extractionResult.confidence}%
                      </Badge>
                      {methodBadge && (
                        <Badge variant="outline" className={`text-[10px] ${methodBadge.className}`}>
                          {methodBadge.icon}
                          {methodBadge.label}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Low confidence warning */}
                {extractionResult && extractionResult.confidence < 70 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Low extraction confidence ({extractionResult.confidence}%). Consider pasting text directly for better results.
                    </p>
                  </motion.div>
                )}

                {/* Personal Info */}
                <div className="bg-white rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Personal Info
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {parsedCv.personalInfo.fullName && (
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <span className="ml-1 font-medium text-foreground">
                          {parsedCv.personalInfo.fullName}
                        </span>
                      </div>
                    )}
                    {parsedCv.personalInfo.email && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="ml-1 font-medium text-foreground">
                          {parsedCv.personalInfo.email}
                        </span>
                      </div>
                    )}
                    {parsedCv.personalInfo.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="ml-1 font-medium text-foreground">
                          {parsedCv.personalInfo.phone}
                        </span>
                      </div>
                    )}
                    {parsedCv.personalInfo.location && (
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <span className="ml-1 font-medium text-foreground">
                          {parsedCv.personalInfo.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Experience / Education / Skills stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-semibold text-muted-foreground">Experience</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {parsedCv.workExperience.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">positions found</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-muted-foreground">Education</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {parsedCv.education.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">entries found</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Code2 className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground">Skills</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {parsedCv.skills.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">categories found</p>
                  </div>
                </div>

                {/* Skills preview */}
                {parsedCv.skills.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Skills Preview
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {parsedCv.skills.slice(0, 8).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">
                          {skill.category}
                        </Badge>
                      ))}
                      {parsedCv.skills.length > 8 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{parsedCv.skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Navigation */}
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={handleReset}
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Start Over
                  </Button>
                  <Button onClick={() => setStep('job-desc')} className="bg-primary hover:bg-[#4631d8] shadow-stripe-sm hover:shadow-glow-sm transition-shadow duration-200">
                    Next Step: Job Description
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
