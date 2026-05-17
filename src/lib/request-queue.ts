/**
 * Request Queue — limits concurrent AI calls to prevent cold-start avalanches.
 *
 * Concurrency bumped to 6 so multiple simultaneous users do not queue-block each other.
 * Queue timeout raised to 30 s (gives the AI race + sequential fallback enough headroom).
 * Priority support: high-priority callers (parse-cv, extract-file) jump the queue.
 */

type Task<T> = () => Promise<T>;

interface QueueEntry<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  priority: 'high' | 'normal';
  enqueuedAt: number;
}

export interface QueueMetrics {
  activeCount: number;
  queueLength: number;
  completedCount: number;
  failedCount: number;
  droppedCount: number;
  averageWaitTimeMs: number;
  totalProcessed: number;
}

class RequestQueue {
  private concurrency: number;
  private running = 0;
  private queue: QueueEntry<unknown>[] = [];
  private readonly queueTimeoutMs: number;

  // metrics counters
  private completedCount = 0;
  private failedCount = 0;
  private droppedCount = 0;
  private totalWaitMs = 0;
  private totalProcessed = 0;

  constructor(concurrency = 6, queueTimeoutMs = 30_000) {
    this.concurrency    = concurrency;
    this.queueTimeoutMs = queueTimeoutMs;
  }

  /** Enqueue with optional priority and per-item timeout. */
  enqueue<T>(task: Task<T>, priority: 'high' | 'normal' = 'normal', _itemTimeoutMs?: number): Promise<T> {
    return this.add(task, priority);
  }

  add<T>(task: Task<T>, priority: 'high' | 'normal' = 'normal'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry<unknown> = {
        task: task as Task<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        enqueuedAt: Date.now(),
      };

      if (priority === 'high') {
        this.queue.unshift(entry);
      } else {
        this.queue.push(entry);
      }

      this.drain();
    });
  }

  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!;

      if (Date.now() - entry.enqueuedAt > this.queueTimeoutMs) {
        this.droppedCount++;
        entry.reject(new Error('Request queue timeout: too many concurrent requests'));
        continue;
      }

      const waitMs = Date.now() - entry.enqueuedAt;
      this.totalWaitMs += waitMs;
      this.totalProcessed++;
      this.running++;

      entry
        .task()
        .then((result) => {
          this.completedCount++;
          entry.resolve(result);
        })
        .catch((err: unknown) => {
          this.failedCount++;
          entry.reject(err);
        })
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }

  get pendingCount(): number { return this.queue.length; }
  get runningCount(): number { return this.running; }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n);
    this.drain();
  }

  getMetrics(): QueueMetrics {
    return {
      activeCount:       this.running,
      queueLength:       this.queue.length,
      completedCount:    this.completedCount,
      failedCount:       this.failedCount,
      droppedCount:      this.droppedCount,
      averageWaitTimeMs: this.totalProcessed > 0
        ? Math.round(this.totalWaitMs / this.totalProcessed)
        : 0,
      totalProcessed:    this.totalProcessed,
    };
  }
}

export const aiQueue = new RequestQueue(6, 30_000);
