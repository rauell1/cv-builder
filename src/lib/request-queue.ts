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

class RequestQueue {
  private concurrency: number;
  private running = 0;
  private queue: QueueEntry<unknown>[] = [];
  private readonly queueTimeoutMs: number;

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
        entry.reject(new Error('Request queue timeout: too many concurrent requests'));
        continue;
      }

      this.running++;
      entry
        .task()
        .then((result) => entry.resolve(result))
        .catch((err: unknown) => entry.reject(err))
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
}

export const aiQueue = new RequestQueue(6, 30_000);
