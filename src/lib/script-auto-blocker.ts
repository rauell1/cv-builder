"use client";

import { ConsentCategories } from "./cookie-consent-context";

export interface DetectedTracker {
  name: string;
  category: keyof ConsentCategories;
  type: "cookie" | "local_storage" | "script_tag" | "beacon";
  domain: string;
  expires?: string;
  description: string;
}

/**
 * Live Cookie & Tracker Scanner
 * Inspects active DOM scripts, storage mechanisms, and document.cookie
 */
export function scanActiveTrackers(): DetectedTracker[] {
  if (typeof window === "undefined") return [];

  const trackers: DetectedTracker[] = [];

  // 1. Scan Cookies
  try {
    const rawCookies = document.cookie ? document.cookie.split("; ") : [];
    rawCookies.forEach((c) => {
      const [name] = c.split("=");
      const trimName = name.trim();
      if (!trimName) return;

      let category: keyof ConsentCategories = "functional";
      let desc = "Stores application session and user preferences.";

      if (trimName.startsWith("_ga") || trimName.startsWith("_gid") || trimName.includes("analytics")) {
        category = "analytics";
        desc = "Google Analytics visitor tracking cookie.";
      } else if (trimName.startsWith("_fbp") || trimName.startsWith("_gcl") || trimName.includes("ad")) {
        category = "marketing";
        desc = "Advertising conversion and re-targeting tracker.";
      } else if (trimName.includes("sess") || trimName.includes("token") || trimName.includes("csrf") || trimName.includes("consent")) {
        category = "necessary";
        desc = "Strictly necessary authentication or consent token.";
      }

      trackers.push({
        name: trimName,
        category,
        type: "cookie",
        domain: window.location.hostname,
        description: desc,
      });
    });
  } catch (e) {
    console.error("Error scanning cookies:", e);
  }

  // 2. Scan LocalStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      let category: keyof ConsentCategories = "functional";
      let desc = "Stored local user preferences.";

      if (key.includes("consent") || key.includes("cv_builder")) {
        category = "necessary";
        desc = "Strictly necessary app configuration or consent storage.";
      } else if (key.includes("analytics") || key.includes("ga_")) {
        category = "analytics";
        desc = "Local analytics storage metrics.";
      }

      trackers.push({
        name: key,
        category,
        type: "local_storage",
        domain: window.location.hostname,
        description: desc,
      });
    }
  } catch (_) {}

  // 3. Scan Loaded Script Elements
  try {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    scripts.forEach((script) => {
      const src = script.getAttribute("src") || "";
      if (!src) return;

      let category: keyof ConsentCategories = "functional";
      let name = src.split("/").pop() || src;
      let desc = "External JavaScript script tag.";

      if (src.includes("googletagmanager") || src.includes("google-analytics") || src.includes("vercel/analytics")) {
        category = "analytics";
        name = "Google Analytics / Vercel Analytics";
        desc = "Traffic measurement and telemetry script.";
      } else if (src.includes("doubleclick") || src.includes("facebook") || src.includes("connect.facebook")) {
        category = "marketing";
        name = "Meta / Google Marketing Pixel";
        desc = "Advertising conversion tracking.";
      } else if (src.includes("font") || src.includes("cdn")) {
        category = "necessary";
        desc = "Static CDN or font resource script.";
      }

      trackers.push({
        name,
        category,
        type: "script_tag",
        domain: new URL(src, window.location.href).hostname,
        description: desc,
      });
    });
  } catch (_) {}

  return trackers;
}

/**
 * Script Interceptor & Auto-blocker
 * Prevents creation of script tags marked with data-category if consent is absent
 */
export function initScriptAutoBlocker(consent: ConsentCategories) {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

  const handleAddedScript = (script: HTMLScriptElement) => {
    const categoryAttr = script.getAttribute("data-category") as keyof ConsentCategories | null;
    if (!categoryAttr) return;

    if (!consent[categoryAttr]) {
      // Prevent execution by changing type to text/plain
      script.type = "text/plain";
      script.setAttribute("data-blocked-by-consent", "true");
      console.warn(`[Auto-Blocker] Blocked script execution for category '${categoryAttr}':`, script.src || script.innerHTML.slice(0, 30));
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "SCRIPT") {
          handleAddedScript(node as HTMLScriptElement);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
