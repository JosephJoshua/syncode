import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { auditLogs, type Database } from '@syncode/db';
import { eq } from 'drizzle-orm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertProblem,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import { asUser, TestAuthGuard } from '@/test/mock-factories.js';
import { AuditService } from '../admin/audit.service.js';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [ProblemsController],
    providers: [ProblemsService, AuditService, { provide: DB_CLIENT, useValue: db }],
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

describe('GET /problems', () => {
  it('GIVEN comma-separated difficulty filters WHEN listing THEN returns the union of matching difficulties', async () => {
    const user = await insertUser(db);
    const easy = await insertProblem(db, { title: 'Easy', difficulty: 'easy' });
    const medium = await insertProblem(db, { title: 'Medium', difficulty: 'medium' });
    await insertProblem(db, { title: 'Hard', difficulty: 'hard' });

    const res = await asUser(
      request(app.getHttpServer()).get(
        '/problems?difficulty=easy,medium&sortBy=difficulty&sortOrder=asc',
      ),
      user,
    ).expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((problem: { id: string }) => problem.id)).toEqual([
      easy.id,
      medium.id,
    ]);
    expect(res.body.data.map((problem: { difficulty: string }) => problem.difficulty)).toEqual([
      'easy',
      'medium',
    ]);
  });

  it('GIVEN repeated difficulty query params WHEN listing THEN returns the union of matching difficulties', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Easy', difficulty: 'easy' });
    await insertProblem(db, { title: 'Medium', difficulty: 'medium' });
    const hard = await insertProblem(db, { title: 'Hard', difficulty: 'hard' });

    const res = await asUser(
      request(app.getHttpServer()).get(
        '/problems?difficulty=easy&difficulty=hard&sortBy=difficulty&sortOrder=asc',
      ),
      user,
    ).expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((problem: { difficulty: string }) => problem.difficulty)).toEqual([
      'easy',
      'hard',
    ]);
    expect(res.body.data[1].id).toBe(hard.id);
  });

  it('GIVEN problem test cases WHEN listing as admin THEN includes admin-only test counts', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const user = await insertUser(db, { role: 'user' });
    const problem = await insertProblem(db, { title: 'Counted Cases' });
    await insertTestCase(db, problem.id, { isHidden: false });
    await insertTestCase(db, problem.id, { isHidden: true });
    await insertTestCase(db, problem.id, { isHidden: true });

    const adminRes = await asUser(
      request(app.getHttpServer()).get('/problems?search=Counted%20Cases&includeDrafts=true'),
      admin,
    ).expect(200);
    const userRes = await asUser(
      request(app.getHttpServer()).get('/problems?search=Counted%20Cases'),
      user,
    ).expect(200);

    expect(adminRes.body.data).toHaveLength(1);
    expect(adminRes.body.data[0]).toMatchObject({
      id: problem.id,
      testCaseCount: 3,
      hiddenTestCaseCount: 2,
    });
    expect(userRes.body.data).toHaveLength(1);
    expect(userRes.body.data[0]).not.toHaveProperty('testCaseCount');
    expect(userRes.body.data[0]).not.toHaveProperty('hiddenTestCaseCount');
  });

  it('GIVEN draft problem WHEN listing as admin THEN drafts require explicit includeDrafts', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    await insertProblem(db, { title: 'Published', isPublished: true });
    await insertProblem(db, { title: 'Draft', isPublished: false });

    const defaultRes = await asUser(
      request(app.getHttpServer()).get('/problems?sortBy=title&sortOrder=asc'),
      admin,
    ).expect(200);
    const draftRes = await asUser(
      request(app.getHttpServer()).get('/problems?sortBy=title&sortOrder=asc&includeDrafts=true'),
      admin,
    ).expect(200);

    expect(defaultRes.body.data.map((problem: { title: string }) => problem.title)).toEqual([
      'Published',
    ]);
    expect(draftRes.body.data.map((problem: { title: string }) => problem.title)).toEqual([
      'Draft',
      'Published',
    ]);
  });
});

