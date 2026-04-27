import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { EnvConfig } from '@/config/env.config.js';
import { ExecutionModule } from '@/modules/execution/execution.module.js';
import { SessionsModule } from '@/modules/sessions/sessions.module.js';
import { ParticipantSweepService } from './participant-sweep.service.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

/**
 * Manages room lifecycle and code execution.
 */
@Module({
  imports: [
    ExecutionModule,
    SessionsModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('COLLAB_JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, ParticipantSweepService],
  exports: [RoomsService],
})
export class RoomsModule {}
