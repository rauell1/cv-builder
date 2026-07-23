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
import { FileText, Cookie, Lock, Download, Copy, Check, Sparkles, Code, Eye } from "lucide-react";

export const PolicyGeneratorModal: React.FC = () => {
  const { isPolicyGeneratorOpen, setIsPolicyGeneratorOpen, activePolicyTab } = useCookieConsent();

  const [companyName, setCompanyName] = useState<string>("Roy Okola Otieno Solutions");
  const [domain, setDomain] = useState<string>("cv-builder.rauell.systems");
  const [contactEmail, setContactEmail] = useState<string>("privacy@rauell.systems");
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [viewFormat, setViewFormat] = useState<"markdown" | "html">("markdown");

  // Document Generators
  const generatePrivacyPolicyMarkdown = () => `# Privacy Policy for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** [https://${domain}](https://${domain})  
**Contact Email:** ${contactEmail}

---

## 1. Introduction
At **${companyName}**, accessible from \`https://${domain}\`, your privacy is paramount. This Privacy Policy document outlines the types of information collected, stored, processed, and safeguarded in accordance with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA / CPRA).

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
For any inquiries regarding data protection or to exercise your privacy rights, please reach out to us at:  
📧 **Email:** [${contactEmail}](mailto:${contactEmail})`;

  const generateCookiePolicyMarkdown = () => `# Cookie Policy for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** [https://${domain}](https://${domain})

---

## 1. What Are Cookies?
Cookies are small text files placed on your device by websites you visit to store preferences, verify session tokens, and measure user traffic.

---

## 2. Cookie Classification Table

| Category | Purpose | Duration | Essential? |
| :--- | :--- | :--- | :--- |
| **Strictly Necessary** | Session management, CSRF tokens, consent flags | Session / 1 Year | **Yes** |
| **Functional** | Remembers language, theme, font preferences | 6 Months | No |
| **Analytics** | Measures page load speeds & aggregated traffic metrics | 14 Months | No |
| **Marketing** | Delivers targeted campaign analytics | 90 Days | No |

---

## 3. Integrated Frameworks
Our cookie management system complies with:
- **Google Consent Mode v2** (\`ad_storage\`, \`analytics_storage\`, \`ad_user_data\`)
- **IAB Transparency & Consent Framework (TCF v2.3)**

---

## 4. Managing Your Preferences
You can modify or revoke your consent anytime using our interactive **Cookie Preferences Banner** or by clearing cookies directly in your browser settings.`;

  const generateTermsMarkdown = () => `# Terms of Service for ${companyName}

**Effective Date:** ${effectiveDate}  
**Website:** [https://${domain}](https://${domain})

---

## 1. Acceptance of Terms
By accessing or using the services provided at \`https://${domain}\`, you agree to be bound by these Terms of Service and all applicable data privacy laws.

---

## 2. Permitted Use & AI Processing
- Users are granted a non-exclusive license to upload CVs, convert documents, and generate ATS-formatted resumes.
- You agree not to upload malicious payloads, reverse-engineer proprietary parsing algorithms, or perform automated data scraping.

---

## 3. Intellectual Property
All template designs, structural layouts, and software algorithms remain the intellectual property of **${companyName}**. Users retain complete ownership of their original personal resume content.

---

## 4. Limitation of Liability
The services are provided **"AS IS"** without warranties of any kind. **${companyName}** shall not be held liable for any indirect or consequential damages arising from service interruption or third-party AI provider outages.`;

  const getActiveContent = (tab: string) => {
    switch (tab) {
      case "cookies":
        return generateCookiePolicyMarkdown();
      case "terms":
        return generateTermsMarkdown();
      default:
        return generatePrivacyPolicyMarkdown();
    }
  };

  const currentMarkdown = getActiveContent(activePolicyTab);

  const convertMarkdownToHTML = (md: string) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} - Legal Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1, h2, h3 { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; }
    code { background: #f1f5f9; padding: 2px 6px; borderRadius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div>${md.replace(/^# (.*$)/gim, '<h1>$1</h1>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/\n\n/g, '<br><br>')}</div>
</body>
</html>`;
  };

  const handleCopy = (format: "markdown" | "html") => {
    const text = format === "markdown" ? currentMarkdown : convertMarkdownToHTML(currentMarkdown);
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownload = (format: "markdown" | "html") => {
    const text = format === "markdown" ? currentMarkdown : convertMarkdownToHTML(currentMarkdown);
    const mime = format === "markdown" ? "text/markdown" : "text/html";
    const ext = format === "markdown" ? "md" : "html";
    const filename = `${companyName.toLowerCase().replace(/\s+/g, "-")}-${activePolicyTab}-policy.${ext}`;

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
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto z-[9999] p-6 bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="h-4 w-4" />
            <span>Automated Compliance Document Generator</span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Legal Policy & Terms Generator
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Generate and export fully compliant Privacy Policies, Cookie Policies, and Terms of Service tailored to your organization.
          </DialogDescription>
        </DialogHeader>

        {/* Input Configuration Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-muted/40 border border-border/60 my-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Company / App Name</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Domain Name</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Privacy Contact Email</Label>
            <Input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Effective Date</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Document Display Tabs */}
        <Tabs value={activePolicyTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <TabsList className="bg-muted/60 p-1 rounded-xl">
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

            {/* View & Export Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  variant={viewFormat === "markdown" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewFormat("markdown")}
                  className="h-7 px-2.5 text-[11px] font-mono gap-1"
                >
                  <Code className="h-3 w-3" /> MD
                </Button>
                <Button
                  variant={viewFormat === "html" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewFormat("html")}
                  className="h-7 px-2.5 text-[11px] font-mono gap-1"
                >
                  <Eye className="h-3 w-3" /> HTML
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(viewFormat)}
                className="h-8 text-xs gap-1.5"
              >
                {copiedFormat === viewFormat ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedFormat === viewFormat ? "Copied" : "Copy"}
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => handleDownload(viewFormat)}
                className="h-8 text-xs gap-1.5 font-medium shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Export .{viewFormat === "markdown" ? "md" : "html"}
              </Button>
            </div>
          </div>

          <TabsContent value={activePolicyTab} className="mt-0">
            <div className="border border-border/60 rounded-xl p-5 bg-background font-mono text-xs overflow-y-auto max-h-[50vh] leading-relaxed whitespace-pre-wrap text-foreground">
              {viewFormat === "markdown" ? currentMarkdown : convertMarkdownToHTML(currentMarkdown)}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
