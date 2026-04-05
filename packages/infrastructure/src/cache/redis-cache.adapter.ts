import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { ICacheService, TtlResult } from '@syncode/shared';
import { Redis } from 'ioredis';
import { type RedisConfig, RedisConfigSchema } from '../config.js';

@Injectable()
export class RedisCacheAdapter implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private readonly client: Redis;

  constructor(config: RedisConfig) {
    const validatedConfig = RedisConfigSchema.parse(config);

    const redisOptions = {
      maxRetriesPerRequest: validatedConfig.maxRetriesPerRequest ?? null,
      connectTimeout: validatedConfig.connectTimeout ?? 10000,
      commandTimeout: validatedConfig.commandTimeout ?? 5000,
      retryStrategy:
        validatedConfig.retryStrategy ??
        ((times: number) => {
          if (times > 10) {
            this.logger.error('Redis retry limit exceeded (10 attempts), stopping reconnection');
            return null;
          }
          const delay = Math.min(times * 50, 2000);
          this.logger.log(`Redis reconnect attempt ${times}, waiting ${delay}ms`);
          return delay;
        }),
    };

    this.client = new Redis(validatedConfig.url, redisOptions);

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client connected');
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `Failed to parse JSON for key ${key}, returning raw value. May indicate data corruption.`,
        error,
      );
      return value as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    let iterations = 0;
    const maxIterations = 10000; // Safety limit to prevent infinite loops.

    do {
      if (++iterations > maxIterations) {
        this.logger.warn(
          `delByPattern exceeded ${maxIterations} iterations for pattern ${pattern}. Stopping.`,
        );
        break;
      }

      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async getTtl(key: string): Promise<TtlResult> {
    const ttl = await this.client.ttl(key);

    if (ttl === -2) {
      return { state: 'missing' };
    }

    if (ttl === -1) {
      return { state: 'permanent' };
    }

    return { state: 'expiring', ttlSeconds: ttl };
  }

  async incrBy(key: string, amount = 1, ttlSeconds?: number): Promise<number> {
    if (!Number.isInteger(amount)) {
      throw new Error(`incrBy amount must be an integer, got: ${amount}`);
    }

    if (ttlSeconds !== undefined) {
      const script = `
        local val = redis.call('INCRBY', KEYS[1], ARGV[1])
        if val == tonumber(ARGV[1]) then
          redis.call('EXPIRE', KEYS[1], ARGV[2])
        end
        return val
      `;

      return (await this.client.eval(
        script,
        1,
        key,
        amount.toString(),
        ttlSeconds.toString(),
      )) as number;
    }
    return await this.client.incrby(key, amount);
  }

  async setIfNotExists<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      const result = await this.client.set(key, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }

    const result = await this.client.set(key, serialized, 'NX');
    return result === 'OK';
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down Redis cache adapter...');

    try {
      this.client.removeAllListeners();
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis client:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}
