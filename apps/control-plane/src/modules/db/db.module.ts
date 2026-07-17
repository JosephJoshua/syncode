import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb } from '@syncode/db';
import type { EnvConfig } from '@/config/env.config.js';

/**
 * DI token for Drizzle database client
 */
export const DB_CLIENT = Symbol.for('DB_CLIENT');

/**
 * Database module providing Drizzle ORM client
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      useFactory: (config: ConfigService<EnvConfig>) => {
        const databaseUrl = config.get('DATABASE_URL', { infer: true });
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined');
        }
        return createDb(databaseUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB_CLIENT],
})
export class DbModule {}
