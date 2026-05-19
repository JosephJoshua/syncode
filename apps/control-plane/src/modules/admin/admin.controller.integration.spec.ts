import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { auditLogs, type Database, users } from '@syncode/db';
import { eq } from 'drizzle-orm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { createTestDb, insertUser } from '@/test/integration-setup.js';
import { asUser, TestAuthGuard } from '@/test/mock-factories.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuditService } from './audit.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [AdminController],
    providers: [AdminService, AuditService, { provide: DB_CLIENT, useValue: db }],
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

describe('GET /admin/users', () => {
  it('GIVEN admin user WHEN listing users THEN returns a paginated user list', async () => {
    const admin = await insertUser(db, {
      role: 'admin',
      createdAt: new Date('2025-12-31T00:00:00.000Z'),
    });
    const first = await insertUser(db, {
      email: 'first@example.com',
      username: 'first',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const second = await insertUser(db, {
      email: 'second@example.com',
      username: 'second',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const firstPage = await asUser(
      request(app.getHttpServer()).get('/admin/users?limit=2'),
      admin,
    ).expect(200);

    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.data.map((user: { id: string }) => user.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(firstPage.body.pagination).toMatchObject({ hasMore: true });
    expect(firstPage.body.pagination.nextCursor).toEqual(expect.any(String));

    const secondPage = await asUser(
      request(app.getHttpServer()).get(
        `/admin/users?limit=2&cursor=${firstPage.body.pagination.nextCursor}`,
      ),
      admin,
    ).expect(200);

    expect(secondPage.body.data.map((user: { id: string }) => user.id)).toEqual([admin.id]);
    expect(secondPage.body.pagination).toEqual({ hasMore: false, nextCursor: null });
  });

  it('GIVEN search and banned status filters WHEN listing users THEN only matching users return', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const banned = await insertUser(db, {
      email: 'target@example.com',
      username: 'target-user',
      displayName: 'Target User',
      bannedAt: new Date(),
      bannedReason: 'policy',
    });
    await insertUser(db, {
      email: 'target-active@example.com',
      username: 'target-active',
      displayName: 'Target Active',
    });

    const res = await asUser(
      request(app.getHttpServer()).get('/admin/users?search=target&status=banned'),
      admin,
    ).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: banned.id,
      email: 'target@example.com',
      bannedReason: 'policy',
    });
    expect(res.body.data[0].bannedAt).toEqual(expect.any(String));
  });

  it('GIVEN non-admin user WHEN listing users THEN rejects the request', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).get('/admin/users?limit=20'),
      user,
    ).expect(403);

    expect(res.body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  });

  it('GIVEN malformed cursor WHEN listing users THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(
      request(app.getHttpServer()).get('/admin/users?cursor=not-a-valid-cursor'),
      admin,
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid cursor',
    });
  });

  it('GIVEN cursor with invalid fields WHEN listing users THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: 'not-a-date', id: 'not-a-uuid' }),
      'utf8',
    ).toString('base64url');

    const res = await asUser(
      request(app.getHttpServer()).get(`/admin/users?cursor=${cursor}`),
      admin,
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid cursor',
    });
  });
});

describe('PATCH /admin/users/:id/ban', () => {
  it('GIVEN admin user WHEN banning an account THEN persists banned fields', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const target = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).patch(`/admin/users/${target.id}/ban`).send({
        reason: 'Repeated abuse',
      }),
      admin,
    ).expect(200);

    expect(res.body).toMatchObject({
      id: target.id,
      bannedAt: expect.any(String),
      bannedReason: 'Repeated abuse',
    });

    const row = await db.query.users.findFirst({
      columns: { bannedAt: true, bannedReason: true },
      where: eq(users.id, target.id),
    });
    expect(row?.bannedAt).toBeInstanceOf(Date);
    expect(row?.bannedReason).toBe('Repeated abuse');

    const auditLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.targetId, target.id),
    });
    expect(auditLog).toMatchObject({
      actorId: admin.id,
      action: 'admin.user.ban',
      targetType: 'user',
      targetId: target.id,
      metadata: { reason: 'Repeated abuse' },
    });
  });

  it('GIVEN trusted proxy forwarding WHEN banning an account THEN records forwarded client IP', async () => {
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
    const admin = await insertUser(db, { role: 'admin' });
    const target = await insertUser(db);

    await asUser(
      request(app.getHttpServer())
        .patch(`/admin/users/${target.id}/ban`)
        .set('X-Forwarded-For', '198.51.100.20')
        .send({ reason: 'policy' }),
      admin,
    ).expect(200);

    const auditLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.targetId, target.id),
    });
    expect(auditLog?.ipAddress).toBe('198.51.100.20');
  });

  it('GIVEN non-admin user WHEN banning an account THEN rejects the request', async () => {
    const actor = await insertUser(db);
    const target = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).patch(`/admin/users/${target.id}/ban`).send({}),
      actor,
    ).expect(403);

    expect(res.body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  });

  it('GIVEN admin user WHEN banning their own account THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(
      request(app.getHttpServer()).patch(`/admin/users/${admin.id}/ban`).send({}),
      admin,
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Admins cannot ban their own account',
    });
  });

  it('GIVEN malformed user id WHEN banning an account THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(
      request(app.getHttpServer()).patch('/admin/users/not-a-uuid/ban').send({}),
      admin,
    ).expect(400);

    expect(res.body.message).toContain('uuid');
  });
});

describe('PATCH /admin/users/:id/unban', () => {
  it('GIVEN admin user WHEN unbanning an account THEN clears banned fields', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const target = await insertUser(db, {
      bannedAt: new Date(),
      bannedReason: 'policy',
    });

    const res = await asUser(
      request(app.getHttpServer()).patch(`/admin/users/${target.id}/unban`),
      admin,
    ).expect(200);

    expect(res.body).toMatchObject({
      id: target.id,
      bannedAt: null,
      bannedReason: null,
    });

    const row = await db.query.users.findFirst({
      columns: { bannedAt: true, bannedReason: true },
      where: eq(users.id, target.id),
    });
    expect(row).toMatchObject({
      bannedAt: null,
      bannedReason: null,
    });

    const auditLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.targetId, target.id),
    });
    expect(auditLog).toMatchObject({
      actorId: admin.id,
      action: 'admin.user.unban',
      targetType: 'user',
      targetId: target.id,
      metadata: null,
    });
  });

  it('GIVEN malformed user id WHEN unbanning an account THEN rejects the request', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(
      request(app.getHttpServer()).patch('/admin/users/not-a-uuid/unban'),
      admin,
    ).expect(400);

    expect(res.body.message).toContain('uuid');
  });
});
