'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCVBuilderStore } from '@/lib/cv-store';
import { restructureCv } from '@/lib/api-calls';
import { AVAILABLE_MODELS } from '@/lib/cv-types';
import type { AIModelConfig } from '@/lib/cv-types';
import { toast } from '@/hooks/use-toast';

/* ---------- Restructure-specific model priority (quality-first) ----------
 *
 * Scoring bands:
 *  100-90  Premium paid models (best writing quality)
 *   89-65  NVIDIA NIM free models (ranked by quality for CV writing)
 *   64-50  GLM always-on fallbacks
 *
 * Intentionally quality-first: restructuring is the one step where latency
 * tradeoff is acceptable — a better CV matters more than 5s saved here.
 */
const RESTRUCTURE_MODEL_PRIORITY: { id: string; score: number }[] = [
  // ── Premium paid (best writing quality) ──────────────────────────────────
  { id: 'claude-sonnet-4-20250514',                   score: 100 },
  { id: 'gpt-4o',                                     score: 95  },
  { id: 'gemini-2.5-pro',                             score: 90  },
  // ── NVIDIA NIM free tier (ranked by quality for writing) ──────────────────
  { id: 'mistralai/mistral-medium-3.5-128b',          score: 89  },
  { id: 'moonshotai/kimi-k2-instruct',                score: 85  },
  { id: 'deepseek-ai/deepseek-r1-0528',               score: 83  },
  { id: 'gemini-2.5-flash',                           score: 80  },
  { id: 'gpt-4o-mini',                                score: 78  },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1',     score: 75  },
  { id: 'claude-haiku-4-20250414',                    score: 73  },
  { id: 'meta/llama-3.3-70b-instruct',                score: 70  },
  { id: 'qwen/qwen3-235b-a22b',                       score: 67  },
  { id: '01-ai/yi-large',                             score: 63  },
  // ── GLM always-on fallbacks ────────────────────────────────────────────────
  { id: 'glm-4-plus',                                 score: 60  },
  { id: 'glm-4-long',                                 score: 55  },
  { id: 'glm-4-flash',                                score: 50  },
];

/**
 * Picks the best available model for restructuring by walking RESTRUCTURE_MODEL_PRIORITY
 * top-to-bottom and returning the first entry that exists in AVAILABLE_MODELS.
 * The backend ai-provider.ts handles per-key health and rotation — the
 * frontend just nominates the starting model.
 */
function pickBestModel(): AIModelConfig {
  for (const entry of RESTRUCTURE_MODEL_PRIORITY) {
    const model = AVAILABLE_MODELS.find((m) => m.id === entry.id);
    if (model) return model;
  }
  return AVAILABLE_MODELS[0];
}

/* ---------- Progress phases — aligned with real backend work ----------
 *
 * These messages map to what the backend actually does during restructuring:
 * 1. Connect to model (immediate)
 * 2. Read CV + job analysis
 * 3. Integrate keywords into experience bullets
 * 4. Rewrite personal statement
 * 5. Reorder and optimise skills
 * 6. Finalise document structure
 * 7. Return result
 */
const RESTRUCTURE_PROGRESS_PHASES = [
  'Reading your CV and job requirements...',
  'Integrating job keywords into experience...',
  'Rewriting bullet points with impact metrics...',
  'Crafting your executive personal statement...',
  'Reordering skills by job relevance...',
  'Optimising ATS keyword coverage...',
  'Finalising document structure...',
];

/* Confetti particle config for success state */
const confettiParticles = [
  { color: '#15be53', x: -50, y: -30 },
  { color: '#533afd', x: 45,  y: -35 },
  { color: '#f59e0b', x: -55, y: 25  },
  { color: '#ec4899', x: 50,  y: 20  },
  { color: '#06b6d4', x: -30, y: -50 },
  { color: '#8b5cf6', x: 35,  y: -50 },
  { color: '#f97316', x: -60, y: 0   },
  { color: '#10b981', x: 60,  y: 5   },
  { color: '#6366f1', x: 0,   y: -55 },
  { color: '#f43f5e', x: -20, y: 45  },
  { color: '#14b8a6', x: 25,  y: 45  },
  { color: '#a855f7', x: 0,   y: 50  },
];

/* ---------- component ---------- */

