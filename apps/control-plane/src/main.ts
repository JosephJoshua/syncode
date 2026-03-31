// IMPORTANT: Import telemetry FIRST, before any other imports
import './telemetry.js';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import type { EnvConfig } from './config/env.config.js';

/**
 * Bootstrap the control plane application
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until logger is ready.
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(new ZodValidationPipe());

  const config = app.get(ConfigService<EnvConfig>);

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = config.get('PORT', { infer: true }) ?? 3000;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SynCode Control Plane API')
    .setDescription(
      'REST API for collaborative interview training platform.\n\n' +
        '## Rate Limiting\n\n' +
        'All endpoints are rate-limited via a sliding window. When the limit is exceeded, ' +
        'the server responds with **429 Too Many Requests** and a `Retry-After` header ' +
        'indicating how many seconds to wait before retrying.',
    )
    .setVersion('1.0')
    .addServer(`http://localhost:${port}`, 'Local development')
    .setContact('SynCode Team', '', '')
    .setLicense('Apache License 2.0', 'https://www.apache.org/licenses/LICENSE-2.0.html')
    .addBearerAuth()
    .addGlobalResponse({
      status: 429,
      description: 'Rate limit exceeded. Check `Retry-After` header for wait time.',
    })
    .addTag('auth', 'Authentication')
    .addTag('users', 'User management')
    .addTag('rooms', 'Collaborative rooms')
    .addTag('problems', 'Coding problems')
    .addTag('execution', 'Code execution results')
    .addTag('health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, cleanupOpenApiDoc(document));

  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`Control plane listening on port ${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api`);
}

bootstrap();
