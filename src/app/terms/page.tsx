import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for the AI CV Builder.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <Lock className="h-4 w-4" /> Terms of Service
          </div>
        </div>

        <div className="space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: 2026-01-01 • Last Updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
            <p>
              By using this site you agree to these Terms. If you do not agree, please do not use the
              service. No account or payment is required to use it.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. What This Service Does</h2>
            <p>
              You upload a CV and a job description; AI parses, restructures, and scores your CV against
              the job, and can generate a matching cover letter. Your CV content is sent to third-party AI
              providers (NVIDIA and, as a backup, Google) to produce these results — see the{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>{" "}
              for details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. AI Output Is Not Guaranteed Accurate</h2>
            <p>
              AI-generated content — including restructured CV text, ATS scores, insights, and cover
              letters — may contain errors, omissions, or inaccurate claims about your experience. You are
              solely responsible for reviewing and correcting all AI output before using it to apply for a
              job, sending it to an employer, or relying on it in any other way. We make no warranty that
              any AI output is accurate, complete, or will improve your chances of employment.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Authorized Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Upload another person&apos;s personal data (including their CV) without their knowledge and consent;</li>
              <li>Submit malicious files, code, or payloads;</li>
              <li>Attempt to scrape, automate, or overload the service beyond normal individual use;</li>
              <li>Attempt to reverse-engineer, extract, or resell the underlying software.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Intellectual Property</h2>
            <p>
              The software, templates, and interface belong to Roy Okola Otieno. You retain full ownership
              of the personal content you upload (your CV, job descriptions, and generated outputs).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Service Availability</h2>
            <p>
              The service is provided &quot;as is&quot; and &quot;as available,&quot; with no guaranteed
              uptime. It depends on third-party AI providers (NVIDIA, Google) that may themselves be
              unavailable, rate-limited, or degraded at times, which can cause slower responses or
              temporary failures outside of our control.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, we are not liable for any indirect, incidental, or
              consequential damages arising from your use of this service, including damages resulting
              from inaccurate AI output, service interruptions, or third-party AI provider outages. The
              service is offered free of charge on an &quot;as is&quot; basis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after an update
              means you accept the revised Terms. The &quot;Last Updated&quot; date above reflects the
              latest revision.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <code className="bg-muted px-2 py-0.5 rounded text-foreground font-mono">privacy@rauell.systems</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