export function ProcessingStep() {
  const {
    parsedCv,
    analyzedJob,
    jobDescText,
    isRestructuring,
    restructureError,
    restructureProgress,
    modelUsed,
    setIsRestructuring,
    setRestructureError,
    setRestructureProgress,
    setModelUsed,
    setTailoredCv,
    setStep,
    setSelectedModel,
  } = useCVBuilderStore();

  const progressIndexRef    = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef        = useRef<number>(0);
  const [hasStarted, setHasStarted]       = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeModel, setActiveModel]     = useState<AIModelConfig>(pickBestModel);
  // Which model actually responded (may differ from initial if backend fell back)
  const [actualModel, setActualModel]     = useState<string | null>(null);
  const [didFallback, setDidFallback]     = useState(false);
  // Track which model IDs have already been tried so retry avoids repeats
  const triedModelsRef = useRef<Set<string>>(new Set());

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Auto-start as soon as the component mounts (job analysis is ready by Step 3)
  useEffect(() => {
    if (!hasStarted && parsedCv && analyzedJob) {
      const best = pickBestModel();
      setActiveModel(best);
      setSelectedModel(best);
      startRestructuring(best.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRestructuring = useCallback(
    async (modelId: string) => {
      if (!parsedCv || !analyzedJob) return;

      const modelConfig = AVAILABLE_MODELS.find((m) => m.id === modelId) ?? AVAILABLE_MODELS[0];
      setActiveModel(modelConfig);
      setSelectedModel(modelConfig);
      setIsRestructuring(true);
      setRestructureError(null);
      setModelUsed(modelId);
      setActualModel(null);
      setDidFallback(false);
      progressIndexRef.current = 0;
      startTimeRef.current = Date.now();
      setHasStarted(true);
      triedModelsRef.current.add(modelId);

      const steps = [`Connecting to ${modelConfig.name}...`, ...RESTRUCTURE_PROGRESS_PHASES];
      setRestructureProgress(steps[0]);

      // Adaptive interval: phase through steps over ~20s regardless of model speed.
      // For fast models the interval fires but the result arrives before it matters.
      // For slow models users see meaningful phase updates every 3s.
      progressIntervalRef.current = setInterval(() => {
        progressIndexRef.current = Math.min(progressIndexRef.current + 1, steps.length - 1);
        setProgressIndex(progressIndexRef.current);
        setRestructureProgress(steps[progressIndexRef.current]);
      }, 3000);

      try {
        const result = await restructureCv(parsedCv, analyzedJob, jobDescText, modelId);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgressIndex(steps.length - 1);

        // Detect backend fallback: model returned != model requested
        const returnedModel = result.model;
        setActualModel(returnedModel);
        if (returnedModel && returnedModel !== modelId) {
          setDidFallback(true);
          console.warn(`[processing-step] Backend fell back: ${modelId} → ${returnedModel}`);
        }

        setTailoredCv(result.cv);
        setModelUsed(returnedModel);
        setRestructureProgress('CV tailored successfully!');
        toast({ title: 'CV Restructured!', description: 'Your CV has been tailored for the target role.' });
        setTimeout(() => setStep('output'), 1200);
      } catch (err) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        const message = err instanceof Error ? err.message : 'Failed to restructure CV';
        setRestructureError(message);
        setIsRestructuring(false);
        toast({ title: 'Restructuring Error', description: message, variant: 'destructive' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedCv, analyzedJob, jobDescText, setIsRestructuring, setRestructureError, setRestructureProgress, setModelUsed, setTailoredCv, setStep, setSelectedModel]
  );

  /** Retry with the next untried model in the priority list */
  const handleAutoRetry = useCallback(() => {
    const next = RESTRUCTURE_MODEL_PRIORITY.find(
      (entry) => !triedModelsRef.current.has(entry.id) && AVAILABLE_MODELS.some((m) => m.id === entry.id)
    );
    const nextModel = next
      ? AVAILABLE_MODELS.find((m) => m.id === next.id)!
      : AVAILABLE_MODELS.find((m) => m.id === 'glm-4-plus')!;

    setRestructureError(null);
    setHasStarted(false);
    startRestructuring(nextModel.id);
  }, [startRestructuring, setRestructureError]);

  /** Manual retry with the same model */
  const handleRetrySame = useCallback(() => {
    const currentId = modelUsed ?? activeModel.id;
    triedModelsRef.current.delete(currentId);
    setRestructureError(null);
    setHasStarted(false);
    startRestructuring(currentId);
  }, [modelUsed, activeModel.id, startRestructuring, setRestructureError]);

  const phase: 'processing' | 'success' | 'error' = isRestructuring
    ? 'processing'
    : restructureError
      ? 'error'
      : 'success';

  const progressPercent = (() => {
    if (phase === 'success') return 100;
    if (phase === 'processing') {
      return Math.min(Math.round(((progressIndex + 1) / (RESTRUCTURE_PROGRESS_PHASES.length + 1)) * 100), 95);
    }
    return 0;
  })();

  /* ---------- render ---------- */

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('job-desc')}
          className="text-muted-foreground hover:text-foreground"
          disabled={phase === 'processing'}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h2 className="text-lg font-light text-foreground tracking-tight">Step 3 of 4: AI Processing</h2>
        <div className="w-20" />
      </div>

      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ==================== PROCESSING ==================== */}
          {phase === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {/* Auto-select banner */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 mb-5"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-light">
                  Auto-selected best quality model for CV writing
                </span>
                <Badge variant="outline" className="border-[#b9b9f9] text-primary rounded-[4px] text-[10px] h-5">
                  {activeModel.name}
                </Badge>
              </motion.div>

              <Card className="border-border rounded-[8px] shadow-stripe">
                <CardContent className="py-10">
                  <div className="flex flex-col items-center text-center">
                    {/* Animated AI icon */}
                    <div className="relative mb-6">
                      <motion.div
                        className="p-[3px] rounded-[8px]"
                        style={{ background: 'conic-gradient(from 0deg, #533afd, #a78bfa, #c4b5fd, #533afd)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <div className="w-20 h-20 rounded-[6px] bg-primary flex items-center justify-center">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                      </motion.div>
                    </div>

                    <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">AI is Restructuring</h3>
                    <p className="text-sm text-muted-foreground mb-4 font-light">
                      Tailoring your CV for the target role with ATS optimisation
                    </p>

                    <Badge variant="outline" className="mb-6 border-[#b9b9f9] text-primary rounded-[4px]">
                      <Zap className="w-3 h-3 mr-1" />
                      {activeModel.name}
                    </Badge>

                    <motion.p
                      key={restructureProgress}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-foreground mb-4 h-5 font-light"
                    >
                      {restructureProgress}
                    </motion.p>

                    {/* Progress bar */}
                    <div className="w-full max-w-xs">
                      <div className="h-2 rounded-[4px] bg-border overflow-hidden relative">
                        <motion.div
                          className="h-full bg-primary rounded-[4px]"
                          initial={false}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                          animate={{ x: ['-200%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-4 font-light">
                      If this model is slow or unavailable, the backend will automatically try the next best option.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== SUCCESS ==================== */}
          {phase === 'success' && hasStarted && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-[rgba(21,190,83,0.4)] bg-[rgba(21,190,83,0.05)] rounded-[8px]">
                <CardContent className="py-10">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex items-center justify-center mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        <CheckCircle2 className="w-16 h-16 text-[#15be53]" />
                      </motion.div>
                      {confettiParticles.map((particle, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 rounded-full"
                          style={{ background: particle.color }}
                          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.2, 1, 0.5], x: particle.x, y: particle.y }}
                          transition={{ duration: 2, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                        />
                      ))}
                    </div>
                    <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">CV Tailored Successfully!</h3>
                    <p className="text-sm text-muted-foreground mb-4 font-light">Your CV has been optimised for the target role</p>

                    {/* Model used — highlight if backend fell back to a different model */}
                    <div className="flex flex-col items-center gap-1.5">
                      <Badge className="bg-secondary text-primary border border-[#b9b9f9] rounded-[4px]">
                        <Zap className="w-3 h-3 mr-1" />
                        {actualModel || modelUsed || activeModel.name}
                      </Badge>
                      {didFallback && (
                        <p className="text-[10px] text-muted-foreground font-light">
                          Auto-switched from {activeModel.name} for best available quality
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-4 font-light">Redirecting to output...</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== ERROR ==================== */}
          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-[#ea2261]/30 bg-[#ea2261]/5 rounded-[8px]">
                <CardContent className="py-8">
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#ea2261]/10 flex items-center justify-center mb-4">
                      <AlertCircle className="w-10 h-10 text-[#ea2261]" />
                    </div>
                    <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">Processing Failed</h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-1 font-light">{restructureError}</p>
                    <p className="text-xs text-muted-foreground font-light">
                      Failed model: <span className="font-medium text-foreground">{activeModel.name}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {/* Try next best model */}
                    <Button
                      className="bg-primary hover:bg-[#4434d4] text-white rounded-[4px] font-normal shadow-stripe-sm"
                      onClick={handleAutoRetry}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Try Next Best Model
                    </Button>

                    {/* Retry same */}
                    <Button
                      variant="ghost"
                      className="border border-[#ea2261]/30 text-[#ea2261] hover:bg-[#ea2261]/10 rounded-[4px] font-normal"
                      onClick={handleRetrySame}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry {activeModel.name}
                    </Button>

                    {/* Go back and re-analyse */}
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground rounded-[4px] font-normal"
                      onClick={() => setStep('job-desc')}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Job Description
                    </Button>
                  </div>

                  {/* Remaining untried models */}
                  <div className="mt-5 text-center">
                    <p className="text-[10px] text-muted-foreground font-light mb-2">Models remaining in queue:</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {RESTRUCTURE_MODEL_PRIORITY.filter(
                        (e) => !triedModelsRef.current.has(e.id) && AVAILABLE_MODELS.some((m) => m.id === e.id)
                      ).slice(0, 6).map((e) => {
                        const m = AVAILABLE_MODELS.find((x) => x.id === e.id)!;
                        return (
                          <Badge
                            key={e.id}
                            variant="outline"
                            className="text-[10px] rounded-[4px] border-border text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
                            onClick={() => {
                              triedModelsRef.current.add(e.id);
                              setRestructureError(null);
                              setHasStarted(false);
                              startRestructuring(e.id);
                            }}
                          >
                            <ArrowRight className="w-2.5 h-2.5 mr-1" />
                            {m.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
