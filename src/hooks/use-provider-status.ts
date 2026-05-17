/**
 * useProviderStatus
 *
 * Fetches AI provider credential status from the server-side /api/health
 * endpoint. This is the ONLY safe way to check whether API keys are configured
 * from a client component, because process.env server keys (NVIDIA_API_KEY,
 * ZHIPU_API_KEY, etc.) are always undefined in the browser.
 *
 * Result is cached in-memory for 60 seconds to avoid hammering the endpoint.
 */

'use client';

import { useState, useEffect } from 'react';

export type ProviderStatusState = 'loading' | 'configured' | 'unconfigured';

interface ProviderStatusCache {
  value: ProviderStatusState;
  fetchedAt: number;
}

// Module-level cache – shared across all hook instances in the same page lifetime
let _cache: ProviderStatusCache | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

// In-flight promise – deduplicate concurrent fetches
let _inflightPromise: Promise<ProviderStatusState> | null = null;

async function fetchProviderStatus(): Promise<ProviderStatusState> {
  // Return cached value if still fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.value;
  }

  // Deduplicate concurrent fetches
  if (_inflightPromise) return _inflightPromise;

  _inflightPromise = (async (): Promise<ProviderStatusState> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        // Avoid cache so we always get the latest Vercel env state
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (!res.ok) {
        // If health endpoint itself fails, assume configured so we don't
        // block users with a false-positive "no API keys" warning.
        _cache = { value: 'configured', fetchedAt: Date.now() };
        return 'configured';
      }

      const json = await res.json();
      // The health route already runs hasAnyProviderCredentials() server-side
      const anyConfigured: boolean =
        json?.providers?.anyConfigured === true ||
        json?.providers?.status != null &&
          Object.values(json.providers.status as Record<string, boolean>).some(Boolean);

      const result: ProviderStatusState = anyConfigured ? 'configured' : 'unconfigured';
      _cache = { value: result, fetchedAt: Date.now() };
      return result;
    } catch {
      // Network error or abort – assume configured to avoid blocking the user
      _cache = { value: 'configured', fetchedAt: Date.now() };
      return 'configured';
    } finally {
      _inflightPromise = null;
    }
  })();

  return _inflightPromise;
}

/** Force-invalidate the in-memory cache (e.g., after the user saves a new key). */
export function invalidateProviderStatusCache(): void {
  _cache = null;
}

export function useProviderStatus(): ProviderStatusState {
  const [status, setStatus] = useState<ProviderStatusState>('loading');

  useEffect(() => {
    let cancelled = false;

    fetchProviderStatus().then((result) => {
      if (!cancelled) setStatus(result);
    });

    return () => { cancelled = true; };
  }, []);

  return status;
}
