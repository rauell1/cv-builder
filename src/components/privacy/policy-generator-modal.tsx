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

  // Format generators for raw export
  const getRawMarkdown = (tab: string) => {
    if (tab === "cookies") {
      return `# Cookie Policy for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** https://${domain}  
**Contact Email:** ${contactEmail}

---

## 1. What Are Cookies?
Cookies are small text files placed on your device by websites you visit to store preferences, verify session tokens, and measure user traffic.

---

## 2. Cookie Classification Table
- **Strictly Necessary Cookies:** Essential for session management, security nonces, and consent choices. (Always Active)
- **Functional Cookies:** Remembers language selections, theme preferences, and form state.
- **Analytics Cookies:** Measures page load speeds, visitor traffic, and usage metrics via Google Analytics.
- **Marketing Cookies:** Delivers targeted campaign measurement and retargeting analytics.

---

## 3. Compliance Frameworks
Our cookie infrastructure complies with:
- **Google Consent Mode v2** (\`ad_storage\`, \`analytics_storage\`, \`ad_user_data\`)
- **IAB Transparency & Consent Framework (TCF v2.3)**

---

## 4. Managing Your Preferences
You can modify or revoke your consent choices at any time using our floating Cookie Settings button or through your browser settings.`;
    }

    if (tab === "terms") {
      return `# Terms of Service for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** https://${domain}  
**Contact Email:** ${contactEmail}

---

## 1. Acceptance of Terms
By accessing or using the services provided at https://${domain}, you agree to be bound by these Terms of Service and all applicable data privacy laws.

---

## 2. Authorized Use
Users are granted a non-exclusive, revocable license to upload CVs, convert documents, and generate ATS-formatted resumes. You agree not to upload malicious payloads, reverse-engineer proprietary algorithms, or perform automated data scraping.

---

## 3. Intellectual Property
All template designs, structural layouts, and software algorithms remain the intellectual property of ${companyName}. Users retain complete ownership of their original personal resume content.

---

## 4. Limitation of Liability
The services are provided "AS IS" without warranties of any kind. ${companyName} shall not be held liable for any indirect or consequential damages arising from service interruption or third-party AI provider outages.`;
    }

    // Default Privacy Policy Markdown
    return `# Privacy Policy for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** https://${domain}  
**Contact Email:** ${contactEmail}

---

## 1. Introduction
At ${companyName}, accessible from https://${domain}, your privacy is paramount. This Privacy Policy document outlines the types of information collected, stored, processed, and safeguarded in accordance with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA / CPRA).

---

## 2. Information We Collect
We collect data strictly required to deliver, secure, and improve our services:
- **Strictly Necessary Data:** IP address, session identifiers, security nonces, and cookie consent preferences.
- **User Input & Resume Data:** Resume documents, job descriptions, and structured text processed locally or via private, encrypted AI APIs.
- **Analytics & Telemetry:** Aggregated metrics regarding site speed and page interactions (only if explicit consent is granted).

---

## 3. How We Use Your Information
We process your personal data for the following legitimate purposes:
1. Providing AI-driven CV parsing, ATS scoring, and cover letter generation.
2. Maintaining system uptime, preventing abuse, and enforcing platform rate limits.
3. Fulfilling legal obligations under GDPR Article 6(1)(c) and CCPA § 1798.100.

---

## 4. Geotargeted Consent Rights
### A. European Union (GDPR)
Under EU GDPR, you possess the following rights:
- **Right to Access & Data Portability:** Request a copy of stored personal data.
- **Right to Erasure ("Right to be Forgotten"):** Delete all cached AI inputs or session tokens.
- **Right to Withdraw Consent:** Modify or revoke cookie consent choices anytime via our Privacy Control Center.

### B. California Residents (CCPA / CPRA)
- **Do Not Sell or Share My Personal Information:** We do NOT sell or monetarily trade your personal information.
- **Right to Limit Sensitive Data Processing:** Limit processing of sensitive identifiers.

---

## 5. Contact Us
For any inquiries regarding data protection or to exercise your privacy rights, please reach out to us at ${contactEmail}.`;
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
                        At <strong>{companyName}</strong>, your privacy is paramount. This Privacy Policy document outlines the types of information collected, stored, processed, and safeguarded in accordance with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA / CPRA).
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. Information We Collect</h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
                        <li><strong>Strictly Necessary Data:</strong> IP address, session identifiers, security nonces, and cookie consent preferences.</li>
                        <li><strong>User Input & Resume Data:</strong> Resume documents, job descriptions, and structured text processed locally or via private, encrypted AI APIs.</li>
                        <li><strong>Analytics & Telemetry:</strong> Aggregated metrics regarding site speed and page interactions (only if explicit consent is granted).</li>
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. How We Use Your Information</h3>
                      <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
                        <li>Providing AI-driven CV parsing, ATS scoring, and cover letter generation.</li>
                        <li>Maintaining system uptime, preventing abuse, and enforcing platform rate limits.</li>
                        <li>Fulfilling legal obligations under GDPR Article 6(1)(c) and CCPA § 1798.100.</li>
                      </ol>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">4. Geotargeted Consent Rights</h3>
                      <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-2 text-xs text-muted-foreground">
                        <h4 className="font-semibold text-foreground text-xs">European Union (GDPR)</h4>
                        <p>Under EU GDPR, you possess the right to access, rectify, port, or request erasure of stored personal data, and to modify consent choices anytime via our Privacy Control Center.</p>
                        <h4 className="font-semibold text-foreground text-xs pt-2">California Residents (CCPA / CPRA)</h4>
                        <p>We do NOT sell or monetarily trade your personal information. You have the right to limit processing of sensitive identifiers.</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <h3 className="text-base font-semibold text-foreground">5. Contact Us</h3>
                      <p className="text-xs text-muted-foreground">
                        For inquiries or data protection requests, reach out at <a href={`mailto:${contactEmail}`} className="text-primary font-mono font-medium hover:underline">{contactEmail}</a>.
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
                      <h3 className="text-base font-semibold text-foreground">1. What Are Cookies?</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Cookies are small text files placed on your device by websites you visit to store preferences, verify session tokens, and measure user traffic.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. Cookie Categories</h3>
                      <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40 text-xs">
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Strictly Necessary Cookies</span>
                            <span className="text-muted-foreground">Session management, CSRF tokens, consent flags</span>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Always Active</Badge>
                        </div>
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Functional Cookies</span>
                            <span className="text-muted-foreground">Language selection, theme, font preferences</span>
                          </div>
                          <Badge variant="outline">Optional</Badge>
                        </div>
                        <div className="p-3 bg-muted/20 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground block">Analytics Cookies</span>
                            <span className="text-muted-foreground">Google Analytics visitor traffic & performance</span>
                          </div>
                          <Badge variant="outline">Optional</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. Framework Compliance</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Our website complies with <strong>Google Consent Mode v2</strong> (<code className="font-mono text-xs">ad_storage</code>, <code className="font-mono text-xs">analytics_storage</code>) and <strong>IAB TCF v2.3</strong> standards.
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
                      <h3 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        By accessing or using the services provided at {domain}, you agree to be bound by these Terms of Service and all applicable data privacy laws.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">2. Permitted Use</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Users are granted a non-exclusive license to upload CVs, convert documents, and generate ATS-formatted resumes. You agree not to upload malicious payloads or perform automated data scraping.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground">3. Intellectual Property</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        All template designs and software algorithms remain the intellectual property of {companyName}. Users retain complete ownership of their original personal resume content.
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
