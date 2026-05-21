'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  Download,
  ArrowRight,
  Cpu,
  Sparkles,
  Shield,
  Zap,
  Globe,
  Star,
  ChevronRight,
  Heart,
  Github,
  Twitter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCVBuilderStore } from '@/lib/cv-store';
import {
  AVAILABLE_MODELS,
  AI_PROVIDERS,
} from '@/lib/cv-types';

/* ── Features ──────────────────────────────────────────────── */

const features = [
  {
    icon: FileText,
    title: 'Smart CV Parsing',
    description:
      'Upload PDF, image, DOCX, or paste text. AI extracts every detail with OCR fallback for scanned documents.',
    accent: 'from-violet-500 to-purple-600',
    accentBorder: '#7c3aed',
  },
  {
    icon: Cpu,
    title: 'Multi-Model AI',
    description:
      'Choose from 9+ models across GLM, GPT, Claude, and Gemini. Auto-switches for best results.',
    accent: 'from-emerald-500 to-teal-600',
    accentBorder: '#0d9488',
  },
  {
    icon: Sparkles,
    title: 'Section AI Insights',
    description:
      'Get actionable feedback per section with scores, keyword matching, and AI-powered improvements.',
    accent: 'from-amber-500 to-orange-600',
    accentBorder: '#d97706',
  },
  {
    icon: Download,
    title: '5 CV Formats',
    description:
      'Europass, ATS-Friendly, Modern, Creative, and Classic. Plus cover letter generation.',
    accent: 'from-rose-500 to-pink-600',
    accentBorder: '#e11d48',
  },
];

/* ── Stats / Social Proof ─────────────────────────────────── */

const stats = [
  { value: '9+', label: 'AI Models' },
  { value: '5', label: 'CV Formats' },
  { value: '5', label: 'Cover Letters' },
  { value: 'OCR', label: 'Scan Support' },
];

/* ── How It Works ──────────────────────────────────────────── */

const steps = [
  {
    step: 1,
    title: 'Upload Your CV',
    description: 'Drop a PDF, image, or paste your CV text. AI extracts all sections automatically.',
    icon: FileText,
  },
  {
    step: 2,
    title: 'Add Job Description',
    description: 'Paste the target job description for AI-powered keyword matching and tailoring.',
    icon: Globe,
  },
  {
    step: 3,
    title: 'Choose AI Model',
    description: 'Select from GLM, GPT, Claude, or Gemini. GLM models are built-in in Z.ai and key-based on external hosting.',
    icon: Cpu,
  },
  {
    step: 4,
    title: 'Download & Iterate',
    description: 'Get your tailored CV with insights, cover letter, and export as PDF.',
    icon: Download,
  },
];

/* ── Testimonials ──────────────────────────────────────────── */

const testimonials = [
  {
    quote: 'The AI matched my CV keywords to the job description perfectly. Got 3 interviews in a week.',
    author: 'Sarah M.',
    role: 'Software Engineer',
  },
  {
    quote: 'Europass format saved me hours. The AI restructured my bullet points to highlight achievements.',
    author: 'James L.',
    role: 'Product Manager',
  },
  {
    quote: 'Cover letter generation is incredible. It pulled specific achievements from my CV that matched the role.',
    author: 'Ana K.',
    role: 'Data Scientist',
  },
];

const footerProductLinks: { label: string; sectionId: string }[] = [
  { label: 'Features', sectionId: 'features' },
  { label: 'AI Models', sectionId: 'models' },
  { label: 'How It Works', sectionId: 'how-it-works' },
];

const footerResourceLinks: { label: string; sectionId: string }[] = [
  { label: 'CV Tips', sectionId: 'features' },
  { label: 'ATS Guide', sectionId: 'features' },
  { label: 'Support', sectionId: 'how-it-works' },
];

/* ── Models ────────────────────────────────────────────────── */

function getModelCount() {
  return `${AVAILABLE_MODELS.length} models across ${AI_PROVIDERS.filter((p) => p.id !== 'custom').length} providers`;
}

/* ── Animation variants ────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/* ── Component ─────────────────────────────────────────────── */

