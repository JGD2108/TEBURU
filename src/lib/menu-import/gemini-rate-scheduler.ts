export type GeminiRateSchedulerOptions = {
  concurrency?: number;
  minIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

type QueueEntry<T> = { task: () => Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** A small server-side queue shared by provider calls; it never decides semantic retries. */
export class GeminiRateScheduler {
  private readonly concurrency: number;
  private readonly minIntervalMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly queue: QueueEntry<unknown>[] = [];
  private active = 0;
  private draining = false;
  private lastStartedAt = Number.NEGATIVE_INFINITY;

  constructor(options: GeminiRateSchedulerOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
    this.minIntervalMs = Math.max(0, Math.floor(options.minIntervalMs ?? 0));
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  get configuredConcurrency() { return this.concurrency; }
  get configuredMinIntervalMs() { return this.minIntervalMs; }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (value: unknown) => void, reject });
      void this.drain();
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    while (this.active < this.concurrency && this.queue.length) {
      const entry = this.queue.shift()!;
      this.active += 1;
      const wait = Math.max(0, this.minIntervalMs - (this.now() - this.lastStartedAt));
      if (wait) await this.sleep(wait);
      this.lastStartedAt = this.now();
      void entry.task().then(entry.resolve, entry.reject).finally(() => {
        this.active -= 1;
        void this.drain();
      });
    }
    this.draining = false;
    if (this.active < this.concurrency && this.queue.length) void this.drain();
  }
}

export function createGeminiRateScheduler(options: GeminiRateSchedulerOptions = {}) {
  return new GeminiRateScheduler(options);
}
