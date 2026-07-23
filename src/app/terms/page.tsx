import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service and legal usage terms.",
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
            General conditions governing the use of this application.
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
            <p>
              By accessing this website, you agree to comply with all applicable terms, conditions, and data protection regulations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Authorized Use</h2>
            <p>
              You agree not to submit malicious code, automate unauthorized API scraping, or compromise platform infrastructure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Intellectual Property</h2>
            <p>
              All software algorithms and interface components belong to Roy Okola Otieno. Users retain full ownership of their personal document inputs.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
