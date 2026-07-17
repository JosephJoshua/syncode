import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { ParticipantHeartbeatRequest, UserDisconnectedPayload } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import { createTestDb } from '@/test/integration-setup.js';
import { createMockConfigService, createMockStorageService } from '@/test/mock-factories.js';
import { InternalController } from './internal.controller.js';

const INTERNAL_SECRET = 'test-internal-secret-test-internal-secret-ok';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let mockRoomsService: {
  markParticipantInactive: ReturnType<typeof vi.fn>;
  recordParticipantHeartbeats: ReturnType<typeof vi.fn>;
  authorizeJoin: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  mockRoomsService = {
    markParticipantInactive: vi.fn().mockResolvedValue(undefined),
    recordParticipantHeartbeats: vi.fn().mockResolvedValue(0),
    authorizeJoin: vi.fn().mockResolvedValue({ authorized: true }),
  };

  const module = await Test.createTestingModule({
    controllers: [InternalController],
    providers: [
      { provide: RoomsService, useValue: mockRoomsService },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: DB_CLIENT, useValue: db },
      {
        provide: ConfigService,
        useValue: createMockConfigService({ INTERNAL_CALLBACK_SECRET: INTERNAL_SECRET }),
      },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const VALID_DISCONNECT_PAYLOAD: UserDisconnectedPayload = {
  roomId: ROOM_ID,
  userId: USER_ID,
  timestamp: Date.now(),
};

const VALID_HEARTBEAT_PAYLOAD: ParticipantHeartbeatRequest = {
  participants: [{ roomId: ROOM_ID, userId: USER_ID }],
};

describe('InternalController auth guard', () => {
  it('GIVEN missing X-Internal-Secret header WHEN calling user-disconnected THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/collab/user-disconnected')
      .send(VALID_DISCONNECT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('GIVEN wrong X-Internal-Secret header WHEN calling user-disconnected THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/collab/user-disconnected')
      .set('X-Internal-Secret', 'wrong-secret-value')
      .send(VALID_DISCONNECT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('GIVEN valid X-Internal-Secret header WHEN calling user-disconnected THEN returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/collab/user-disconnected')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send(VALID_DISCONNECT_PAYLOAD)
      .expect(201);

    expect(res.body).toEqual({ success: true });
  });

  it('GIVEN valid X-Internal-Secret header WHEN calling participant-heartbeat THEN returns 201 with updated count', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/participants/heartbeat')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send(VALID_HEARTBEAT_PAYLOAD)
      .expect(201);

    expect(res.body).toEqual({ updated: 0 });
  });

  it('GIVEN missing header WHEN calling participant-heartbeat THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/participants/heartbeat')
      .send(VALID_HEARTBEAT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('GIVEN missing header WHEN calling authorize-join THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM_ID}/authorize-join`)
      .send({ userId: USER_ID });

    expect(res.status).toBe(401);
  });

  it('GIVEN valid header WHEN calling authorize-join THEN delegates to rooms service', async () => {
    mockRoomsService.authorizeJoin.mockResolvedValueOnce({ authorized: true });

    const res = await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM_ID}/authorize-join`)
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({ userId: USER_ID })
      .expect(201);

    expect(res.body).toEqual({ authorized: true });
    expect(mockRoomsService.authorizeJoin).toHaveBeenCalledWith(ROOM_ID, USER_ID);
  });

  it('GIVEN service returns a denial reason WHEN calling authorize-join THEN reason is passed through', async () => {
    mockRoomsService.authorizeJoin.mockResolvedValueOnce({
      authorized: false,
      reason: 'participant-removed',
    });

    const res = await request(app.getHttpServer())
      .post(`/internal/rooms/${ROOM_ID}/authorize-join`)
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({ userId: USER_ID })
      .expect(201);

    expect(res.body).toEqual({ authorized: false, reason: 'participant-removed' });
  });
});
