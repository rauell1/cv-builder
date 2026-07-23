import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | GDPR & CCPA Compliance",
  description: "Comprehensive Privacy Policy detailing user data rights under GDPR and CCPA.",
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
            <ShieldCheck className="h-4 w-4" /> GDPR & CCPA Verified
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: {new Date().getFullYear()}-01-01 • Last Updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              Your privacy is paramount. This Privacy Policy details how personal information is collected, processed, and safeguarded when using our AI CV Builder and engineering productivity suite under EU GDPR and California CCPA guidelines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Data We Process</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Resume Content:</strong> Education, work history, and contact details provided during CV optimization.</li>
              <li><strong>Technical Metadata:</strong> Anonymized IP addresses, session parameters, and consent state logs.</li>
              <li><strong>Analytics Data:</strong> Page metrics and load performance (only with active consent).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Geotargeted Rights (GDPR & CCPA)</h2>
            <p>
              <strong>EU Citizens (GDPR):</strong> You have the right to request access, rectification, data portability, and immediate erasure of your data.
            </p>
            <p>
              <strong>California Residents (CCPA/CPRA):</strong> We do not sell or share personal information with third parties for monetary gain.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Contact Privacy Officer</h2>
            <p>
              For privacy inquiries or consent requests, contact us at: <code className="bg-muted px-2 py-0.5 rounded text-foreground font-mono">privacy@rauell.systems</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
