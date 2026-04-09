'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  Play,
  Settings,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCVBuilderStore } from '@/lib/cv-store';
import { restructureCv } from '@/lib/api-calls';
import { AVAILABLE_MODELS, AI_PROVIDERS } from '@/lib/cv-types';
import type { AIModelConfig } from '@/lib/cv-types';
import { toast } from '@/hooks/use-toast';

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

function getSpeedLabel(speed: AIModelConfig['speed']) {
  switch (speed) {
    case 'fast': return { label: 'Fast', color: 'text-[#15be53]', dotColor: 'bg-[#15be53]' };
    case 'medium': return { label: 'Medium', color: 'text-[#9b6829]', dotColor: 'bg-[#9b6829]' };
    case 'slow': return { label: 'Slow', color: 'text-muted-foreground', dotColor: 'bg-muted-foreground' };
  }
}

function groupModelsByProvider() {
  const groups: { provider: (typeof AI_PROVIDERS)[number]; models: AIModelConfig[] }[] = [];
  for (const provider of AI_PROVIDERS) {
    const models = AVAILABLE_MODELS.filter((m) => m.provider === provider.id);
    if (models.length > 0) {
      groups.push({ provider, models });
    }
  }
  return groups;
}

const modelGroups = groupModelsByProvider();

/* Confetti particle config for success state */
const confettiParticles = [
  { color: '#15be53', x: -50, y: -30 },
  { color: '#533afd', x: 45, y: -35 },
  { color: '#f59e0b', x: -55, y: 25 },
  { color: '#ec4899', x: 50, y: 20 },
  { color: '#06b6d4', x: -30, y: -50 },
  { color: '#8b5cf6', x: 35, y: -50 },
  { color: '#f97316', x: -60, y: 0 },
  { color: '#10b981', x: 60, y: 5 },
  { color: '#6366f1', x: 0, y: -55 },
  { color: '#f43f5e', x: -20, y: 45 },
  { color: '#14b8a6', x: 25, y: 45 },
  { color: '#a855f7', x: 0, y: 50 },
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
    selectedModel,
    setIsRestructuring,
    setRestructureError,
    setRestructureProgress,
    setModelUsed,
    setTailoredCv,
    setStep,
    setSelectedModel,
  } = useCVBuilderStore();

  const progressIndexRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedModel.id);

  // Cleanup interval on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Full progress steps with connecting step
  const progressSteps = useMemo(() => {
    const modelName = AVAILABLE_MODELS.find((m) => m.id === localSelectedId)?.name || localSelectedId;
    return [`Connecting to ${modelName}...`, ...baseProgressSteps];
  }, [localSelectedId]);

  const startRestructuring = useCallback(
    async (modelId: string) => {
      if (!parsedCv || !analyzedJob) return;

      setIsRestructuring(true);
      setRestructureError(null);
      setModelUsed(modelId);
      progressIndexRef.current = 0;
      setHasStarted(true);

      const modelName = AVAILABLE_MODELS.find((m) => m.id === modelId)?.name || modelId;
      const steps = [`Connecting to ${modelName}...`, ...baseProgressSteps];
      setRestructureProgress(steps[0]);

      // Simulate progress updates
      progressIntervalRef.current = setInterval(() => {
        progressIndexRef.current = Math.min(
          progressIndexRef.current + 1,
          steps.length - 1
        );
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
        toast({
          title: 'CV Restructured!',
          description: 'Your CV has been tailored for the target role.',
        });

        // Auto-advance to output step after a brief delay
        setTimeout(() => {
          setStep('output');
        }, 1200);
      } catch (err) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        const message = err instanceof Error ? err.message : 'Failed to restructure CV';
        setRestructureError(message);
        setIsRestructuring(false);
        toast({
          title: 'Restructuring Error',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [parsedCv, analyzedJob, jobDescText, setIsRestructuring, setRestructureError, setRestructureProgress, setModelUsed, setTailoredCv, setStep]
  );

  // Determine current phase
  const phase: 'idle' | 'processing' | 'success' | 'error' = isRestructuring
    ? 'processing'
    : restructureError
      ? 'error'
      : hasStarted && modelUsed
        ? 'success'
        : 'idle';

  const progressPercent = (() => {
    if (phase === 'success') return 100;
    if (phase === 'processing') {
      return Math.min(Math.round(((progressIndex + 1) / progressSteps.length) * 100), 95);
    }
    return 0;
  })();

  // Selected model config
  const activeModelConfig = AVAILABLE_MODELS.find((m) => m.id === localSelectedId) || selectedModel;

  // Models in the same provider group as the selected model
  const sameProviderModels = useMemo(() => {
    return AVAILABLE_MODELS.filter((m) => m.provider === activeModelConfig.provider);
  }, [activeModelConfig.provider]);

  // GLM fallback models (always available)
  const glmFallbackModels = useMemo(() => {
    return AVAILABLE_MODELS.filter((m) => m.provider === 'glm');
  }, []);

  const handleSelectAndStart = () => {
    const model = AVAILABLE_MODELS.find((m) => m.id === localSelectedId);
    if (model) {
      setSelectedModel(model);
      startRestructuring(model.id);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setLocalSelectedId(modelId);
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
    }
  };

  const handleRetryWithDifferent = () => {
    setRestructureError(null);
    setHasStarted(false);
  };

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
          {/* ==================== IDLE: Model Selection Panel ==================== */}
          {phase === 'idle' && (
            <motion.div
              key="model-selection"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-[8px] bg-primary mb-4 shadow-stripe-sm">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-light text-foreground mb-1 tracking-tight">Choose AI Model</h3>
                <p className="text-sm text-muted-foreground font-light">Select an AI model to restructure your CV. GLM models are built-in in Z.ai and may require an API key on external hosting.</p>
              </div>

              {/* Provider-grouped model cards */}
              <div className="space-y-6">
                {modelGroups.map((group) => (
                  <div key={group.provider.id}>
                    {/* Provider header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{group.provider.icon}</span>
                      <h4 className="text-sm font-normal text-foreground">{group.provider.name}</h4>
                      {!group.models.some((m) => m.requiresApiKey) && (
                        <Badge className="text-[10px] px-1.5 py-0 rounded-[4px] bg-[rgba(21,190,83,0.2)] text-[#108c3d] border border-[rgba(21,190,83,0.4)] h-5">
                          Built-in (Z.ai)
                        </Badge>
                      )}
                      {group.models.some((m) => m.requiresApiKey) && (
                        <Badge className="text-[10px] px-1.5 py-0 rounded-[4px] bg-muted text-muted-foreground border border-border h-5">
                          Requires Key
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 ml-7 font-light">{group.provider.description}</p>

                    {/* Model cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.models.map((model) => {
                        const speed = getSpeedLabel(model.speed);
                        const isSelected = localSelectedId === model.id;

                        return (
                          <Card
                            key={model.id}
                            className={`cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'ring-2 ring-primary border-[#b9b9f9] bg-secondary shadow-stripe-sm'
                                : 'border-border hover:border-[#b9b9f9] hover:shadow-stripe-sm bg-white'
                            } rounded-[6px]`}
                            onClick={() => handleSelectModel(model.id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2 mb-2">
                                {/* Radio-dot indicator */}
                                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
                                  isSelected ? 'border-primary' : 'border-border'
                                }`}>
                                  {isSelected && (
                                    <motion.div
                                      className="w-2 h-2 rounded-full bg-primary"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    />
                                  )}
                                </div>
                                <h5 className="text-sm font-normal text-foreground leading-tight flex-1">
                                  {model.name}
                                </h5>
                                <Badge className={`text-[10px] border rounded-[4px] shrink-0 ${model.badgeColor}`}>
                                  {model.badge}
                                </Badge>
                              </div>

                              <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2 font-light pl-6">
                                {model.description}
                              </p>

                              <div className="flex items-center justify-between pl-6">
                                {/* Speed indicator */}
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${speed.dotColor}`} />
                                  <span className={`text-[10px] font-normal ${speed.color}`}>
                                    {speed.label}
                                  </span>
                                </div>

                                {/* Built-in / API key badge */}
                                {model.requiresApiKey ? (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-border rounded-[4px] h-5">
                                    Needs Key
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-[#108c3d] border-[rgba(21,190,83,0.4)] rounded-[4px] h-5">
                                    Built-in (Z.ai)
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* API key warning — visually distinct with left accent border */}
              {activeModelConfig.requiresApiKey && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5"
                >
                  <Card className="border-l-4 border-l-[#9b6829] border-border bg-amber-50/60 rounded-[6px]">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(155,104,41,0.12)] flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-4 h-4 text-[#9b6829]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          API Key Required
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-light leading-relaxed">
                          {activeModelConfig.name} requires the{' '}
                          <code className="bg-border px-1 py-0.5 rounded-[4px] text-[11px] font-mono">
                            {activeModelConfig.apiEnvKey}
                          </code>{' '}
                          environment variable. If not set, the request will fail.
                          Consider using a GLM model instead.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Start Processing button */}
              <div className="mt-6 flex flex-col items-center">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-[#4434d4] text-white rounded-[4px] shadow-stripe-sm px-8 font-normal transition-all duration-200"
                  onClick={handleSelectAndStart}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Processing with {activeModelConfig.name}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 font-light">
                  Your CV and job description will be sent to the selected AI model
                </p>
              </div>
            </motion.div>
          )}

          {/* ==================== PROCESSING: Animated Progress ==================== */}
          {phase === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border rounded-[8px] shadow-stripe">
                <CardContent className="py-10">
                  <div className="flex flex-col items-center text-center">
                    {/* Animated AI icon — rotating gradient border */}
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

                    {/* Model badge showing selected model */}
                    <Badge variant="outline" className="mb-6 border-[#b9b9f9] text-primary rounded-[4px]">
                      <Zap className="w-3 h-3 mr-1" />
                      {activeModelConfig.name}
                    </Badge>

                    {/* Progress text with animation */}
                    <motion.p
                      key={restructureProgress}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-foreground mb-4 h-5 font-light"
                    >
                      {restructureProgress}
                    </motion.p>

                    {/* Progress bar — with shimmer overlay */}
                    <div className="w-full max-w-xs">
                      <div className="h-2 rounded-[4px] bg-border overflow-hidden relative">
                        <motion.div
                          className="h-full bg-primary rounded-[4px]"
                          initial={false}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                        {/* Shimmer animation overlay */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                          animate={{ x: ['-200%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model info cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6"
              >
                <p className="text-xs text-muted-foreground mb-3 text-center font-light">
                  Available {activeModelConfig.provider.charAt(0).toUpperCase() + activeModelConfig.provider.slice(1)} Models
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {sameProviderModels.map((model) => {
                    const isActive = modelUsed === model.id;
                    return (
                      <Card
                        key={model.id}
                        className={`rounded-[6px] transition-all duration-200 ${
                          isActive
                            ? 'border-primary bg-secondary shadow-stripe-sm'
                            : 'border-border opacity-60'
                        }`}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                isActive ? 'bg-primary animate-pulse' : 'bg-border'
                              }`}
                            />
                            <span className="text-xs font-normal text-foreground">{model.name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed font-light">
                            {model.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ==================== SUCCESS: Brief state ==================== */}
          {phase === 'success' && (
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
                    {/* Checkmark with confetti particles */}
                    <div className="relative flex items-center justify-center mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        <CheckCircle2 className="w-16 h-16 text-[#15be53]" />
                      </motion.div>

                      {/* Confetti-like particle dots */}
                      {confettiParticles.map((particle, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 rounded-full"
                          style={{ background: particle.color }}
                          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                          animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0, 1.2, 1, 0.5],
                            x: particle.x,
                            y: particle.y,
                          }}
                          transition={{
                            duration: 2,
                            delay: 0.3 + i * 0.06,
                            ease: 'easeOut',
                          }}
                        />
                      ))}
                    </div>

                    <h3 className="text-xl font-light text-foreground mb-2 tracking-tight">
                      CV Tailored Successfully!
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 font-light">
                      Your CV has been optimized for the target role
                    </p>
                    <Badge className="bg-secondary text-primary border border-[#b9b9f9] rounded-[4px]">
                      <Zap className="w-3 h-3 mr-1" />
                      Model: {modelUsed || activeModelConfig.name}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-4 font-light">Redirecting to output...</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== ERROR: Model Selector with Retry ==================== */}
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
                    <p className="text-sm text-muted-foreground max-w-md mb-2 font-light">{restructureError}</p>
                    <p className="text-xs text-muted-foreground font-light">
                      Try a different model or retry with the same one
                    </p>
                  </div>

                  {/* Retry with same model */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                    <Button
                      variant="ghost"
                      className="border border-[#ea2261]/30 text-[#ea2261] hover:bg-[#ea2261]/10 rounded-[4px] font-normal"
                      onClick={() => {
                        setHasStarted(false);
                        setRestructureError(null);
                        startRestructuring(modelUsed || localSelectedId);
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry with {AVAILABLE_MODELS.find((m) => m.id === (modelUsed || localSelectedId))?.name || 'Same Model'}
                    </Button>

                    <Button
                      variant="ghost"
                      className="border border-border text-foreground hover:bg-muted rounded-[4px] font-normal"
                      onClick={handleRetryWithDifferent}
                    >
                      <Cpu className="w-4 h-4 mr-2" />
                      Try Different Model
                    </Button>
                  </div>

                  {/* Quick dropdown selector */}
                  <div className="flex flex-col items-center gap-2">
                    <label className="text-xs font-normal text-muted-foreground">
                      Quick Switch:
                    </label>
                    <Select
                      value={localSelectedId}
                      onValueChange={(val) => {
                        setLocalSelectedId(val);
                        const m = AVAILABLE_MODELS.find((x) => x.id === val);
                        if (m) setSelectedModel(m);
                      }}
                    >
                      <SelectTrigger className="w-64 rounded-[4px] border-border">
                        <SelectValue placeholder="Choose a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelGroups.map((group) => (
                          <div key={group.provider.id}>
                            <SelectItem value={`__group-${group.provider.id}`} disabled className="text-xs font-normal text-muted-foreground bg-muted pointer-events-none">
                              ── {group.provider.icon} {group.provider.name} ──
                            </SelectItem>
                            {group.models.map((model) => (
                              <SelectItem key={model.id} value={model.id} className="pl-6">
                                <span className="flex items-center gap-2">
                                  {model.name}
                                  {!model.requiresApiKey && (
                                    <span className="text-[10px] text-[#15be53]">(built-in in Z.ai)</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Fallback suggestion — improved visual hierarchy */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-4"
              >
                <Card className="border-border bg-muted rounded-[6px]">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#15be53]" />
                      GLM models are available when configured
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4 font-light">Use ZHIPU_API_KEY (or GLM_API_KEY/BIGMODEL_API_KEY) on hosted deployments, then retry below</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {glmFallbackModels.map((model, idx) => {
                        const speed = getSpeedLabel(model.speed);
                        const isSelected = localSelectedId === model.id;
                        return (
                          <Card
                            key={model.id}
                            className={`cursor-pointer transition-all duration-200 rounded-[6px] ${
                              isSelected
                                ? 'ring-2 ring-primary border-[#b9b9f9] bg-secondary shadow-stripe-sm'
                                : 'border-border hover:border-[#b9b9f9] hover:shadow-stripe-sm bg-white'
                            }`}
                            onClick={() => {
                              handleSelectModel(model.id);
                              setHasStarted(false);
                              setRestructureError(null);
                              startRestructuring(model.id);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2 mb-2">
                                {/* Radio-dot for consistency */}
                                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
                                  isSelected ? 'border-primary' : 'border-border'
                                }`}>
                                  {isSelected && (
                                    <motion.div
                                      className="w-2 h-2 rounded-full bg-primary"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-semibold text-foreground truncate">{model.name}</span>
                                    <Badge className={`text-[9px] border rounded-[4px] shrink-0 ${model.badgeColor}`}>
                                      {model.badge}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2 font-light pl-6">
                                {model.bestFor}
                              </p>
                              <div className="flex items-center justify-between pl-6">
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${speed.dotColor}`} />
                                  <span className={`text-[10px] font-normal ${speed.color}`}>{speed.label}</span>
                                </div>
                                {idx === 0 && (
                                  <Badge className="text-[9px] bg-[rgba(21,190,83,0.15)] text-[#108c3d] border border-[rgba(21,190,83,0.3)] rounded-[4px] h-4">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
