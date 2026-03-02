export const CACHE_SERVICE = Symbol.for('CACHE_SERVICE');
export const CACHE_SERVICE_KEY = 'CACHE_SERVICE';

export interface ICacheService {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  getTtl(key: string): Promise<number>;
  incr(key: string, amount?: number): Promise<number>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  shutdown(): Promise<void>;
}
