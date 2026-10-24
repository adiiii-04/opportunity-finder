interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, ttlMs: number = 30 * 60 * 1000): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  has(key: string, ttlMs: number = 30 * 60 * 1000): boolean {
    return this.get(key, ttlMs) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const pageCache = new MemoryCache();
