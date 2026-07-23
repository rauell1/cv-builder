"use client";

import React from "react";
import { useCookieConsent } from "@/lib/cookie-consent-context";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PrivacyFooterTrigger: React.FC = () => {
  const { setIsPreferencesOpen, hasConsented } = useCookieConsent();

  // Only display the floating trigger button once the main banner has been handled to avoid overlap!
  if (!hasConsented) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsPreferencesOpen(true)}
        className="rounded-full shadow-lg border-border/80 bg-background/90 backdrop-blur-md hover:bg-accent text-xs gap-2 px-3 py-1.5 transition-all hover:scale-105 group"
        title="Manage Cookie & Privacy Settings"
      >
        <ShieldCheck className="h-4 w-4 text-primary group-hover:rotate-12 transition-transform" />
        <span className="font-medium text-foreground">Cookie Settings</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </Button>
    </div>
  );
};
