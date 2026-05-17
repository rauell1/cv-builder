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

// Allow TXT, DOCX and PDF uploads. PDF will be routed through the /api/extract-file pipeline
// which uses native text extraction first and falls back to AI OCR when needed.
const ACCEPTED_EXTENSIONS = ['.txt', '.docx', '.pdf'];
const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
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
          description: 'Please upload a .txt, .docx or .pdf file, or paste your CV text directly.',
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
      {/* ...rest of file remains unchanged... */}
