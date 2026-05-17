/**
 * Response Cache — in-memory LRU caches for AI responses and file extractions.
 *
 * Longer TTLs reduce re-processing identical CVs:
 *   - parsingCache : 1 hour  (parsed CV JSON from raw text)
 *   - extractionCache: 30 min (full extract-file response for a given file hash)
 *   - insightsCache : 30 min (score-cv / generate-insights)
 *   - coverLetterCache: 15 min (generate-cover-letter)
 */

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

class LRUCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs   = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // LRU: re-insert at end
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.maxSize) {
      // Evict oldest
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void { this.cache.delete(key); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }

  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.cache.size, maxSize: this.maxSize, ttlMs: this.ttlMs };
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

/** Parsed CV JSON from raw text — cache for 1 hour (same text → same parse) */
export const parsingCache    = new LRUCache(200, 60 * 60_000);

/** Full extract-file API response keyed by file content hash — 30 min */
export const extractionCache = new LRUCache(100, 30 * 60_000);

/** CV score / insights responses — 30 min */
export const insightsCache   = new LRUCache(200, 30 * 60_000);

/** Cover letter responses — 15 min */
export const coverLetterCache = new LRUCache(100, 15 * 60_000);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Deterministic short hash for a string (used as cache key). */
export function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
