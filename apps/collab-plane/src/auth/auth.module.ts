import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { EnvConfig } from '../config/env.config.js';
import { WsAuthService } from './ws-auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('COLLAB_JWT_SECRET', { infer: true }),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class AuthModule {}
