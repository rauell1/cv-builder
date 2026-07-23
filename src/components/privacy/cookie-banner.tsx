"use client";

import React from "react";
import { useCookieConsent, SUPPORTED_LANGUAGES, TRANSLATIONS, LanguageCode } from "@/lib/cookie-consent-context";
import { ShieldCheck, Cookie, Globe, Settings, Check, X, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const CookieBanner: React.FC = () => {
  const {
    hasConsented,
    geoRegion,
    language,
    setLanguage,
    setGeoRegion,
    acceptAll,
    rejectNonEssential,
    setIsPreferencesOpen,
    openPolicyGenerator,
  } = useCookieConsent();

  if (hasConsented) return null;

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <div
      aria-label="Cookie Consent Banner"
      tabIndex={-1}
      className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="max-w-6xl mx-auto pointer-events-auto relative overflow-hidden rounded-2xl border border-primary/20 bg-background/95 dark:bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl p-4 sm:p-5">
        {/* Top Gradient Border Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-indigo-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Info Column */}
          <div className="space-y-2 max-w-3xl">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm sm:text-base">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Cookie className="h-4 w-4" />
                </div>
                <span>{t.title}</span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                {/* Geotargeting Badge */}
                <Badge
                  variant="outline"
                  className={`text-[11px] gap-1 cursor-pointer transition-all hover:scale-105 ${
                    geoRegion === "EU"
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                  }`}
                  onClick={() => setGeoRegion(geoRegion === "EU" ? "US-CA" : geoRegion === "US-CA" ? "GLOBAL" : "EU")}
                  title="Click to toggle Geotargeted Mode (EU GDPR vs US CCPA)"
                >
                  <Globe className="h-3 w-3" />
                  <span>{geoRegion === "EU" ? "EU GDPR (Opt-In)" : geoRegion === "US-CA" ? "US CCPA (Opt-Out)" : "Global"}</span>
                </Badge>

                {/* Language Picker */}
                <Select value={language} onValueChange={(val) => setLanguage(val as LanguageCode)}>
                  <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background/80 w-[115px]">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 z-[9999]">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="text-xs">
                        {lang.nativeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description Text */}
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t.description}{" "}
              {geoRegion === "US-CA" && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold block sm:inline mt-0.5 sm:mt-0">
                  • {t.doNotSell}
                </span>
              )}
            </p>

            {/* Sub-links & Compliance Badges */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.tcfNotice}
              </span>
              <span>•</span>
              <button
                onClick={() => openPolicyGenerator("privacy")}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <FileText className="h-3 w-3" />
                {t.privacyPolicy}
              </button>
              <span>•</span>
              <button
                onClick={() => openPolicyGenerator("cookies")}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <Cookie className="h-3 w-3" />
                {t.cookiePolicy}
              </button>
              <span>•</span>
              <button
                onClick={() => openPolicyGenerator("terms")}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <Lock className="h-3 w-3" />
                {t.terms}
              </button>
            </div>
          </div>

          {/* Action Buttons Column */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreferencesOpen(true)}
              className="flex-1 sm:flex-initial text-xs h-9 px-3.5 gap-1.5 border-border/80 hover:bg-accent font-medium"
            >
              <Settings className="h-3.5 w-3.5" />
              {t.customize}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={rejectNonEssential}
              className="flex-1 sm:flex-initial text-xs h-9 px-3.5 gap-1.5 font-medium"
            >
              <X className="h-3.5 w-3.5 text-destructive" />
              {t.rejectAll}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={acceptAll}
              className="w-full sm:w-auto text-xs h-9 px-4 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all hover:scale-[1.02]"
            >
              <Check className="h-3.5 w-3.5" />
              {t.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
