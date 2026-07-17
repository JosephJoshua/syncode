import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { auditLogs, type Database } from '@syncode/db';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { createTestDb, insertUser } from '@/test/integration-setup.js';
import { asUser, TestAuthGuard } from '@/test/mock-factories.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AuditService } from './audit.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [AdminAuditController],
    providers: [AuditService, { provide: DB_CLIENT, useValue: db }],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(TestAuthGuard)
    .compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

describe('GET /admin/audit-logs', () => {
  it('GIVEN admin user WHEN querying logs THEN returns searchable paginated audit entries', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const actor = await insertUser(db, {
      email: 'actor@example.com',
      username: 'actor-user',
      displayName: 'Actor User',
    });
    const oldLog = await insertAuditLog(actor.id, {
      action: 'auth.register',
      targetId: actor.id,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const recentLog = await insertAuditLog(actor.id, {
      action: 'auth.login',
      targetId: actor.id,
      metadata: { identifierType: 'email' },
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertAuditLog(null, {
      action: 'system.cleanup',
      targetType: 'system',
      targetId: 'daily',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const firstPage = await asUser(
      request(app.getHttpServer()).get('/admin/audit-logs?search=actor&limit=1'),
      admin,
    ).expect(200);

    expect(firstPage.body.data).toHaveLength(1);
    expect(firstPage.body.data[0]).toMatchObject({
      id: recentLog.id,
      actorId: actor.id,
      actor: {
        id: actor.id,
        email: 'actor@example.com',
        username: 'actor-user',
        displayName: 'Actor User',
      },
      action: 'auth.login',
      targetType: 'user',
      targetId: actor.id,
      metadata: { identifierType: 'email' },
      ipAddress: '127.0.0.1',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    expect(firstPage.body.pagination).toMatchObject({
      hasMore: true,
      nextCursor: expect.any(String),
    });

    const secondPage = await asUser(
      request(app.getHttpServer()).get(
        `/admin/audit-logs?search=actor&limit=1&cursor=${firstPage.body.pagination.nextCursor}`,
      ),
      admin,
    ).expect(200);

    expect(secondPage.body.data.map((log: { id: string }) => log.id)).toEqual([oldLog.id]);
    expect(secondPage.body.pagination).toEqual({ hasMore: false, nextCursor: null });
  });

  it('GIVEN partial action and date filters WHEN querying logs THEN returns matching entries only', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const actor = await insertUser(db);
    const expected = await insertAuditLog(actor.id, {
      action: 'auth.logout',
      targetId: actor.id,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertAuditLog(actor.id, {
      action: 'auth.login',
      targetId: actor.id,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertAuditLog(actor.id, {
      action: 'auth.logout',
      targetId: actor.id,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    });

    const res = await asUser(
      request(app.getHttpServer()).get(
        '/admin/audit-logs?action=logout&from=2026-01-01T00:00:00.000Z&to=2026-01-03T00:00:00.000Z',
      ),
      admin,
    ).expect(200);

    expect(res.body.data.map((log: { id: string }) => log.id)).toEqual([expected.id]);
  });

  it('GIVEN actor and target filters WHEN querying logs THEN returns matching entries only', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const actor = await insertUser(db);
    const otherActor = await insertUser(db);
    const target = await insertUser(db);
    const expected = await insertAuditLog(actor.id, {
      action: 'admin.user.ban',
      targetId: target.id,
    });
    await insertAuditLog(otherActor.id, {
      action: 'admin.user.ban',
      targetId: target.id,
    });
    await insertAuditLog(actor.id, {
      action: 'admin.user.unban',
      targetId: otherActor.id,
    });

    const res = await asUser(
      request(app.getHttpServer()).get(
        `/admin/audit-logs?actorId=${actor.id}&targetId=${target.id}`,
      ),
      admin,
    ).expect(200);

    expect(res.body.data.map((log: { id: string }) => log.id)).toEqual([expected.id]);
  });

  it('GIVEN malformed cursor WHEN querying logs THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(
      request(app.getHttpServer()).get('/admin/audit-logs?cursor=not-a-valid-cursor'),
      admin,
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid cursor',
    });
  });

  it('GIVEN cursor with invalid fields WHEN querying logs THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: 'not-a-date', id: 'not-a-uuid' }),
      'utf8',
    ).toString('base64url');

    const res = await asUser(
      request(app.getHttpServer()).get(`/admin/audit-logs?cursor=${cursor}`),
      admin,
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid cursor',
    });
  });

  it('GIVEN non-admin user WHEN querying logs THEN rejects the request', async () => {
    const user = await insertUser(db);

    await asUser(request(app.getHttpServer()).get('/admin/audit-logs'), user).expect(403);
  });
});

async function insertAuditLog(
  actorId: string | null,
  overrides: Partial<typeof auditLogs.$inferInsert>,
) {
  const [row] = await db
    .insert(auditLogs)
    .values({
      actorId,
      action: 'auth.login',
      targetType: 'user',
      targetId: actorId ?? 'anonymous',
      metadata: null,
      ipAddress: '127.0.0.1',
      ...overrides,
    })
    .returning();
  return row;
}
