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
