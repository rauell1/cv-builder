"use client";

import React from "react";
import { useCookieConsent, SUPPORTED_LANGUAGES, TRANSLATIONS, LanguageCode, GeoRegion, BannerStyle } from "@/lib/cookie-consent-context";
import { ShieldCheck, Cookie, Globe, Settings, Check, X, FileText, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const CookieBanner: React.FC = () => {
  const {
    hasConsented,
    geoRegion,
    bannerStyle,
    language,
    setLanguage,
    setGeoRegion,
    setBannerStyle,
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
      className={`fixed z-[9990] transition-all duration-300 ${
        bannerStyle === "modal"
          ? "inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          : bannerStyle === "floating-pill"
          ? "bottom-5 right-5 max-w-md w-full p-2"
          : "bottom-0 inset-x-0 p-4 bg-background/95 border-t border-border/80 shadow-2xl backdrop-blur-xl"
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md p-5 sm:p-6 transition-all ${
          bannerStyle === "bottom-bar" ? "max-w-7xl mx-auto" : "w-full max-w-xl"
        }`}
      >
        {/* Decorative subtle gradient background pill */}
        <div className="absolute -right-16 -top-16 w-44 h-44 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Cookie className="h-5 w-5 animate-pulse" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                {t.title}
              </h2>
            </div>

            {/* Controls Header: Language, GeoRegion, Style */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              {/* Geotargeting Indicator */}
              <Badge
                variant="outline"
                className={`gap-1 cursor-pointer transition-colors ${
                  geoRegion === "EU"
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                }`}
                onClick={() => setGeoRegion(geoRegion === "EU" ? "US-CA" : geoRegion === "US-CA" ? "GLOBAL" : "EU")}
                title="Click to simulate Geotargeted Region (GDPR vs CCPA)"
              >
                <Globe className="h-3 w-3" />
                <span>{geoRegion === "EU" ? "EU GDPR (Opt-In)" : geoRegion === "US-CA" ? "US CCPA (Opt-Out)" : "Global Region"}</span>
              </Badge>

              {/* Language Picker */}
              <Select value={language} onValueChange={(val) => setLanguage(val as LanguageCode)}>
                <SelectTrigger className="h-8 text-xs border-border/60 bg-background/50 w-[125px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent className="max-h-60 z-[9999]">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code} className="text-xs">
                      {lang.nativeName} ({lang.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Banner Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.description}{" "}
            {geoRegion === "US-CA" && (
              <span className="text-amber-600 dark:text-amber-400 font-medium block mt-1">
                {t.doNotSell}
              </span>
            )}
          </p>

          {/* Compliance signals notice */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{t.tcfNotice}</span>
          </div>

          {/* Quick Legal Links */}
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground pt-1 border-t border-border/40">
            <button
              onClick={() => openPolicyGenerator("privacy")}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {t.privacyPolicy}
            </button>
            <span>•</span>
            <button
              onClick={() => openPolicyGenerator("cookies")}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <Cookie className="h-3 w-3" />
              {t.cookiePolicy}
            </button>
            <span>•</span>
            <button
              onClick={() => openPolicyGenerator("terms")}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <Lock className="h-3 w-3" />
              {t.terms}
            </button>
          </div>

          {/* Actions Button Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreferencesOpen(true)}
              className="gap-1.5 border-border/70 hover:bg-accent text-xs font-medium"
            >
              <Settings className="h-3.5 w-3.5" />
              {t.customize}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={rejectNonEssential}
              className="gap-1.5 text-xs font-medium"
            >
              <X className="h-3.5 w-3.5 text-destructive" />
              {t.rejectAll}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={acceptAll}
              className="gap-1.5 text-xs font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
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
