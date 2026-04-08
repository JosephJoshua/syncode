import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AiModule } from './ai/ai.module.js';
import { validateEnv } from './config/env.config.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';

const isProd = process.env.NODE_ENV === 'production';
let hasPinoPretty = false;
if (!isProd) {
  try {
    require.resolve('pino-pretty');
    hasPinoPretty = true;
  } catch {}
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
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
                        'service.name': 'ai-plane',
                        'service.version': process.env.npm_package_version || '0.0.0',
                      },
                    },
                  },
                ]
              : []),
          ],
        },
      },
    }),
    InfrastructureModule,
    AiModule,
  ],
})
export class AppModule {}