describe('POST /problems', () => {
  const payload = {
    title: 'Admin Two Sum',
    description: 'Return indices of two values.',
    difficulty: 'easy',
    isPublished: false,
    company: 'syncode',
    constraints: 'n >= 2',
    starterCode: { typescript: 'function solve() {}' },
    timeLimit: 1500,
    memoryLimit: 256,
    testCases: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        expectedOutput: '[0,1]',
        isHidden: false,
      },
      {
        input: 'nums = [3,2,4], target = 6',
        expectedOutput: '[1,2]',
        isHidden: true,
      },
    ],
  };

  it('GIVEN admin user WHEN creating a draft problem THEN persists problem and test cases', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const res = await asUser(request(app.getHttpServer()).post('/problems'), admin)
      .send(payload)
      .expect(201);

    expect(res.body).toMatchObject({
      title: payload.title,
      description: payload.description,
      difficulty: payload.difficulty,
      isPublished: false,
      company: payload.company,
      constraints: payload.constraints,
      starterCode: payload.starterCode,
      timeLimit: payload.timeLimit,
      memoryLimit: payload.memoryLimit,
    });
    expect(res.body.testCases).toEqual([
      expect.objectContaining({
        input: payload.testCases[0].input,
        expectedOutput: payload.testCases[0].expectedOutput,
        isHidden: false,
      }),
      expect.objectContaining({
        input: payload.testCases[1].input,
        expectedOutput: payload.testCases[1].expectedOutput,
        isHidden: true,
      }),
    ]);
  });

  it('GIVEN non-admin user WHEN creating a problem THEN returns 403', async () => {
    const user = await insertUser(db, { role: 'user' });

    await asUser(request(app.getHttpServer()).post('/problems'), user).send(payload).expect(403);
  });

  it('GIVEN draft problem WHEN regular user fetches it THEN returns 404 but admin can fetch it', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const user = await insertUser(db, { role: 'user' });

    const created = await asUser(request(app.getHttpServer()).post('/problems'), admin)
      .send(payload)
      .expect(201);

    await asUser(request(app.getHttpServer()).get(`/problems/${created.body.id}`), user).expect(
      404,
    );

    await asUser(request(app.getHttpServer()).get(`/problems/${created.body.id}`), admin).expect(
      200,
    );
  });

  it('GIVEN admin problem mutations WHEN they succeed THEN writes complete audit entries', async () => {
    const admin = await insertUser(db, { role: 'admin' });

    const created = await asUser(request(app.getHttpServer()).post('/problems'), admin)
      .send(payload)
      .expect(201);

    await asUser(request(app.getHttpServer()).patch(`/problems/${created.body.id}`), admin)
      .send({ title: 'Audited Admin Two Sum' })
      .expect(200);

    await asUser(
      request(app.getHttpServer()).patch(`/problems/${created.body.id}/publish-status`),
      admin,
    )
      .send({ isPublished: true })
      .expect(200);

    await asUser(
      request(app.getHttpServer()).patch(`/problems/${created.body.id}/publish-status`),
      admin,
    )
      .send({ isPublished: false })
      .expect(200);

    await asUser(request(app.getHttpServer()).delete(`/problems/${created.body.id}`), admin).expect(
      204,
    );

    const entries = await db
      .select({
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(eq(auditLogs.targetId, created.body.id));

    expect(entries.map((entry) => entry.action).sort()).toEqual([
      'admin.problem.create',
      'admin.problem.delete',
      'admin.problem.publish',
      'admin.problem.unpublish',
      'admin.problem.update',
    ]);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'admin.problem.create',
          actorId: admin.id,
          targetType: 'problem',
          targetId: created.body.id,
          metadata: expect.objectContaining({
            title: payload.title,
            testCaseCount: 2,
            hiddenTestCaseCount: 1,
          }),
        }),
        expect.objectContaining({
          action: 'admin.problem.update',
          metadata: expect.objectContaining({ changedFields: ['title'] }),
        }),
        expect.objectContaining({
          action: 'admin.problem.publish',
          metadata: expect.objectContaining({ previousIsPublished: false, isPublished: true }),
        }),
        expect.objectContaining({
          action: 'admin.problem.unpublish',
          metadata: expect.objectContaining({ previousIsPublished: true, isPublished: false }),
        }),
        expect.objectContaining({
          action: 'admin.problem.delete',
          metadata: expect.objectContaining({ wasPublished: false }),
        }),
      ]),
    );
  });
});

describe('PATCH /problems/:id', () => {
  it('GIVEN admin user WHEN updating a problem THEN replaces editable fields and returns hidden test cases', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const problem = await insertProblem(db, { title: 'Original', isPublished: false });
    await insertTestCase(db, problem.id, { input: 'old', expectedOutput: 'old' });

    const res = await asUser(request(app.getHttpServer()).patch(`/problems/${problem.id}`), admin)
      .send({
        title: 'Updated',
        description: 'Updated description',
        testCases: [
          {
            input: 'visible input',
            expectedOutput: 'visible output',
            isHidden: false,
          },
          {
            input: 'hidden input',
            expectedOutput: 'hidden output',
            isHidden: true,
          },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({
      id: problem.id,
      title: 'Updated',
      description: 'Updated description',
    });
    expect(res.body.testCases).toEqual([
      expect.objectContaining({ input: 'visible input', isHidden: false }),
      expect.objectContaining({ input: 'hidden input', isHidden: true }),
    ]);
  });
});

describe('PATCH /problems/:id/publish-status', () => {
  it('GIVEN draft problem WHEN admin publishes it THEN regular users can fetch it', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const user = await insertUser(db, { role: 'user' });
    const problem = await insertProblem(db, { isPublished: false });
    await insertTestCase(db, problem.id, { isHidden: false });

    await asUser(request(app.getHttpServer()).get(`/problems/${problem.id}`), user).expect(404);

    await asUser(
      request(app.getHttpServer()).patch(`/problems/${problem.id}/publish-status`),
      admin,
    )
      .send({ isPublished: true })
      .expect(200);

    await asUser(request(app.getHttpServer()).get(`/problems/${problem.id}`), user).expect(200);
  });
});

describe('DELETE /problems/:id', () => {
  it('GIVEN existing problem WHEN admin deletes it THEN it is no longer fetchable', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const problem = await insertProblem(db);

    await asUser(request(app.getHttpServer()).delete(`/problems/${problem.id}`), admin).expect(204);

    await asUser(request(app.getHttpServer()).get(`/problems/${problem.id}`), admin).expect(404);
  });
});
