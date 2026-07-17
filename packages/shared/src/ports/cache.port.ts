export const CACHE_SERVICE = Symbol.for('CACHE_SERVICE');

export type TtlResult =
  | { state: 'expiring'; ttlSeconds: number }
  | { state: 'permanent' }
  | { state: 'missing' };

export interface ICacheService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  getTtl(key: string): Promise<TtlResult>;
  incrBy(key: string, amount?: number, ttlSeconds?: number): Promise<number>;
  setIfNotExists<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  shutdown(): Promise<void>;
}
