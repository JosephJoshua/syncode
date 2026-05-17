import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { createTestDb, insertProblem, insertUser } from '@/test/integration-setup.js';
import { asUser, TestAuthGuard } from '@/test/mock-factories.js';
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
    expect(res.body.testCases).toHaveLength(1);
    expect(res.body.testCases[0]).toMatchObject({
      input: payload.testCases[0].input,
      expectedOutput: payload.testCases[0].expectedOutput,
      isHidden: false,
    });
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
});
