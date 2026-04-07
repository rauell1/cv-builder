'use client';

import { motion } from 'framer-motion';
import { Upload, Search, Cpu, Download, Check } from 'lucide-react';
import type { BuilderStep } from '@/lib/cv-store';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: BuilderStep;
}

const steps: {
  id: BuilderStep;
  label: string;
  shortLabel: string;
  icon: typeof Upload;
}[] = [
  { id: 'cv-input', label: 'Upload CV', shortLabel: 'CV', icon: Upload },
  { id: 'job-desc', label: 'Job Description', shortLabel: 'JD', icon: Search },
  { id: 'processing', label: 'AI Processing', shortLabel: 'AI', icon: Cpu },
  { id: 'output', label: 'Download', shortLabel: 'PDF', icon: Download },
];

const stepOrder: BuilderStep[] = ['cv-input', 'job-desc', 'processing', 'output'];

function getStepIndex(step: BuilderStep): number {
  return stepOrder.indexOf(step);
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <nav
      role="navigation"
      aria-label="Progress"
      className="w-full mb-6"
    >
      {/* Desktop version */}
      <div className="hidden sm:flex items-center w-full">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <motion.div
                className="relative flex flex-col items-center gap-2"
                initial={false}
                animate={{
                  scale: isActive ? 1.05 : 1,
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Step icon */}
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-300 relative',
                    isCompleted
                      ? 'bg-[#15be53] border-[#15be53] text-white shadow-sm'
                      : isActive
                        ? 'bg-primary border-primary text-white shadow-glow-sm ring-4 ring-primary/15'
                        : 'bg-white border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}

                  {/* Pulsing dot on active step */}
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                      <span
                        className="block w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                {/* Step label with background pill for active state */}
                <span
                  className={cn(
                    'text-xs transition-all duration-300 px-3 py-0.5 rounded-full',
                    isActive
                      ? 'font-medium text-primary bg-secondary'
                      : isCompleted
                        ? 'font-normal text-[#15be53]'
                        : 'font-normal text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </motion.div>

              {/* Connecting progress line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1.5rem]">
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={false}
                      animate={{
                        width: isCompleted ? '100%' : '0%',
                      }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile version */}
      <div className="flex sm:hidden items-center justify-between px-2">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <div key={step.id} className="flex items-center gap-1.5 flex-1 last:flex-none last:gap-0">
              <motion.div
                className="relative flex flex-col items-center gap-1.5"
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 text-[11px] relative',
                    isCompleted
                      ? 'bg-[#15be53] border-[#15be53] text-white'
                      : isActive
                        ? 'bg-primary border-primary text-white shadow-glow-sm ring-2 ring-primary/20'
                        : 'bg-white border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}

                  {/* Pulsing dot on active step (mobile) */}
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                      <span
                        className="block w-1 h-1 rounded-full bg-primary animate-pulse-dot"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px] leading-tight transition-colors duration-300',
                    isActive
                      ? 'font-medium text-primary'
                      : isCompleted
                        ? 'font-normal text-[#15be53]'
                        : 'font-normal text-muted-foreground'
                  )}
                >
                  {step.shortLabel}
                </span>
              </motion.div>

              {/* Connecting progress line (mobile) */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-1 mt-[-1rem]">
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={false}
                      animate={{
                        width: isCompleted ? '100%' : '0%',
                      }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
