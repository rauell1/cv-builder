'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Briefcase,
  GraduationCap,
  Sparkles,
  Layers,
  ImageIcon,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCVBuilderStore } from '@/lib/cv-store';
import { analyzeJob, extractFile } from '@/lib/api-calls';
import { toast } from '@/hooks/use-toast';

/* ---------- animation variants ---------- */

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/* ---------- component ---------- */

export function JobDescStep() {
  const {
    jobDescText,
    analyzedJob,
    isAnalyzing,
    analyzeError,
    setJobDescText,
    setAnalyzedJob,
    setIsAnalyzing,
    setAnalyzeError,
    setStep,
  } = useCVBuilderStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('paste');

  const handleAnalyze = useCallback(async () => {
    if (!jobDescText.trim()) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const result = await analyzeJob(jobDescText);
      setAnalyzedJob(result);
      toast({
        title: 'Job Analyzed Successfully',
        description: `Found ${result.keyRequirements.length} key requirements for "${result.jobTitle}".`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze job';
      setAnalyzeError(message);
      toast({
        title: 'Analysis Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [jobDescText, setIsAnalyzing, setAnalyzeError, setAnalyzedJob]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const isText = file.type === 'text/plain' || file.name.endsWith('.txt');

      if (isText) {
        const text = await file.text();
        setJobDescText(text);
        setUploadedFileName(file.name);
        setExtractionWarning(null);
        setActiveTab('paste');
      } else {
        setIsExtracting(true);
        setUploadedFileName(file.name);
        setExtractionWarning(null);

        try {
          const result = await extractFile(file, { fast: false, parse: false, timeoutMs: 45_000 });
          setJobDescText(result.text);

          if (result.warning) {
            setExtractionWarning(result.warning);
          }

          setActiveTab('paste');
          toast({
            title: 'File Extracted',
            description: `Extracted ${result.text.length} characters from ${result.fileType} file.`,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to extract file';
          toast({
            title: 'Extraction Error',
            description: message,
            variant: 'destructive',
          });
          setExtractionWarning(null);
        } finally {
          setIsExtracting(false);
        }
      }
    },
    [setJobDescText]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      const validTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const validExts = ['.pdf', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.docx'];
      if (file && (validTypes.includes(file.type) || validExts.some(ext => file.name.toLowerCase().endsWith(ext)))) {
        handleFileUpload(file);
      } else {
        toast({
          title: 'Invalid File',
          description: 'Please upload a PDF, DOCX, TXT, PNG, JPG, or WEBP file.',
          variant: 'destructive',
        });
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDropKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header — font-medium to match Step 1 */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => setStep('cv-input')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h2 className="text-lg font-medium text-foreground tracking-tight">Step 2 of 4: Job Description</h2>
        <div className="w-20" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="paste">
            <FileText className="w-4 h-4 mr-1.5" />
            Paste Job Description
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-1.5" />
            Upload File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste">
          <Textarea
            placeholder="Paste the full job description here...&#10;&#10;Example:&#10;&#10;Senior Software Engineer - Tech Company Inc.&#10;&#10;We are looking for a Senior Software Engineer to join our team...&#10;&#10;Requirements:&#10;- 5+ years of experience in React and TypeScript&#10;- Experience with cloud services (AWS/GCP)&#10;- Strong understanding of system design..."
            value={jobDescText}
            onChange={(e) => setJobDescText(e.target.value)}
            className="min-h-[250px] text-sm resize-y"
          />
          {jobDescText && (
            <p className="text-xs text-zinc-400 mt-1 text-right">{jobDescText.length} characters</p>
          )}
        </TabsContent>

        <TabsContent value="upload">
          {isExtracting ? (
            <div className="border-2 border-dashed border-[#b9b9f9] rounded-2xl p-12 text-center bg-secondary/30">
              <Loader2 className="w-10 h-10 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground mb-1">Extracting text from file...</p>
              <p className="text-xs text-muted-foreground">
                {uploadedFileName?.endsWith('.pdf')
                  ? 'Reading PDF content'
                  : 'Analyzing image with AI OCR'}
              </p>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleDropKeyDown}
              role="button"
              tabIndex={0}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${isDragging
                  ? 'border-primary bg-secondary'
                  : 'border-border hover:border-[#b9b9f9] hover:bg-secondary/30'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
              />
              <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium text-foreground mb-1">
                {isDragging ? 'Drop your file here' : 'Drag & drop your file'}
              </p>
              <p className="text-xs text-muted-foreground mb-3">Supports PDF, DOCX, TXT, PNG, JPG, WEBP</p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</span>
                <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> DOCX</span>
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image (OCR)</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> TXT</span>
              </div>
              {uploadedFileName && !isExtracting && (
                <Badge variant="secondary" className="mt-3">
                  {uploadedFileName}
                </Badge>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Extraction warning */}
      <AnimatePresence>
        {extractionWarning && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3"
          >
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">{extractionWarning}</p>
                <p className="text-xs text-amber-600 mt-0.5">You can edit the extracted text above if needed.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex justify-end mt-4 gap-3">
        {!analyzedJob && (
          <Button
            onClick={handleAnalyze}
            disabled={!jobDescText.trim() || isAnalyzing}
            className="bg-primary hover:bg-[#4434d4] shadow-stripe-sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Analyze Job
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error state */}
      <AnimatePresence>
        {analyzeError && (
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
                  <div>
                    <p className="text-sm font-medium text-red-800">Analysis Failed</p>
                    <p className="text-xs text-red-600 mt-1">{analyzeError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                      onClick={handleAnalyze}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results panel */}
      <AnimatePresence>
        {analyzedJob && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6"
          >
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <CardTitle className="text-base text-emerald-800">Job Analysis Complete</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Job title & company */}
                  <motion.div variants={staggerItem}>
                    <div className="bg-white rounded-xl p-4 border border-border">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{analyzedJob.jobTitle || 'Unknown Title'}</h3>
                          <p className="text-sm text-muted-foreground">{analyzedJob.company || 'Unknown Company'}</p>
                          {analyzedJob.summary && (
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{analyzedJob.summary}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Info grid with stagger */}
                  <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-muted-foreground">Experience Level</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{analyzedJob.experienceLevel || 'Not specified'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="w-3.5 h-3.5 text-[#15be53]" />
                        <span className="text-xs font-semibold text-muted-foreground">Industry</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{analyzedJob.industry || 'Not specified'}</p>
                    </div>
                  </motion.div>

                  {/* Key Requirements */}
                  {analyzedJob.keyRequirements.length > 0 && (
                    <motion.div variants={staggerItem}>
                      <div className="bg-white rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Requirements</span>
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {analyzedJob.keyRequirements.length}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analyzedJob.keyRequirements.map((req, i) => (
                            <Badge key={i} className="text-[11px] bg-secondary text-primary border border-[#b9b9f9] hover:bg-secondary hover:scale-105 transition-transform cursor-default">
                              {req}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Preferred Skills */}
                  {analyzedJob.preferredSkills.length > 0 && (
                    <motion.div variants={staggerItem}>
                      <div className="bg-white rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-[#15be53]" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preferred Skills</span>
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {analyzedJob.preferredSkills.length}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analyzedJob.preferredSkills.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="text-[11px]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Keywords */}
                  {analyzedJob.keywords.length > 0 && (
                    <motion.div variants={staggerItem}>
                      <div className="bg-white rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Search className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Keywords</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analyzedJob.keywords.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-[11px]">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <motion.div variants={staggerItem}>
                    <Separator />
                  </motion.div>

                  {/* Next step — with hover glow */}
                  <motion.div variants={staggerItem}>
                    <div className="flex justify-end">
                      <Button onClick={() => setStep('processing')} className="bg-primary hover:bg-[#4434d4] rounded-xl shadow-stripe-sm hover:shadow-[0_0_20px_rgba(83,58,253,0.3)] transition-shadow">
                        Generate Tailored CV
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
