import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What cookies and local storage this site actually uses.",
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
            <Cookie className="h-4 w-4" /> Cookie Policy
          </div>
        </div>

        <div className="space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground">
            What this site actually stores in your browser, and why.
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Cookies vs. Local Storage</h2>
            <p>
              This site does not set any server-side authentication or tracking cookies. Your cookie
              preference choice itself is saved in your browser&apos;s <strong>local storage</strong> (not a
              cookie) so we remember your choice on your next visit. We use the term &quot;cookie
              preferences&quot; below because it&apos;s the familiar name for this kind of control, even
              though the mechanism is local storage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. What We Actually Use</h2>

            <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40">
              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Strictly Necessary</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">Required</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your cookie preference choice, stored in local storage so the banner doesn&apos;t reappear
                  every visit. Nothing else - there is no login, so no session/auth cookie exists.
                </p>
              </div>

              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Functional</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">Optional</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Not currently used by this app. Reserved for future preferences like theme or language,
                  which are not yet implemented.
                </p>
              </div>

              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Analytics</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">Always on</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Vercel Analytics</strong> - aggregate page views and load-time metrics. It is
                  cookie-less and does not identify you or track you across other sites, so it runs
                  regardless of your preference choice below.
                </p>
              </div>

              <div className="p-4 bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Marketing / Advertising</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">Not used</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  We do not run Google Analytics, any advertising pixel, or any cross-site tracker. This
                  category exists in our preference center for completeness but nothing is currently
                  gated behind it.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Managing Your Preferences</h2>
            <p>
              You can change your preference choice at any time using the <strong>Cookie Settings</strong>{" "}
              button on the page. Clearing your browser&apos;s local storage will also reset it and show the
              banner again on your next visit.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
