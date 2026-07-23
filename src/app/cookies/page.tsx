import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cookie Policy & Tracker Audit",
  description: "Detailed Cookie Policy and real-time category classification.",
};

export default function CookiePolicyPage() {
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
            <Cookie className="h-4 w-4" /> Google Consent Mode v2 & IAB TCF 2.3
          </div>
        </div>

        <div className="space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground">
            Understand how cookies and local storage tokens are used on this platform.
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. What Are Cookies?</h2>
            <p>
              Cookies are small data files stored on your device to maintain session state, security, and user preferences.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Cookie Categories</h2>

            <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40">
              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Strictly Necessary Cookies</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">Required</span>
                </div>
                <p className="text-xs text-muted-foreground">Security tokens, consent state flags, and session routing.</p>
              </div>

              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Functional Cookies</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">Optional</span>
                </div>
                <p className="text-xs text-muted-foreground">Language choice, theme preference, and auto-saved draft states.</p>
              </div>

              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Analytics Cookies</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">Optional</span>
                </div>
                <p className="text-xs text-muted-foreground">Aggregated visitor performance metrics via Google Analytics / Vercel Analytics.</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Managing Consent</h2>
            <p>
              You can adjust or revoke your cookie choices at any time using the floating <strong>Cookie Settings</strong> button at the bottom-left of the page.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
