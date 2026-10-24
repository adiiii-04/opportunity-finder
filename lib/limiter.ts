/**
 * Simple in-memory concurrency limiter with queue support.
 */
export class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrency: number = 4) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

export const tinyfishLimiter = new ConcurrencyLimiter(4);
export const geminiLimiter = new ConcurrencyLimiter(4);
