// =============================================================================
// Request Queue — Lightweight in-memory concurrency limiter
// =============================================================================

/**
 * Priority levels for queued requests.
 * Higher-priority entries are dequeued first when a slot opens.
 */
export type Priority = 'high' | 'normal' | 'low';

/**
 * Numeric weight for each priority (lower = higher priority).
 */
const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Real-time metrics snapshot returned by `RequestQueue.getMetrics()`.
 */
export interface QueueMetrics {
  /** Number of requests currently waiting in the queue. */
  readonly queueLength: number;
  /** Number of requests currently executing. */
  readonly activeCount: number;
  /** Total number of requests that completed successfully. */
  readonly completedCount: number;
  /** Total number of requests that rejected (user function threw). */
  readonly failedCount: number;
  /** Total number of requests dropped because they timed out. */
  readonly droppedCount: number;
  /** Average time (ms) a request spent waiting in the queue before starting. */
  readonly averageWaitTimeMs: number;
  /** Aggregate count of all requests ever enqueued. */
  readonly totalProcessed: number;
}

/**
 * Internal (non-generic) representation of a queued request.
 *
 * Using a non-generic type avoids contravariance issues when pushing
 * `QueueEntry<T>` into a `QueueEntry<unknown>[]`.  The generic type
 * information is captured at enqueue time via closures over the caller's
 * `resolve` / `reject` callbacks and the wrapped `fn`.
 */
interface InternalQueueEntry {
  /** The async function to execute once a concurrency slot is available. */
  readonly fn: () => Promise<unknown>;
  /** Priority used to order the queue. */
  readonly priority: Priority;
  /** Maximum time (ms) this entry may live in the queue system. */
  readonly timeoutMs: number;
  /** Resolve the Promise returned to the caller. */
  resolve: (value: unknown) => void;
  /** Reject the Promise returned to the caller. */
  reject: (reason: unknown) => void;
  /** High-resolution timestamp of when the entry was enqueued. */
  readonly enqueuedAt: number;
  /** Handle for the setTimeout that enforces the queue timeout. */
  timer: ReturnType<typeof setTimeout>;
  /** Whether the entry has already been settled (resolved or rejected). */
  settled: boolean;
  /** Whether the entry has been pulled from the queue and started executing. */
  started: boolean;
}

// =============================================================================
// RequestQueue
// =============================================================================

/**
 * A generic, in-memory request queue that limits concurrency to prevent
 * resource exhaustion under high load.
 *
 * @typeParam T — The return type of queued functions (inferred per-call).
 *
 * @example
 * ```ts
 * const queue = new RequestQueue(5, 10_000);
 *
 * const result = await queue.enqueue(
 *   () => callExternalAPI(payload),
 *   'high',
 *   15_000,
 * );
 * ```
 *
 * Features:
 * - Configurable max concurrency and per-request timeout.
 * - Three priority levels (`high` > `normal` > `low`).
 * - Real-time metrics via `getMetrics()`.
 * - Fully Promise-driven — no polling required.
 */
export class RequestQueue {
  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  /** Pending entries sorted by priority (FIFO within the same priority). */
  private readonly queue: InternalQueueEntry[] = [];

  /** Number of entries currently executing. */
  private _activeCount = 0;

  /** Lifetime counters for metrics. */
  private _completedCount = 0;
  private _failedCount = 0;
  private _droppedCount = 0;

