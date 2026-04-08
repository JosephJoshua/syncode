// IMPORTANT: Import telemetry FIRST, before any other imports
import './telemetry.js';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { EnvConfig } from './config/env.config.js';

/**
 * Bootstrap the collab plane application
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until logger is ready.
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useWebSocketAdapter(
    new WsAdapter(app, {
      messageParser: (data: { toString(): string }) => {
        const message = JSON.parse(data.toString());
        return { event: message.type, data: message.data };
      },
    }),
  );

  app.enableShutdownHooks();

  const config = app.get(ConfigService<EnvConfig>);
  const port = config.get('PORT', { infer: true }) ?? 3001;

  await app.listen(port);

  logger.log(`Collab plane listening on port ${port}`);
}

bootstrap();
