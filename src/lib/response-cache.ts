/**
 * response-cache.ts
 *
 * In-memory LRU cache for API responses, designed to eliminate redundant AI calls.
 *
 * Features:
 *  - Generic `ResponseCache<T>` class with strict TypeScript typing
 *  - LRU (Least Recently Used) eviction when capacity is reached
 *  - Per-entry TTL (time-to-live) with configurable defaults
 *  - Content-hash based keys via SHA-256
 *  - Cache-hit statistics tracking
 *  - Two preconfigured singletons for extraction and parsing results
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry stored inside the cache. */
interface CacheEntry<T> {
  /** The cached value. */
  value: T;
  /** Unix timestamp (ms) at which this entry was inserted. */
  createdAt: number;
  /** Time-to-live in milliseconds. */
  ttlMs: number;
}

/** Statistics returned by `ResponseCache.getStats()`. */
export interface CacheStats {
  /** Current number of entries in the cache. */
  size: number;
  /** Maximum number of entries the cache can hold. */
  maxSize: number;
  /** Cumulative number of cache hits. */
  hitCount: number;
  /** Cumulative number of cache misses. */
  missCount: number;
  /** Hit rate expressed as a number between 0 and 1. */
  hitRate: number;
  /** Total number of entries evicted due to capacity or TTL expiry. */
  evictedCount: number;
}

// ---------------------------------------------------------------------------
// Utility – content hashing
// ---------------------------------------------------------------------------

/**
 * Produce a deterministic SHA-256 hex digest for the given string content.
 *
 * @param content - The string to hash (e.g. raw file text, a prompt + params payload).
 * @returns Lowercase hex-encoded SHA-256 hash.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// ResponseCache class
// ---------------------------------------------------------------------------

/**
 * A generic, in-memory **LRU** (Least Recently Used) cache with per-entry TTL.
 *
 * @typeParam T - The type of values stored in the cache.
 *
 * @example
 * ```ts
 * const cache = new ResponseCache<MyType>(100, 300_000);
 * cache.set("key", myObj);
 * const val = cache.get("key"); // MyType | null
 * ```
 */
export class ResponseCache<T> {
  // ---- Internal storage ---------------------------------------------------
  /** Ordered map: most-recently used at the end. */
  private readonly store: Map<string, CacheEntry<T>>;

  // ---- Configuration ------------------------------------------------------
  /** Maximum number of entries before LRU eviction kicks in. */
  private readonly _maxSize: number;

  /** Default TTL applied when no explicit TTL is provided to `set()`. */
  private readonly defaultTtlMs: number;

  // ---- Statistics ---------------------------------------------------------
  private _hitCount = 0;
  private _missCount = 0;
  private _evictedCount = 0;

  // -------------------------------------------------------------------------

  /**
   * Create a new `ResponseCache`.
   *
   * @param maxSize   - Maximum number of entries (default `500`).
   * @param defaultTtlMs - Default TTL in milliseconds for new entries (default `300_000` = 5 minutes).
   */
  constructor(maxSize = 500, defaultTtlMs = 5 * 60 * 1000) {
    this._maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map<string, CacheEntry<T>>();
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Retrieve a cached value by key.
   *
   * If the entry exists but has expired it is silently removed and `null` is
   * returned (counts as a miss).
   *
   * @returns The cached value, or `null` if not found / expired.
   */
  get(key: string): T | null {
    const entry = this.store.get(key);

    // Miss
    if (entry === undefined) {
      this._missCount++;
      return null;
    }

    // Expired → evict
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this._evictedCount++;
      this._missCount++;
      return null;
    }

    // Hit → promote to most-recently used (delete + re-insert at end)
    this.store.delete(key);
    this.store.set(key, entry);
    this._hitCount++;

    return entry.value;
  }

  /**
   * Store a value in the cache.
   *
   * If the key already exists its TTL is refreshed and it is promoted to the
   * most-recently used position.
   *
   * @param key    - Cache key (typically a SHA-256 content hash).
   * @param value  - The value to cache.
   * @param ttlMs  - Optional per-entry TTL overriding the cache default.
   */
  set(key: string, value: T, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;

    // If the key already exists, delete it first so the Map iteration order
    // is correct when we re-insert at the end.
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // Evict LRU entries until we have room.
    while (this.store.size >= this._maxSize) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
      this._evictedCount++;
    }

    this.store.set(key, {
      value,
      createdAt: Date.now(),
      ttlMs: effectiveTtl,
    });
  }

  /**
   * Check whether a **non-expired** entry exists for the given key.
   *
   * Unlike `get()`, this does **not** promote the entry in LRU order.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (entry === undefined) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this._evictedCount++;
      return false;
    }
    return true;
  }

  /**
   * Remove all entries and reset statistics.
   */
  clear(): void {
    this.store.clear();
    this._hitCount = 0;
    this._missCount = 0;
    this._evictedCount = 0;
  }

  /**
   * Return a snapshot of cache statistics.
   */
  getStats(): CacheStats {
    const total = this._hitCount + this._missCount;
    return {
      size: this.store.size,
      maxSize: this._maxSize,
      hitCount: this._hitCount,
      missCount: this._missCount,
      hitRate: total > 0 ? this._hitCount / total : 0,
      evictedCount: this._evictedCount,
    };
  }

  /**
   * Prune all expired entries from the cache.
   *
   * Useful for periodic housekeeping if the cache is long-lived and many
   * entries expire without being accessed.
   *
   * @returns The number of entries removed.
   */
  prune(): number {
    let pruned = 0;
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        this._evictedCount++;
        pruned++;
      }
    }
    return pruned;
  }

  // ---- Internals ----------------------------------------------------------

  /** Determine whether an entry has outlived its TTL. */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }
}

// ---------------------------------------------------------------------------
// Preconfigured singletons
// ---------------------------------------------------------------------------

/**
 * Cache for **file extraction** results.
 *
 * - Capacity: 500 entries
 * - Default TTL: 5 minutes
 *
 * Use this to deduplicate expensive text-extraction calls (PDF parsing,
 * OCR, etc.) so the same file is never extracted twice within the TTL window.
 */
export const extractionCache = new ResponseCache<unknown>(
  /* maxSize    */ 2000,  // Scaled for 1000+ users
  /* defaultTtl */ 10 * 60 * 1000, // 10 minutes (longer TTL = more cache hits)
);

/**
 * Cache for **CV / resume parsing** results.
 *
 * - Capacity: 300 entries
 * - Default TTL: 10 minutes
 *
 * Use this to deduplicate AI-based CV parsing calls so identical or
 * previously-seen CV content is not re-processed unnecessarily.
 */
export const parsingCache = new ResponseCache<unknown>(
  /* maxSize    */ 1000,  // Scaled for 1000+ users
  /* defaultTtl */ 30 * 60 * 1000, // 30 minutes (parsing is deterministic — longer cache)
);
