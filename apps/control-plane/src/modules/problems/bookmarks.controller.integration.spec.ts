import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { bookmarks } from '@syncode/db';
import { and, eq } from 'drizzle-orm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DB_CLIENT } from '@/modules/db/db.module';
import { createTestDb, insertProblem, insertUser } from '@/test/integration-setup';
import { asUser, TestAuthGuard } from '@/test/mock-factories';
import { BookmarksController } from './bookmarks.controller.js';
import { ProblemsService } from './problems.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [BookmarksController],
    providers: [ProblemsService, { provide: DB_CLIENT, useValue: db }],
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

describe('GET /users/me/bookmarks', () => {
  it('GIVEN bookmarked problems WHEN listing THEN returns 200 with problem summaries and pagination', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { company: 'Meta' });
    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    const res = await asUser(request(app.getHttpServer()).get('/users/me/bookmarks'), user).expect(
      200,
    );

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      company: 'Meta',
      isBookmarked: true,
    });
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('GIVEN no bookmarks WHEN listing THEN returns 200 with empty data', async () => {
    const user = await insertUser(db);

    const res = await asUser(request(app.getHttpServer()).get('/users/me/bookmarks'), user).expect(
      200,
    );

    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it('GIVEN limit query param WHEN listing THEN respects pagination limit', async () => {
    const user = await insertUser(db);

    for (let i = 0; i < 3; i++) {
      const problem = await insertProblem(db);
      await db.insert(bookmarks).values({
        userId: user.id,
        problemId: problem.id,
        createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      });
    }

    const res = await asUser(
      request(app.getHttpServer()).get('/users/me/bookmarks?limit=2'),
      user,
    ).expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.pagination.nextCursor).toEqual(expect.any(String));
  });
});

describe('PUT /users/me/bookmarks/:problemId', () => {
  it('GIVEN existing problem WHEN adding bookmark THEN returns 204 and persists bookmark', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);

    await asUser(
      request(app.getHttpServer()).put(`/users/me/bookmarks/${problem.id}`),
      user,
    ).expect(204);

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.problemId, problem.id)));

    expect(rows).toHaveLength(1);
  });

  it('GIVEN non-existent problem WHEN adding bookmark THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).put('/users/me/bookmarks/00000000-0000-0000-0000-000000000000'),
      user,
    ).expect(404);
  });

  it('GIVEN invalid UUID WHEN adding bookmark THEN returns 400', async () => {
    const user = await insertUser(db);

    await asUser(request(app.getHttpServer()).put('/users/me/bookmarks/not-a-uuid'), user).expect(
      400,
    );
  });
});

describe('DELETE /users/me/bookmarks/:problemId', () => {
  it('GIVEN existing bookmark WHEN removing THEN returns 204 and deletes bookmark', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    await asUser(
      request(app.getHttpServer()).delete(`/users/me/bookmarks/${problem.id}`),
      user,
    ).expect(204);

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.problemId, problem.id)));

    expect(rows).toHaveLength(0);
  });

  it('GIVEN no existing bookmark WHEN removing THEN returns 204 (idempotent)', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).delete(
        '/users/me/bookmarks/00000000-0000-0000-0000-000000000000',
      ),
      user,
    ).expect(204);
  });
});
