"use client";

import React, { useState, useEffect } from "react";
import { useCookieConsent, TRANSLATIONS, ConsentCategories } from "@/lib/cookie-consent-context";
import { scanActiveTrackers, DetectedTracker } from "@/lib/script-auto-blocker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Cookie, Search, Download, Check, Lock, History, RefreshCw } from "lucide-react";

export const CookiePreferencesModal: React.FC = () => {
  const {
    consent,
    isPreferencesOpen,
    setIsPreferencesOpen,
    language,
    updateConsent,
    acceptAll,
    rejectNonEssential,
    consentHistory,
    exportConsentLogs,
    resetConsent,
  } = useCookieConsent();

  const [tempConsent, setTempConsent] = useState<ConsentCategories>(consent);
  const [activeTrackers, setActiveTrackers] = useState<DetectedTracker[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    setTempConsent(consent);
  }, [consent]);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const results = scanActiveTrackers();
      setActiveTrackers(results);
      setIsScanning(false);
    }, 300);
  };

  useEffect(() => {
    if (isPreferencesOpen) {
      handleScan();
    }
  }, [isPreferencesOpen]);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const categoryToggles: {
    key: keyof ConsentCategories;
    label: string;
    description: string;
    required?: boolean;
  }[] = [
    {
      key: "necessary",
      label: t.necessary,
      description: t.necessaryDesc,
      required: true,
    },
    {
      key: "functional",
      label: t.functional,
      description: t.functionalDesc,
    },
    {
      key: "analytics",
      label: t.analytics,
      description: t.analyticsDesc,
    },
    {
      key: "marketing",
      label: t.marketing,
      description: t.marketingDesc,
    },
  ];

  return (
    <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
      {/* sm:max-w-3xl (not just max-w-3xl) is required here: DialogContent's
          base class already sets sm:max-w-lg, and an unprefixed max-w-3xl
          loses to that at any real viewport width, silently capping the
          dialog at 512px and forcing the footer buttons into horizontal
          overflow. */}
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 bg-background text-foreground border-border/80 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" />
            <span>Privacy & Cookie Preferences</span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {t.customize}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Manage granular consent settings, audit active website trackers, and export compliance proof.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="categories" className="w-full mt-2">
          <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="categories" className="gap-1.5 text-xs font-medium rounded-lg">
              <Cookie className="h-3.5 w-3.5" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-1.5 text-xs font-medium rounded-lg">
              <Search className="h-3.5 w-3.5" />
              Tracker Audit ({activeTrackers.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs font-medium rounded-lg">
              <History className="h-3.5 w-3.5" />
              Consent Logs ({consentHistory.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CATEGORY TOGGLES */}
          <TabsContent value="categories" className="space-y-3 py-3">
            {categoryToggles.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{item.label}</span>
                    {item.required ? (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                        <Lock className="h-2.5 w-2.5" /> Always Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          tempConsent[item.key]
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        {tempConsent[item.key] ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>

                <Switch
                  checked={item.required ? true : tempConsent[item.key]}
                  disabled={item.required}
                  onCheckedChange={(checked) =>
                    setTempConsent((prev) => ({ ...prev, [item.key]: checked }))
                  }
                  aria-label={`Toggle ${item.label}`}
                  className="mt-1 shrink-0"
                />
              </div>
            ))}
          </TabsContent>

          {/* TAB 2: LIVE TRACKER AUDIT */}
          <TabsContent value="scanner" className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-foreground">Real-Time Tracker Inspection</h4>
                <p className="text-xs text-muted-foreground">Scans active DOM scripts, storage keys, and document cookies.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScan}
                disabled={isScanning}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={`h-3 w-3 ${isScanning ? "animate-spin" : ""}`} />
                Rescan
              </Button>
            </div>

            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden bg-muted/10 max-h-64 overflow-y-auto">
              {activeTrackers.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">No external trackers detected.</p>
                  <p>All active resources are strictly necessary or blocked.</p>
                </div>
              ) : (
                activeTrackers.map((tracker, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-muted/30">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold truncate text-foreground">{tracker.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {tracker.type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate text-[11px]">{tracker.description}</p>
                    </div>
                    <Badge
                      className={`shrink-0 capitalize text-[10px] ${
                        tracker.category === "necessary"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          : tracker.category === "analytics"
                          ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                          : tracker.category === "marketing"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-gray-500/10 text-gray-600 border-gray-500/30"
                      }`}
                    >
                      {tracker.category}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 3: CONSENT AUDIT HISTORY LOGS */}
          <TabsContent value="history" className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-foreground">Compliance Trail</h4>
                <p className="text-xs text-muted-foreground">Download timestamped consent records.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportConsentLogs("json")}
                  className="gap-1.5 text-xs h-8"
                >
                  <Download className="h-3 w-3" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportConsentLogs("csv")}
                  className="gap-1.5 text-xs h-8"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </Button>
              </div>
            </div>

            <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/10 max-h-64 overflow-y-auto">
              {consentHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No consent history logged yet. Action taken will record an entry.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 font-semibold border-b border-border/40">
                    <tr>
                      <th className="p-2.5">Log ID</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Region</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {consentHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20">
                        <td className="p-2.5 font-mono font-medium">{log.id}</td>
                        <td className="p-2.5 text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-mono">{log.geoRegion}</td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                            {log.categories.analytics ? "A✓" : "A✗"} {log.categories.marketing ? "M✓" : "M✗"} {log.categories.functional ? "F✓" : "F✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetConsent}
            className="text-xs text-muted-foreground hover:text-destructive h-8"
          >
            Reset Consent State
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={rejectNonEssential}
              className="text-xs h-8"
            >
              {t.rejectAll}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={acceptAll}
              className="text-xs h-8"
            >
              {t.acceptAll}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => updateConsent(tempConsent)}
              className="text-xs font-semibold gap-1.5 h-8 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              {t.savePreferences}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
