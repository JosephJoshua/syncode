import type { ICacheService, TtlResult } from '@syncode/shared/ports';

interface CacheEntry {
  value: unknown;
  expiresAt: number | null;
}

export class InMemoryCacheService implements ICacheService {
  private readonly entries = new Map<string, CacheEntry>();

  private isAlive(entry: CacheEntry | undefined): entry is CacheEntry {
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      return false;
    }
    return true;
  }

  private getEntry(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (entry && !this.isAlive(entry)) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.getEntry(key)?.value as T | undefined) ?? null;
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1_000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    let deleted = 0;

    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    return this.getEntry(key) !== undefined;
  }

  async getTtl(key: string): Promise<TtlResult> {
    const entry = this.getEntry(key);
    if (!entry) return { state: 'missing' };
    return entry.expiresAt !== null
      ? { state: 'expiring', ttlSeconds: Math.ceil((entry.expiresAt - Date.now()) / 1_000) }
      : { state: 'permanent' };
  }

  async incrBy(key: string, amount = 1): Promise<number> {
    const entry = this.getEntry(key);
    const nextValue = (Number(entry?.value ?? 0) || 0) + amount;
    this.entries.set(key, { value: nextValue, expiresAt: entry?.expiresAt ?? null });
    return nextValue;
  }

  async setIfNotExists<T = unknown>(key: string, value: T): Promise<boolean> {
    if (this.getEntry(key)) {
      return false;
    }

    this.entries.set(key, { value, expiresAt: null });
    return true;
  }

  async expire(key: string): Promise<boolean> {
    return this.getEntry(key) !== undefined;
  }

  async shutdown(): Promise<void> {}
}
