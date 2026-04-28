import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { CreateDocumentRequest } from '@syncode/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationService } from '../collaboration/collaboration.service.js';
import { InternalCallbackGuard } from '../common/guards/internal-callback.guard.js';
import { HealthController } from './health.controller.js';
import { InternalController } from './internal.controller.js';

const INTERNAL_SECRET = 'test-internal-secret-test-internal-secret-ok';

function createMockConfigService(secret: string) {
  return {
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        key === 'INTERNAL_CALLBACK_SECRET' ? secret : undefined,
      ),
  };
}

let app: INestApplication;
let mockCollaborationService: {
  createDocument: ReturnType<typeof vi.fn>;
  destroyDocument: ReturnType<typeof vi.fn>;
  kickUser: ReturnType<typeof vi.fn>;
  updateRoomState: ReturnType<typeof vi.fn>;
  changeLanguage: ReturnType<typeof vi.fn>;
  broadcastParticipantReady: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  mockCollaborationService = {
    createDocument: vi.fn().mockResolvedValue({ roomId: 'room-1', createdAt: 1000 }),
    destroyDocument: vi.fn().mockResolvedValue({ roomId: 'room-1' }),
    kickUser: vi.fn().mockResolvedValue({ kicked: true }),
    updateRoomState: vi.fn().mockResolvedValue({ success: true }),
    changeLanguage: vi.fn().mockResolvedValue({ success: true }),
    broadcastParticipantReady: vi.fn(),
  };

  const module = await Test.createTestingModule({
    controllers: [InternalController, HealthController],
    providers: [
      { provide: CollaborationService, useValue: mockCollaborationService },
      { provide: ConfigService, useValue: createMockConfigService(INTERNAL_SECRET) },
      InternalCallbackGuard,
    ],
  }).compile();

  app = module.createNestApplication();
  await app.init();
});

afterEach(async () => {
  await app.close();
});

const ROOM_ID = 'room-abc';
const USER_ID = 'user-xyz';

const VALID_CREATE_DOCUMENT_PAYLOAD: CreateDocumentRequest = {
  roomId: ROOM_ID,
};

describe('InternalController auth guard', () => {
  it('GIVEN missing X-Internal-Secret header WHEN creating document THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/documents')
      .send(VALID_CREATE_DOCUMENT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('GIVEN wrong X-Internal-Secret header WHEN creating document THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/documents')
      .set('X-Internal-Secret', 'wrong-secret-value')
      .send(VALID_CREATE_DOCUMENT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('GIVEN valid X-Internal-Secret header WHEN creating document THEN returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/documents')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send(VALID_CREATE_DOCUMENT_PAYLOAD)
      .expect(201);

    expect(res.body).toEqual({ roomId: 'room-1', createdAt: 1000 });
  });

  it('GIVEN missing header WHEN destroying document THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).delete(`/internal/documents/${ROOM_ID}`);

    expect(res.status).toBe(401);
  });

  it('GIVEN missing header WHEN kicking user THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/internal/documents/${ROOM_ID}/kick`)
      .send({ userId: USER_ID });

    expect(res.status).toBe(401);
  });

  it('GIVEN missing header WHEN updating room state THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/internal/documents/${ROOM_ID}/state`)
      .send({ phase: 'coding', editorLocked: false });

    expect(res.status).toBe(401);
  });

  it('GIVEN missing header WHEN broadcasting participant ready THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/internal/documents/${ROOM_ID}/participant-ready`)
      .send({ userId: USER_ID, isReady: true });

    expect(res.status).toBe(401);
  });

  it('GIVEN missing header WHEN changing language THEN returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/internal/documents/${ROOM_ID}/language`)
      .send({ language: 'python' });

    expect(res.status).toBe(401);
  });
});

describe('HealthController', () => {
  it('GIVEN no header WHEN calling health THEN returns 200 (public endpoint)', async () => {
    const res = await request(app.getHttpServer()).get('/internal/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });
});
