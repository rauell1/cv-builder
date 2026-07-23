import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | GDPR & CCPA Compliance",
  description: "Privacy Policy detailing what the AI CV Builder collects, how CV data is processed by AI providers, retention periods, and user rights under GDPR and CCPA.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4" /> GDPR & CCPA
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: 2026-01-01 • Last Updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              AI CV Builder ("we", "us") lets you upload a CV and a job description so AI can restructure
              your experience, match keywords, and generate a tailored CV, insights, and cover letter. This
              policy explains what data we collect, how it is processed - including by third-party AI
              providers - how long it is kept, and the rights you have over it.
            </p>
            <p>
              No account or sign-up is required to use this service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>CV content:</strong> the raw text or file you upload, and the name, email, phone number, location, work history, education, and skills extracted from it.</li>
              <li><strong>Job description text:</strong> the job posting you paste in for tailoring and analysis.</li>
              <li><strong>Generated outputs:</strong> the AI-restructured CV, ATS score, section insights, and any cover letter generated from the above.</li>
              <li><strong>Technical data:</strong> your IP address, read transiently in server memory to enforce rate limits and block abuse. It is not written to our database or retained after the request completes.</li>
              <li><strong>Cookie consent choices:</strong> your accepted/rejected categories, stored in your browser&apos;s local storage (not a server-side cookie), and separately in a short-lived in-memory audit log on our server (see Section 6).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. How Your CV Is Processed - Third-Party AI Providers</h2>
            <p>
              This is the most important section of this policy: to parse, analyze, restructure, and score
              your CV, its content (including your name, contact details, and work history) is sent over an
              encrypted connection to one or more of the following third-party AI processors:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>NVIDIA</strong> (NVIDIA NIM inference API) - our primary AI provider for parsing, restructuring, scoring, and cover letter generation.</li>
              <li><strong>Google</strong> (Gemini API, via Google AI Studio) - used only as a backup if NVIDIA is unavailable.</li>
            </ul>
            <p>
              These providers process your data solely to generate the response returned to you and, per
              their own published API terms, do not use content submitted through their developer/API
              products to train their models. We do not control their infrastructure directly and encourage
              you to review NVIDIA&apos;s and Google&apos;s own privacy terms for their API products if you
              want more detail.
            </p>
            <p>
              We do not send your CV data to any advertising, marketing, or analytics company. There is no
              ad tracking or data resale on this site.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. How Long We Keep Your Data</h2>
            <p>
              Your session (uploaded CV text, parsed data, job description, and tailored output) is stored
              in our database and <strong>automatically and permanently deleted after 30 days</strong> by a
              scheduled daily job. We do not keep CVs indefinitely, and there is no user account for us to
              tie your data to beyond that window.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Analytics</h2>
            <p>
              We use Vercel Analytics to see aggregate, anonymous metrics like page views and load
              performance. It does not use cookies, does not track you across other websites, and does not
              collect personally identifiable information. It runs regardless of your cookie preference
              selections below, since it does not process personal data or set tracking identifiers.
            </p>
            <p>
              We do not use Google Analytics, advertising pixels, or any cross-site tracking technology.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Cookie Consent Logging</h2>
            <p>
              When you make a cookie preference choice, a record of that choice (categories selected,
              timestamp, browser type, and a one-way hashed version of your IP address - not the IP address
              itself) is temporarily kept in server memory for audit purposes. This log is not written to a
              persistent database and is cleared whenever the server restarts or redeploys.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
            <p>
              <strong>EU / UK residents (GDPR):</strong> you have the right to request access to, correction
              of, or deletion of your data, and to object to processing. Because sessions auto-delete after
              30 days and we do not require an account, most data expires on its own; if you want a specific
              session deleted sooner, email us with the session ID or the approximate date/time you used the
              tool and we will delete it manually within a reasonable time.
            </p>
            <p>
              <strong>California residents (CCPA/CPRA):</strong> we do not sell or share your personal
              information for money or other valuable consideration, and we do not use it for cross-context
              behavioral advertising.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>
              For privacy questions or to request early deletion of your data, contact:{" "}
              <code className="bg-muted px-2 py-0.5 rounded text-foreground font-mono">privacy@rauell.systems</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
