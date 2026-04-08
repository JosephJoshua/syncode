import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import type { EnvConfig } from '../config/env.config.js';
import { HttpControlPlaneCallbackClient } from './clients/http-control-plane-callback.client.js';

@Global()
@Module({
  providers: [
    {
      provide: CONTROL_PLANE_CALLBACK,
      useFactory: (config: ConfigService<EnvConfig>) => {
        const controlPlaneUrl = config.get('CONTROL_PLANE_URL', { infer: true })!;
        return new HttpControlPlaneCallbackClient(controlPlaneUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CONTROL_PLANE_CALLBACK],
})
export class InfrastructureModule {}