  /** Accumulators for computing average wait time. */
  private _totalWaitMs = 0;
  private _waitSamples = 0;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  /**
   * @param maxConcurrency  Maximum number of requests that may execute
   *                        concurrently.
   * @param defaultTimeoutMs Default per-request timeout in milliseconds.  Covers
   *                         both queue-wait time and execution time.
   */
  constructor(
    private readonly maxConcurrency: number,
    private readonly defaultTimeoutMs: number,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Enqueue an async function for execution.
   *
   * The returned `Promise` resolves with the function's result, or rejects if:
   * - The per-request timeout elapses before the function settles.
   * - The user-supplied function itself throws / rejects.
   *
   * @param fn        The async work to execute once a slot is available.
   * @param priority  Queue ordering priority (default `'normal'`).
   * @param timeoutMs Override the queue's default timeout for this request.
   * @returns A `Promise<T>` that mirrors the result of `fn`.
   */
  enqueue<T>(
    fn: () => Promise<T>,
    priority: Priority = 'normal',
    timeoutMs?: number,
  ): Promise<T> {
    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const entry: InternalQueueEntry = {
        fn: fn as () => Promise<unknown>,
        priority,
        timeoutMs: effectiveTimeout,
        resolve: resolve as (value: unknown) => void,
        reject,
        enqueuedAt: performance.now(),
        timer: undefined!,
        settled: false,
        started: false,
      };

      // Arm the timeout timer — covers the entire lifecycle (wait + execute).
      entry.timer = setTimeout(
        () => this.handleTimeout(entry),
        effectiveTimeout,
      );

      this.queue.push(entry);
      this.drain();
    });
  }

  /**
   * Return a snapshot of the current queue metrics.
   */
  getMetrics(): QueueMetrics {
    return {
      queueLength: this.queue.length,
      activeCount: this._activeCount,
      completedCount: this._completedCount,
      failedCount: this._failedCount,
      droppedCount: this._droppedCount,
      averageWaitTimeMs:
        this._waitSamples > 0
          ? Math.round(this._totalWaitMs / this._waitSamples)
          : 0,
      totalProcessed:
        this._completedCount + this._failedCount + this._droppedCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal scheduling
  // ---------------------------------------------------------------------------

  /**
   * Try to pull as many pending entries off the queue as concurrency allows.
   * Called after every enqueue, completion, failure, and timeout.
   */
  private drain(): void {
    // Sort by priority so high-priority entries are dequeued first.
    // FIFO ordering is preserved within the same priority level (stable sort).
    if (this.queue.length > 1) {
      this.queue.sort(
        (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority],
      );
    }

    while (this._activeCount < this.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!;

      // Entry may have already been settled by a timeout race.
      if (entry.settled) {
        continue;
      }

      clearTimeout(entry.timer);
      entry.started = true;
      this._activeCount++;

      // Record wait time (time spent sitting in the queue before execution).
      const waitMs = performance.now() - entry.enqueuedAt;
      this._totalWaitMs += waitMs;
      this._waitSamples++;

      // Fire-and-forget — the entry's resolve/reject settles the caller's
      // Promise; `this.drain()` is called in the finally block to fill freed
      // slots.
      this.execute(entry).catch(() => {
        // Exceptions from `execute` are already routed to `entry.reject`.
      });
    }
  }

  /**
   * Execute a single queue entry, routing success/failure to the entry's
   * resolve/reject and decrementing the active counter when done.
   */
  private async execute(entry: InternalQueueEntry): Promise<void> {
    try {
      const result = await entry.fn();
      this.settleSuccess(entry, result);
    } catch (error) {
      this.settleFailure(entry, error);
    } finally {
      this._activeCount = Math.max(0, this._activeCount - 1);
      // Schedule the next drain on the microtask queue so the call-stack
      // doesn't grow unboundedly under sustained load.
      queueMicrotask(() => this.drain());
    }
  }

  // ---------------------------------------------------------------------------
  // Settlement helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve an entry if it hasn't already been settled (e.g. by a timeout).
   */
  private settleSuccess(entry: InternalQueueEntry, value: unknown): void {
    if (entry.settled) return;
    entry.settled = true;
    this._completedCount++;
    entry.resolve(value);
  }

  /**
   * Reject an entry if it hasn't already been settled (e.g. by a timeout).
   */
  private settleFailure(entry: InternalQueueEntry, reason: unknown): void {
    if (entry.settled) return;
    entry.settled = true;
    this._failedCount++;
    entry.reject(reason);
  }

  /**
   * Handle a timeout: remove the entry from the queue (if still pending) or
   * mark it as timed-out (if already executing).  In either case the caller's
   * Promise is rejected and metrics are updated.
   */
  private handleTimeout(entry: InternalQueueEntry): void {
    if (entry.settled) return;

    // If the entry is still waiting in the queue, splice it out.
    const idx = this.queue.indexOf(entry);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
    }

    entry.settled = true;
    this._droppedCount++;

    const elapsed = Math.round(performance.now() - entry.enqueuedAt);
    const phase = entry.started ? 'executing' : 'waiting in queue';
    entry.reject(
      new Error(
        `RequestQueue timeout: request timed out after ${elapsed}ms ` +
          `(${phase}, limit ${entry.timeoutMs}ms)`,
      ),
    );

    // If the entry was active when the timeout fired we need to free its slot
    // and try to schedule the next pending request.
    if (entry.started) {
      this._activeCount = Math.max(0, this._activeCount - 1);
      queueMicrotask(() => this.drain());
    }
  }
}

// =============================================================================
// Singleton instances
// =============================================================================

/**
 * General-purpose request queue.
 *
 * - Max concurrency: **200** (scaled for 1000+ concurrent users)
 * - Default timeout: **10 000 ms** (10 s)
 *
 * Use for non-AI async work (DB writes, external HTTP calls, etc.).
 */
export const requestQueue = new RequestQueue(
  /* maxConcurrency */ 200,
  /* defaultTimeoutMs */ 10_000,
);

/**
 * AI-specific request queue with stricter limits to protect LLM providers
 * from rate-limit exhaustion.
 *
 * - Max concurrency: **80** (scaled for 1000+ concurrent users)
 * - Default timeout: **15 000 ms** (15 s)
 *
 * Use for all AI / LLM API calls (chat completions, embeddings, image
 * generation, etc.).
 */
export const aiQueue = new RequestQueue(
  /* maxConcurrency */ 80,
  /* defaultTimeoutMs */ 15_000,
);
