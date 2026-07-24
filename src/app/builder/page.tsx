'use client';

import { AnimatePresence } from 'framer-motion';
import { useCVBuilderStore } from '@/lib/cv-store';
import { StepIndicator } from '@/components/cv-builder/step-indicator';
import { CvInputStep } from '@/components/cv-builder/cv-input-step';
import { JobDescStep } from '@/components/cv-builder/job-desc-step';
import { ProcessingStep } from '@/components/cv-builder/processing-step';
import { OutputStep } from '@/components/cv-builder/output-step';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/ui/logo';

const BUILDER_STEPS = ['cv-input', 'job-desc', 'processing', 'output'] as const;

export default function BuilderPage() {
  const step = useCVBuilderStore((s) => s.step);
  const setStep = useCVBuilderStore((s) => s.setStep);

  // Secure navigation: ensure step state is initialized correctly
  useEffect(() => {
    if (step === 'landing') {
      setStep('cv-input');
    }
  }, [step, setStep]);

  const currentStepNumber = BUILDER_STEPS.indexOf(step as (typeof BUILDER_STEPS)[number]) + 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Builder header */}
      <header className="sticky top-0 z-50 glass-nav border-b border-border">
        <div className="h-0.5 bg-stripe-gradient" aria-hidden="true" />
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" passHref legacyBehavior>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary -ml-1 transition-colors duration-200"
                aria-label="Back to home"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-5 bg-border" />
            <Logo size="sm" href="/" />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Step {currentStepNumber > 0 ? currentStepNumber : 1} of {BUILDER_STEPS.length}
          </span>
        </div>
      </header>

      {/* Step indicator */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <StepIndicator currentStep={step === 'landing' ? 'cv-input' : step} />
      </div>

      {/* Main content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <AnimatePresence mode="wait">
          {step === 'cv-input' && <CvInputStep key="cv-input" />}
          {step === 'job-desc' && <JobDescStep key="job-desc" />}
          {step === 'processing' && <ProcessingStep key="processing" />}
          {step === 'output' && <OutputStep key="output" />}
          {step === 'landing' && <CvInputStep key="cv-input" />}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-muted/50" aria-label="Site footer">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            AI-powered CV intelligence
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-[#ea2261] fill-[#ea2261]" aria-label="love" /> by Roy Okola Otieno
          </p>
        </div>
      </footer>
    </div>
  );
}
