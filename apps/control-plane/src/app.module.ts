import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { type EnvConfig, validateEnv } from './config/env.config.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DbModule } from './modules/db/db.module.js';
import { ExecutionModule } from './modules/execution/execution.module.js';
import { InternalModule } from './modules/internal/internal.module.js';
import { ProblemsModule } from './modules/problems/problems.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { UsersModule } from './modules/users/users.module.js';

const isProd = process.env.NODE_ENV === 'production';
let hasPinoPretty = false;
if (!isProd) {
  try {
    require.resolve('pino-pretty');
    hasPinoPretty = true;
  } catch {}
}

/**
 * Imports all feature modules and configures application-wide services.
 * NOTE: Module order matters.
 */
@Module({
  imports: [
    // Core configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProd ? 'info' : 'debug',
        transport: {
          targets: [
            hasPinoPretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : { target: 'pino/file', options: { destination: 1 } },
            ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
              ? [
                  {
                    target: 'pino-opentelemetry-transport',
                    options: {
                      logRecordProcessorOptions: [
                        {
                          recordProcessorType: 'batch',
                          exporterOptions: {
                            protocol: 'http',
                            httpExporterOptions: {
                              url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
                            },
                          },
                        },
                      ],
                      resourceAttributes: {
                        'service.name': 'control-plane',
                        'service.version': process.env.npm_package_version || '0.0.0',
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            // Don't log sensitive headers.
            headers: {
              ...req.headers,
              authorization: req.headers.authorization ? '[REDACTED]' : undefined,
            },
          }),
        },
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => [
        {
          ttl: (config.get('THROTTLE_TTL_SECS', { infer: true }) ?? 60) * 1_000, // seconds -> ms
          limit: config.get('THROTTLE_LIMIT', { infer: true }) ?? 10,
        },
      ],
    }),

    // Global modules
    ScheduleModule.forRoot(),
    DbModule,
    InfrastructureModule,

    // Feature modules
    AuthModule,
    UsersModule,
    RoomsModule,
    ProblemsModule,
    ExecutionModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
