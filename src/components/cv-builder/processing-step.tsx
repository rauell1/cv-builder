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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCVBuilderStore } from '@/lib/cv-store';
import { restructureCv } from '@/lib/api-calls';
import { AVAILABLE_MODELS } from '@/lib/cv-types';
import type { AIModelConfig } from '@/lib/cv-types';
import { toast } from '@/hooks/use-toast';

/* ---------- Model priority list (highest = best) ---------- */
// Each entry is [modelId, scoreWhenKeyIsAvailable]
// Models without requiresApiKey are always available.
const MODEL_PRIORITY: { id: string; score: number }[] = [
  { id: 'claude-sonnet-4-20250514', score: 100 },  // Best quality
  { id: 'gpt-4o',                  score: 95  },
  { id: 'gemini-2.5-pro',          score: 90  },
  { id: 'gemini-2.5-flash',        score: 85  },
  { id: 'gpt-4o-mini',             score: 80  },
  { id: 'claude-haiku-4-20250414', score: 75  },
  { id: 'glm-4-plus',              score: 60  },   // built-in, always works
  { id: 'glm-4-long',              score: 55  },
  { id: 'glm-4-flash',             score: 50  },
];

/**
 * Picks the best model that is likely to have a working key.
 * On the server Vercel exposes env vars; on the client we can only
 * check whether NEXT_PUBLIC_ vars exist. We therefore make a lightweight
 * /api/available-models probe or, more simply, try models in priority order
 * and let the backend failover handle the rest.  The frontend just chooses
 * the top-priority model from the list — the backend ai-provider.ts will
 * automatically rotate to the next healthy key if it fails.
 */
function pickBestModel(): AIModelConfig {
  for (const entry of MODEL_PRIORITY) {
    const model = AVAILABLE_MODELS.find((m) => m.id === entry.id);
    if (model) return model;
  }
  // Absolute fallback
  return AVAILABLE_MODELS[0];
}

/* ---------- helpers ---------- */

const baseProgressSteps = [
  'Analyzing job requirements...',
  'Comparing CV skills with job needs...',
  'Restructuring work experience...',
  'Optimizing personal statement...',
  'Tailoring skills section...',
  'Enhancing bullet points...',
  'Finalizing tailored CV...',
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

  const progressIndexRef   = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasStarted, setHasStarted]     = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeModel, setActiveModel]   = useState<AIModelConfig>(pickBestModel);
  // Track which model IDs have already been tried so retry avoids repeats
  const triedModelsRef = useRef<Set<string>>(new Set());

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Auto-start as soon as the component mounts (job analysis is ready)
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
      progressIndexRef.current = 0;
      setHasStarted(true);
      triedModelsRef.current.add(modelId);

      const steps = [`Connecting to ${modelConfig.name}...`, ...baseProgressSteps];
      setRestructureProgress(steps[0]);

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
        setTailoredCv(result.cv);
        setModelUsed(result.model);
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
    [parsedCv, analyzedJob, jobDescText, setIsRestructuring, setRestructureError, setRestructureProgress, setModelUsed, setTailoredCv, setStep, setSelectedModel]
  );

  /** Retry with the next untried model in the priority list */
  const handleAutoRetry = useCallback(() => {
    const next = MODEL_PRIORITY.find(
      (entry) => !triedModelsRef.current.has(entry.id) && AVAILABLE_MODELS.some((m) => m.id === entry.id)
    );
    const nextModel = next
      ? AVAILABLE_MODELS.find((m) => m.id === next.id)!
      : AVAILABLE_MODELS.find((m) => m.id === 'glm-4-plus')!; // ultimate fallback

    setRestructureError(null);
    setHasStarted(false);
    startRestructuring(nextModel.id);
  }, [startRestructuring, setRestructureError]);

  /** Manual retry with the same model */
  const handleRetrySame = useCallback(() => {
    const currentId = modelUsed ?? activeModel.id;
    triedModelsRef.current.delete(currentId); // allow retry of same
    setRestructureError(null);
    setHasStarted(false);
    startRestructuring(currentId);
  }, [modelUsed, activeModel.id, startRestructuring, setRestructureError]);

  // Determine current phase
  const phase: 'processing' | 'success' | 'error' = isRestructuring
    ? 'processing'
    : restructureError
      ? 'error'
      : 'success';

  const progressPercent = (() => {
    if (phase === 'success') return 100;
    if (phase === 'processing') {
      return Math.min(Math.round(((progressIndex + 1) / (baseProgressSteps.length + 1)) * 100), 95);
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
                  Auto-selected best available model
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

                    <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">AI is Working</h3>
                    <p className="text-sm text-muted-foreground mb-4 font-light">
                      Restructuring your CV to match the target role
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
                      If this model is unavailable, the system will automatically try the next best option.
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
                    <p className="text-sm text-muted-foreground mb-4 font-light">Your CV has been optimized for the target role</p>
                    <Badge className="bg-secondary text-primary border border-[#b9b9f9] rounded-[4px]">
                      <Zap className="w-3 h-3 mr-1" />
                      Model: {modelUsed || activeModel.name}
                    </Badge>
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
                    {/* Try next best model automatically */}
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
                  </div>

                  {/* Show remaining untried models */}
                  <div className="mt-5 text-center">
                    <p className="text-[10px] text-muted-foreground font-light mb-2">Remaining models in queue:</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {MODEL_PRIORITY.filter(
                        (e) => !triedModelsRef.current.has(e.id) && AVAILABLE_MODELS.some((m) => m.id === e.id)
                      ).map((e) => {
                        const m = AVAILABLE_MODELS.find((x) => x.id === e.id)!;
                        return (
                          <Badge key={e.id} variant="outline" className="text-[10px] rounded-[4px] border-border text-muted-foreground">
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
