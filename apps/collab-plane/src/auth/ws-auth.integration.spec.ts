import type { INestApplication } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import { CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { CollaborationGateway } from '../collaboration/collaboration.gateway.js';
import { CollaborationModule } from '../collaboration/collaboration.module.js';

@Global()
@Module({
  providers: [
    {
      provide: CONTROL_PLANE_CALLBACK,
      useValue: { notifyUserDisconnected: vi.fn().mockResolvedValue(undefined) },
    },
  ],
  exports: [CONTROL_PLANE_CALLBACK],
})
class MockInfrastructureModule {}

const JWT_SECRET = 'integration-test-secret-at-least-32-characters-long';

let app: INestApplication;
let wsUrl: string;
let jwtService: JwtService;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(async () => {
  vi.spyOn(CollaborationGateway.prototype, 'handleDisconnect').mockImplementation(() => {});

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ COLLAB_JWT_SECRET: JWT_SECRET })],
      }),
      MockInfrastructureModule,
      CollaborationModule,
    ],
  }).compile();

  app = module.createNestApplication();
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.init();
  await app.listen(0);

  const address = app.getHttpServer().address() as { port: number };
  wsUrl = `ws://127.0.0.1:${address.port}`;

  jwtService = new JwtService({ secret: JWT_SECRET });
});

afterEach(async () => {
  await app.close();
  vi.restoreAllMocks();
});

describe('WebSocket Authentication', () => {
  it('GIVEN valid collab token WHEN connecting THEN connection is accepted', async () => {
    const token = jwtService.sign({ sub: 'user-1', roomId: 'room-1', role: 'candidate' });
    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    await new Promise<void>((resolve) => ws.on('open', resolve));
    await delay(100);

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('GIVEN no token WHEN connecting THEN closed with code 4001', async () => {
    const ws = new WebSocket(wsUrl);
    ws.on('error', () => {}); // Prevent unhandled error crash

    const { code } = await new Promise<{ code: number }>((resolve) => {
      ws.on('close', (code) => resolve({ code }));
    });

    expect(code).toBe(4001);
  });
});
