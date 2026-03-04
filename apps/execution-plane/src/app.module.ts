import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.config';
import { ExecutionModule } from './execution/execution.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: {
          targets: [
            process.env.NODE_ENV === 'production'
              ? { target: 'pino/file', options: { destination: 1 } }
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },
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
                        'service.name': 'execution-plane',
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
    ExecutionModule,
  ],
})
export class AppModule {}