export function LandingPage() {
  const setStep = useCVBuilderStore((s) => s.setStep);
  const prefersReducedMotion = useReducedMotion();

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const sectionAnimationProps = prefersReducedMotion
    ? {}
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, margin: '-80px' },
        variants: containerVariants,
      };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══════════════════════════════════════════
          Navigation Bar
          ═══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 glass-nav" aria-label="Main navigation">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-glow-sm" aria-hidden="true">
              <Cpu className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              AI CV Builder
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden sm:flex items-center gap-6">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}
              aria-label="Navigate to Features section"
              className="text-xs text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-y-px"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              }}
              aria-label="Navigate to How It Works section"
              className="text-xs text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-y-px"
            >
              How It Works
            </a>
            <a
              href="#models"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('models');
              }}
              aria-label="Navigate to AI Models section"
              className="text-xs text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-y-px"
            >
              AI Models
            </a>
          </div>

          {/* CTA */}
          <Button
            size="sm"
            onClick={() => setStep('cv-input')}
            className="h-8 px-4 text-xs bg-primary hover:bg-[#4434d4] text-white rounded-lg font-medium shadow-glow-sm transition-all duration-200 animate-pulse-ring"
          >
            Get Started
            <ArrowRight className="ml-1.5 w-3 h-3" />
          </Button>
        </div>
      </nav>

      {/* Top gradient accent line */}
      <div className="h-0.5 bg-stripe-gradient" role="img" aria-hidden="true" />

      <div className="flex-1 flex flex-col">
        {/* ═══════════════════════════════════════════
            Hero Section
            ═══════════════════════════════════════════ */}
        <motion.section
          className="relative overflow-hidden"
          initial={prefersReducedMotion ? undefined : 'hidden'}
          animate={prefersReducedMotion ? undefined : 'visible'}
          variants={prefersReducedMotion ? undefined : containerVariants}
          aria-labelledby="hero-heading"
        >
          {/* Background gradient mesh */}
          <div className="absolute inset-0 bg-hero-gradient pointer-events-none" role="img" aria-hidden="true" />
          <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" role="img" aria-hidden="true" />

          {/* Floating decorative elements */}
          <div className="absolute top-20 left-[10%] w-2 h-2 rounded-full bg-primary/20 animate-float" role="img" aria-hidden="true" />
          <div className="absolute top-32 right-[15%] w-3 h-3 rounded-full bg-[#ea2261]/15 animate-float-delayed" role="img" aria-hidden="true" />
          <div className="absolute bottom-20 left-[20%] w-1.5 h-1.5 rounded-full bg-[#15be53]/20 animate-float" role="img" aria-hidden="true" />
          <div className="absolute top-48 right-[8%] w-2.5 h-2.5 rounded-full bg-[#f96bee]/15 animate-float-delayed" role="img" aria-hidden="true" />

          <div className="relative flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-24 md:pt-28 md:pb-32 lg:pt-36 lg:pb-40">
            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-8">
              <Badge
                variant="outline"
                className="px-4 py-1.5 text-[11px] font-medium text-secondary-foreground bg-secondary/60 rounded-full badge-gradient-border"
              >
                <Zap className="w-3 h-3 mr-1" />
                Powered by {getModelCount()}
              </Badge>
            </motion.div>

            {/* Logo / Brand with decorative gradient orb */}
            <motion.div variants={itemVariants} className="mb-8 relative">
              <div className="hero-orb" role="img" aria-hidden="true" />
              <div className="relative w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-glow">
                <Cpu className="w-8 h-8 text-white" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              id="hero-heading"
              className="text-4xl sm:text-5xl md:text-6xl font-semibold text-center mb-6 tracking-tight"
              variants={itemVariants}
            >
              <span className="text-gradient">AI CV Builder</span>
            </motion.h1>

            {/* Subtitle with reveal feel */}
            <motion.p
              className="text-base sm:text-lg text-muted-foreground text-center max-w-lg mb-12 font-normal leading-relaxed"
              variants={itemVariants}
            >
              Multi-model AI intelligence meets professional CV formats.
              Upload, analyze, and generate a perfectly tailored resume.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap justify-center">
              <Button
                size="lg"
                onClick={() => setStep('cv-input')}
                className="h-13 px-9 text-sm bg-primary hover:bg-[#4434d4] text-white rounded-xl font-medium shadow-glow transition-all duration-200 hover:shadow-glow-sm"
              >
                Build Your CV
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => scrollToSection('how-it-works')}
                className="h-13 px-7 text-sm text-foreground rounded-xl font-medium hover:bg-secondary transition-all duration-200"
              >
                See How It Works
                <ChevronRight className="ml-1.5 w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-6 sm:gap-10 mt-16"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════
            Features Grid
            ═══════════════════════════════════════════ */}
        <motion.section
          id="features"
          className="relative px-4 sm:px-6 py-16 md:py-24"
          {...sectionAnimationProps}
          aria-labelledby="features-heading"
        >
          <div className="absolute inset-0 bg-section-gradient pointer-events-none" role="img" aria-hidden="true" />

          <div className="relative max-w-5xl mx-auto">
            <motion.div variants={fadeUp} className="text-center mb-12">
              <Badge
                variant="outline"
                className="px-3 py-1 text-[11px] font-medium border-border text-muted-foreground rounded-full mb-4"
              >
                Features
              </Badge>
              <h2
                id="features-heading"
                className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 tracking-tight"
              >
                Everything You Need
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                A complete toolkit to craft a standout CV, from parsing to PDF generation
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div key={feature.title} variants={itemVariants}>
                    <Card className="h-full border-border rounded-2xl bg-white group overflow-hidden feature-card-hover hover:scale-[1.01] hover:shadow-stripe-sm transition-all duration-300">
                      {/* Top accent border line */}
                      <div
                        className="h-[2px] w-full"
                        style={{ background: `linear-gradient(90deg, ${feature.accentBorder} 0%, transparent 100%)` }}
                        role="img"
                        aria-hidden="true"
                      />
                      <CardContent className="p-6">
                        {/* Icon with gradient background + glow effect */}
                        <div
                          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.accent} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-300 icon-glow`}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>

                        <h3 className="font-semibold text-foreground text-sm mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════
            How It Works
            ═══════════════════════════════════════════ */}
        <motion.section
          id="how-it-works"
          className="px-4 sm:px-6 py-16 md:py-24"
          {...sectionAnimationProps}
          aria-labelledby="how-it-works-heading"
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <Badge
              variant="outline"
              className="px-3 py-1 text-[11px] font-medium border-border text-muted-foreground rounded-full mb-4"
            >
              Process
            </Badge>
            <h2
              id="how-it-works-heading"
              className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 tracking-tight"
            >
              How It Works
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Four simple steps to a perfectly tailored CV
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-5xl mx-auto">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === steps.length - 1;
              return (
                <motion.div key={item.step} variants={itemVariants}>
                  <Card
                    className={`h-full border-border rounded-2xl bg-white hover-lift relative overflow-hidden group ${!isLast ? 'lg:step-connector' : ''}`}
                  >
                    {/* Step number watermark */}
                    <div className="absolute top-3 right-3 text-4xl font-bold text-secondary select-none group-hover:text-secondary-foreground/10 transition-colors duration-300" aria-hidden="true">
                      {item.step}
                    </div>
                    <CardContent className="p-6 relative">
                      {/* Animated numbered circle */}
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary transition-all duration-300 step-circle" style={{ animationDelay: `${index * 150}ms` }}>
                        <span className="text-primary font-bold text-sm group-hover:text-white transition-colors duration-300 step-circle" style={{ animationDelay: `${index * 150}ms` }}>
                          {item.step}
                        </span>
                      </div>
                      {/* Icon below number */}
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors duration-300 -mt-1">
                        <Icon className="w-4.5 h-4.5 text-primary group-hover:scale-110 transition-all duration-300" />
                      </div>
                      <h3 className="font-semibold text-foreground text-sm mb-2">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* CTA under How It Works */}
          <motion.div variants={fadeUp} className="text-center mt-12">
            <Button
              size="lg"
              onClick={() => setStep('cv-input')}
              className="h-12 px-8 text-sm bg-primary hover:bg-[#4434d4] text-white rounded-xl font-medium shadow-glow-sm transition-all duration-200"
            >
              Start Building Now
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </motion.section>

        {/* ═══════════════════════════════════════════
            AI Models Section (Streamlined)
            ═══════════════════════════════════════════ */}
        <motion.section
          id="models"
          className="relative px-4 sm:px-6 py-16 md:py-24"
          {...sectionAnimationProps}
          aria-labelledby="models-heading"
        >
          <div className="absolute inset-0 bg-mesh-pattern pointer-events-none" role="img" aria-hidden="true" />

          <motion.div variants={fadeUp} className="text-center mb-12">
            <Badge
              variant="outline"
              className="px-3 py-1 text-[11px] font-medium border-border text-muted-foreground rounded-full mb-4"
            >
              AI Models
            </Badge>
            <h2
              id="models-heading"
              className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 tracking-tight"
            >
              Multi-Model AI Power
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              {getModelCount()}. GLM models are built-in and free — others work with your own API key.
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {AI_PROVIDERS.filter((p) => p.id !== 'custom').map((provider) => {
              const models = AVAILABLE_MODELS.filter((m) => m.provider === provider.id);
              const isBuiltIn = !models.some((m) => m.requiresApiKey);

              return (
                <motion.div key={provider.id} variants={itemVariants}>
                  <Card className="h-full border-border rounded-2xl bg-white hover-lift overflow-hidden group">
                    <CardContent className="p-6">
                      {/* Provider icon */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl" role="img" aria-hidden="true">{provider.icon}</span>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            {provider.name}
                          </h3>
                          <Badge
                            className={`text-[10px] px-1.5 py-0 rounded-full ${
                              isBuiltIn
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {isBuiltIn ? 'Built-in' : 'API Key'}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        {provider.description}
                      </p>

                      {/* Model list */}
                      <div className="space-y-2">
                        {models.map((model) => (
                          <div
                            key={model.id}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-muted group-hover:bg-secondary/50 transition-colors duration-200"
                          >
                            <span className="text-xs font-medium text-foreground">
                              {model.name}
                            </span>
                            <Badge
                              className={`text-[9px] px-1.5 py-0 rounded-full ${model.badgeColor}`}
                            >
                              {model.badge}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════
            Testimonials
            ═══════════════════════════════════════════ */}
        <motion.section
          className="relative px-4 sm:px-6 py-16 md:py-24 bg-muted"
          {...sectionAnimationProps}
          aria-labelledby="testimonials-heading"
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-pattern-subtle pointer-events-none" role="img" aria-hidden="true" />

          <motion.div variants={fadeUp} className="text-center mb-12 relative">
            <Badge
              variant="outline"
              className="px-3 py-1 text-[11px] font-medium border-border text-muted-foreground bg-white rounded-full mb-4"
            >
              Testimonials
            </Badge>
            <h2
              id="testimonials-heading"
              className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 tracking-tight"
            >
              Loved by Professionals
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              See what our users say about their experience
            </p>
          </motion.div>

          <div className="relative max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {testimonials.map((t) => (
              <motion.div key={t.author} variants={itemVariants}>
                <Card className="h-full border-border rounded-2xl bg-white hover-lift hover:shadow-stripe-sm transition-all duration-300">
                  <CardContent className="p-6 relative">
                    {/* Decorative quote mark */}
                    <div className="quote-mark absolute top-4 right-4" aria-hidden="true">
                      &ldquo;
                    </div>
                    {/* Stars */}
                    <div className="flex items-center gap-0.5 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star
                          key={j}
                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-5 italic relative z-10">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {t.author[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{t.author}</p>
                        <p className="text-[11px] text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════
            Trust & Security
            ═══════════════════════════════════════════ */}
        <motion.section
          className="px-4 sm:px-6 py-16 md:py-20"
          {...sectionAnimationProps}
          aria-labelledby="trust-heading"
        >
          <div className="max-w-5xl mx-auto">
            <motion.div variants={fadeUp}>
              <Card className="trust-gradient-border rounded-2xl bg-gradient-to-br from-secondary to-white overflow-hidden">
                <CardContent className="p-8 md:p-10">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3
                        id="trust-heading"
                        className="font-semibold text-foreground text-base mb-1.5"
                      >
                        Privacy-First Processing
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                        Your CV data is processed by AI models and never stored permanently. No accounts required, no data retention. Your information stays yours.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setStep('cv-input')}
                      className="shrink-0 border-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl font-medium transition-all duration-200"
                    >
                      Try It Now
                      <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════
          Footer
          ═══════════════════════════════════════════ */}
      <footer className="mt-auto border-t border-border bg-muted" aria-label="Site footer">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
                  <Cpu className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  AI CV Builder
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-4">
                Multi-model AI-powered CV builder with intelligent parsing, job-matching, and professional PDF generation.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:border-[#b9b9f9] hover:text-primary transition-all duration-200 text-muted-foreground hover:-translate-y-0.5"
                  aria-label="Visit GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:border-[#b9b9f9] hover:text-primary transition-all duration-200 text-muted-foreground hover:-translate-y-0.5"
                  aria-label="Visit X"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                Product
              </h4>
              <ul className="space-y-2.5">
                {footerProductLinks.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.sectionId)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200 link-underline"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                Resources
              </h4>
              <ul className="space-y-2.5">
                {footerResourceLinks.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.sectionId)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200 link-underline"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Built with AI-powered intelligence
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-[#ea2261] fill-[#ea2261]" aria-label="love" /> by Z.ai
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
