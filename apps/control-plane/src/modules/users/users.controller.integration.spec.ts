import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DB_CLIENT } from '@/modules/db/db.module';
import { createTestDb, insertUser } from '@/test/integration-setup';
import { createMockConfigService } from '@/test/mock-factories';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const ACCESS_TOKEN_SECRET = 'access-secret-access-secret-123456';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let jwtService: JwtService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  jwtService = new JwtService({
    secret: ACCESS_TOKEN_SECRET,
    signOptions: { expiresIn: '15m' },
  });

  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [UsersController],
    providers: [
      UsersService,
      JwtAuthGuard,
      JwtStrategy,
      { provide: DB_CLIENT, useValue: db },
      {
        provide: ConfigService,
        useValue: createMockConfigService({
          AUTH_JWT_SECRET: ACCESS_TOKEN_SECRET,
        }),
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

describe('GET /users/me', () => {
  it('GIVEN valid bearer token WHEN fetching current profile THEN returns the authenticated user', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      stats: {
        totalSessions: 0,
        totalProblems: 0,
        streakDays: 0,
      },
    });
  });

  it('GIVEN no bearer token WHEN fetching current profile THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });
});
