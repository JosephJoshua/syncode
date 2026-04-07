import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { EnvConfig } from '@/config/env.config.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

/**
 * Manages room lifecycle and code execution.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('COLLAB_JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
