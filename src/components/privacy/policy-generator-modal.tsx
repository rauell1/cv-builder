"use client";

import React, { useState } from "react";
import { useCookieConsent } from "@/lib/cookie-consent-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Cookie,
  Lock,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Code,
  Eye,
  SlidersHorizontal,
  Globe,
  Mail,
  Calendar,
  Building,
} from "lucide-react";

export const PolicyGeneratorModal: React.FC = () => {
  const { isPolicyGeneratorOpen, setIsPolicyGeneratorOpen, activePolicyTab } = useCookieConsent();

  const [companyName, setCompanyName] = useState<string>("Roy Okola Otieno Solutions");
  const [domain, setDomain] = useState<string>("cv-builder.rauell.systems");
  const [contactEmail, setContactEmail] = useState<string>("privacy@rauell.systems");
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"formatted" | "markdown" | "html">("formatted");

  // Format generators for raw export — kept in sync with src/app/privacy,
  // src/app/terms, and src/app/cookies. These describe what the app
  // actually does (NVIDIA/Google AI processing, 30-day auto-deletion,
  // cookie-less Vercel Analytics) rather than generic ad-tech boilerplate.
  const getRawMarkdown = (tab: string) => {
    if (tab === "cookies") {
      return `# Cookie Policy for ${companyName}

**Effective Date:** ${effectiveDate}
**Website:** https://${domain}
**Contact Email:** ${contactEmail}

---

## 1. Cookies vs. Local Storage
This site sets no server-side authentication or tracking cookies. Your cookie preference choice is saved in your browser's local storage, not a cookie, so we remember it on your next visit.

---

## 2. What We Actually Use
- **Strictly Necessary:** Your cookie preference choice (local storage). No login exists, so there is no session/auth cookie.
- **Functional:** Not currently used. Reserved for future preferences (theme, language) that are not yet implemented.
- **Analytics (always on):** Vercel Analytics — aggregate page views and load-time metrics. Cookie-less, does not identify you, runs regardless of your preference choice.
- **Marketing / Advertising (not used):** We do not run Google Analytics, an ad pixel, or any cross-site tracker. This category exists for completeness only.

---

## 3. Managing Your Preferences
Change your choice anytime via the Cookie Settings button, or clear your browser's local storage to reset it.`;
    }

    if (tab === "terms") {
      return `# Terms of Service for ${companyName}

**Effective Date:** ${effectiveDate}
**Website:** https://${domain}
**Contact Email:** ${contactEmail}

---

## 1. Agreement to Terms
By using https://${domain} you agree to these Terms. No account or payment is required.

---

## 2. What This Service Does
You upload a CV and a job description; AI parses, restructures, and scores your CV against the job, and can generate a cover letter. Your CV content is sent to third-party AI providers (NVIDIA, and Google as a backup) to produce these results.

---

## 3. AI Output Is Not Guaranteed Accurate
AI-generated content may contain errors or inaccurate claims about your experience. You are solely responsible for reviewing and correcting all AI output before using it to apply for a job. We make no warranty that any AI output is accurate or complete.

---

## 4. Authorized Use
You agree not to upload another person's personal data without their consent, submit malicious payloads, scrape or automate the service beyond normal individual use, or reverse-engineer the underlying software.

---

## 5. Intellectual Property
The software, templates, and interface belong to ${companyName}. You retain full ownership of the personal content you upload.

---

## 6. Service Availability
Provided "as is" and "as available," with no guaranteed uptime. The service depends on third-party AI providers that may themselves be rate-limited or unavailable at times.

---

## 7. Limitation of Liability
To the fullest extent permitted by law, ${companyName} is not liable for indirect, incidental, or consequential damages arising from inaccurate AI output, service interruption, or third-party AI provider outages.`;
    }

    // Default Privacy Policy Markdown
    return `# Privacy Policy for ${companyName}

**Effective Date:** ${effectiveDate}
**Website:** https://${domain}
**Contact Email:** ${contactEmail}

---

## 1. Introduction
${companyName}, accessible from https://${domain}, lets you upload a CV and a job description so AI can restructure your experience, match keywords, and generate a tailored CV, insights, and cover letter. No account or sign-up is required.

---

## 2. Data We Collect
- **CV content:** the raw text/file you upload, and the name, email, phone, work history, education, and skills extracted from it.
- **Job description text:** the job posting you paste in.
- **Generated outputs:** the AI-restructured CV, ATS score, insights, and any cover letter.
- **Technical data:** your IP address, read transiently in server memory for rate limiting only — not stored in our database.
- **Cookie consent choices:** stored in browser local storage, plus a short-lived in-memory audit log server-side.

---

## 3. How Your CV Is Processed — Third-Party AI Providers
To parse, analyze, restructure, and score your CV, its content (including your name and contact details) is sent to:
- **NVIDIA** (NVIDIA NIM inference API) — primary AI provider.
- **Google** (Gemini API via Google AI Studio) — backup only, used if NVIDIA is unavailable.

These providers process your data solely to generate the response returned to you and do not use API-submitted content to train their models, per their own published API terms. We do not send your data to any advertising or marketing company.

---

## 4. How Long We Keep Your Data
Your session (CV text, parsed data, job description, tailored output) is automatically and permanently deleted after 30 days by a scheduled daily job. There is no user account tying your data beyond that window.

---

## 5. Analytics
We use Vercel Analytics for aggregate, anonymous page-view and performance metrics. It is cookie-less, does not identify you, and does not track you across other sites. We do not use Google Analytics or any advertising pixel.

---

## 6. Your Rights
**EU/UK residents (GDPR):** request access to, correction of, or deletion of your data. Since sessions auto-delete after 30 days and no account exists, email us with your session ID or approximate usage time to request earlier deletion.

**California residents (CCPA/CPRA):** we do not sell or share your personal information for money or other consideration, and do not use it for cross-context behavioral advertising.

---

## 7. Contact Us
For privacy questions or deletion requests, contact us at ${contactEmail}.`;
  };

  const getRawHTML = (tab: string) => {
    const md = getRawMarkdown(tab);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${companyName} - Legal Policy</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 24px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <pre>${md}</pre>
</body>
</html>`;
  };

  const handleCopy = () => {
    const text = viewMode === "html" ? getRawHTML(activePolicyTab) : getRawMarkdown(activePolicyTab);
    navigator.clipboard.writeText(text);
    setCopiedFormat(viewMode);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownload = (format: "md" | "html") => {
    const text = format === "html" ? getRawHTML(activePolicyTab) : getRawMarkdown(activePolicyTab);
    const mime = format === "html" ? "text/html" : "text/markdown";
    const filename = `${companyName.toLowerCase().replace(/\s+/g, "-")}-${activePolicyTab}-policy.${format}`;

    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isPolicyGeneratorOpen} onOpenChange={setIsPolicyGeneratorOpen}>
      <DialogContent className="sm:max-w-4xl max-w-[calc(100%-2rem)] w-full max-h-[92vh] overflow-y-auto overflow-x-hidden p-6 bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Official Legal Compliance Suite</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="h-7 text-[11px] gap-1.5 border-border/60"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {showConfig ? "Hide Generator Details" : "Edit Company Details"}
            </Button>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Legal Policy & Documentation
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Official, GDPR & CCPA compliant policies for {companyName}.
          </DialogDescription>
        </DialogHeader>

        {/* Collapsible Company Config Form */}
        {showConfig && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-accent/20 border border-border/60 my-1 animate-in fade-in-50 duration-200">
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Building className="h-3 w-3 text-primary" /> Company / App
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-8 text-xs bg-background border-border/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Globe className="h-3 w-3 text-primary" /> Domain
              </Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="h-8 text-xs bg-background border-border/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Mail className="h-3 w-3 text-primary" /> Contact Email
              </Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-8 text-xs bg-background border-border/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" /> Effective Date
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="h-8 text-xs bg-background border-border/60"
              />
            </div>
          </div>
        )}

        {/* Policy Document Tabs */}
        <Tabs value={activePolicyTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-border/40 pb-3">
            <TabsList className="bg-muted/60 p-1 rounded-xl shrink-0">
              <TabsTrigger value="privacy" className="gap-1.5 text-xs font-medium rounded-lg">
                <FileText className="h-3.5 w-3.5" />
                Privacy Policy
              </TabsTrigger>
              <TabsTrigger value="cookies" className="gap-1.5 text-xs font-medium rounded-lg">
                <Cookie className="h-3.5 w-3.5" />
                Cookie Policy
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-1.5 text-xs font-medium rounded-lg">
                <Lock className="h-3.5 w-3.5" />
                Terms of Service
              </TabsTrigger>
            </TabsList>

            {/* View Mode & Export Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  variant={viewMode === "formatted" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("formatted")}
                  className="h-7 px-2.5 text-[11px] gap-1"
                >
                  <Eye className="h-3 w-3" /> Preview Document
                </Button>
                <Button
                  variant={viewMode === "markdown" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("markdown")}
                  className="h-7 px-2.5 text-[11px] font-mono gap-1"
                >
                  <Code className="h-3 w-3" /> MD
                </Button>
                <Button
                  variant={viewMode === "html" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("html")}
                  className="h-7 px-2.5 text-[11px] font-mono gap-1"
                >
                  <Code className="h-3 w-3" /> HTML
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs gap-1.5"
              >
                {copiedFormat ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedFormat ? "Copied" : "Copy"}
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => handleDownload(viewMode === "html" ? "html" : "md")}
                className="h-8 text-xs gap-1.5 font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                Export .{viewMode === "html" ? "html" : "md"}
              </Button>
            </div>
          </div>

          {/* Formatted Policy Document Render View */}
          <TabsContent value={activePolicyTab} className="mt-0">
            {viewMode === "formatted" ? (
              <div className="border border-border/60 rounded-xl p-6 bg-background space-y-6 text-sm text-foreground leading-relaxed max-h-[55vh] overflow-y-auto shadow-inner">
                {activePolicyTab === "privacy" && (
                  <>
                    <div className="border-b border-border/60 pb-4 space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Privacy Policy for {companyName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span><strong>Effective Date:</strong> {effectiveDate}</span>
                        <span>•</span>
                        <span><strong>Website:</strong> <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{domain}</a></span>
                        <span>•</span>
                        <span><strong>Contact:</strong> {contactEmail}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">1. Introduction</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        <strong>{companyName}</strong> lets you upload a CV and a job description so AI can restructure your experience, match keywords, and generate a tailored CV, insights, and cover letter. No account or sign-up is required.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. Data We Collect</h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
                        <li><strong>CV content:</strong> the raw text/file you upload, plus name, email, phone, work history, education, and skills extracted from it.</li>
                        <li><strong>Job description text</strong> you paste in for tailoring.</li>
                        <li><strong>Generated outputs:</strong> the AI-restructured CV, ATS score, insights, and any cover letter.</li>
                        <li><strong>Technical data:</strong> your IP address, read transiently in server memory for rate limiting only — not stored in our database.</li>
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. Third-Party AI Providers</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        To parse, restructure, and score your CV, its content (including your name and contact details) is sent to <strong>NVIDIA</strong> (NVIDIA NIM API, primary) and, only as a backup if NVIDIA is unavailable, <strong>Google</strong> (Gemini API). These providers process your data solely to generate the response returned to you and do not use API-submitted content to train their models. We do not send your data to any advertising or marketing company.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">4. Data Retention</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Your session (CV text, parsed data, job description, tailored output) is automatically and permanently deleted after 30 days by a scheduled daily job. There is no account tying your data beyond that window.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">5. Analytics</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        We use Vercel Analytics for aggregate, anonymous page-view and performance metrics. It is cookie-less and does not identify you. We do not use Google Analytics or any advertising pixel.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">6. Your Rights</h3>
                      <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-2 text-xs text-muted-foreground">
                        <h4 className="font-semibold text-foreground text-xs">EU / UK residents (GDPR)</h4>
                        <p>Request access to, correction of, or deletion of your data. Since sessions auto-delete after 30 days and no account exists, email us with your session ID or approximate usage time to request earlier deletion.</p>
                        <h4 className="font-semibold text-foreground text-xs pt-2">California residents (CCPA/CPRA)</h4>
                        <p>We do not sell or share your personal information for money or other consideration, and do not use it for cross-context behavioral advertising.</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <h3 className="text-base font-semibold text-foreground">7. Contact Us</h3>
                      <p className="text-xs text-muted-foreground">
                        For privacy questions or deletion requests, reach out at <a href={`mailto:${contactEmail}`} className="text-primary font-mono font-medium hover:underline">{contactEmail}</a>.
                      </p>
                    </div>
                  </>
                )}

                {activePolicyTab === "cookies" && (
                  <>
                    <div className="border-b border-border/60 pb-4 space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Cookie Policy for {companyName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span><strong>Effective Date:</strong> {effectiveDate}</span>
                        <span>•</span>
                        <span><strong>Website:</strong> {domain}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">1. Cookies vs. Local Storage</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        This site sets no server-side authentication or tracking cookies. Your cookie preference choice is saved in your browser&apos;s local storage, not a cookie, so we remember it on your next visit.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. What We Actually Use</h3>
                      <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40 text-xs">
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Strictly Necessary</span>
                            <span className="text-muted-foreground">Your cookie preference choice (local storage) — no login exists, so no session/auth cookie is set</span>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Required</Badge>
                        </div>
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Functional</span>
                            <span className="text-muted-foreground">Not currently used — reserved for a future theme/language preference</span>
                          </div>
                          <Badge variant="outline">Optional</Badge>
                        </div>
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Analytics</span>
                            <span className="text-muted-foreground">Vercel Analytics — cookie-less, aggregate metrics only</span>
                          </div>
                          <Badge variant="outline">Always on</Badge>
                        </div>
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Marketing / Advertising</span>
                            <span className="text-muted-foreground">Not used — no Google Analytics, ad pixel, or cross-site tracker exists on this site</span>
                          </div>
                          <Badge variant="outline">Not used</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. Managing Your Preferences</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Change your choice anytime via the Cookie Settings button, or clear your browser&apos;s local storage to reset it.
                      </p>
                    </div>
                  </>
                )}

                {activePolicyTab === "terms" && (
                  <>
                    <div className="border-b border-border/60 pb-4 space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Terms of Service for {companyName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span><strong>Effective Date:</strong> {effectiveDate}</span>
                        <span>•</span>
                        <span><strong>Website:</strong> {domain}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">1. Agreement to Terms</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        By using {domain} you agree to these Terms. No account or payment is required.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. What This Service Does</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        You upload a CV and a job description; AI parses, restructures, and scores your CV against the job, and can generate a cover letter. Your CV content is sent to third-party AI providers (NVIDIA, and Google as a backup) to produce these results.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. AI Output Is Not Guaranteed Accurate</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        AI-generated content may contain errors or inaccurate claims about your experience. You are solely responsible for reviewing and correcting all output before using it to apply for a job. We make no warranty that any AI output is accurate or complete.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">4. Authorized Use</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        You agree not to upload another person&apos;s personal data without their consent, submit malicious payloads, scrape or automate the service beyond normal individual use, or reverse-engineer the underlying software.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">5. Intellectual Property</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        The software, templates, and interface belong to {companyName}. You retain full ownership of the personal content you upload.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">6. Limitation of Liability</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Provided &quot;as is&quot; with no guaranteed uptime. To the fullest extent permitted by law, {companyName} is not liable for indirect or consequential damages arising from inaccurate AI output, service interruption, or third-party AI provider outages.
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="border border-border/60 rounded-xl p-5 bg-background font-mono text-xs overflow-y-auto max-h-[50vh] leading-relaxed whitespace-pre-wrap text-foreground select-text">
                {viewMode === "html" ? getRawHTML(activePolicyTab) : getRawMarkdown(activePolicyTab)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
