"use client";

import React from "react";
import { useCookieConsent } from "@/lib/cookie-consent-context";
import { ShieldCheck, Cookie, FileText, Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PrivacyFooterTrigger: React.FC = () => {
  const { setIsPreferencesOpen, openPolicyGenerator, hasConsented, consent } = useCookieConsent();

  return (
    <>
      {/* Floating corner privacy badge (Always accessible to re-open preferences) */}
      <div className="fixed bottom-4 left-4 z-[9900]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPreferencesOpen(true)}
          className="rounded-full shadow-lg border-border/80 bg-card/90 backdrop-blur-md hover:bg-accent text-xs gap-1.5 px-3 py-1.5 transition-all hover:scale-105"
          title="Manage Cookie & Privacy Settings"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Cookie Settings</span>
          {hasConsented && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </Button>
      </div>
    </>
  );
};
