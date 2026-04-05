import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { CACHE_SERVICE, type ICacheService, type TtlResult } from '@syncode/shared/ports';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { DB_CLIENT } from '@/modules/db/db.module';
import { createTestDb } from '@/test/integration-setup';
import { createMockConfigService } from '@/test/mock-factories';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const ACCESS_TOKEN_SECRET = 'access-secret-access-secret-123456';
const REFRESH_TOKEN_SECRET = 'refresh-secret-refresh-secret-1234';

class InMemoryCacheService implements ICacheService {
  private readonly values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    let deleted = 0;

    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) {
        this.values.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    return this.values.has(key);
  }

  async getTtl(key: string): Promise<TtlResult> {
    return this.values.has(key) ? { state: 'permanent' } : { state: 'missing' };
  }

  async incrBy(key: string, amount = 1): Promise<number> {
    const nextValue = (Number(this.values.get(key) ?? 0) || 0) + amount;
    this.values.set(key, nextValue);
    return nextValue;
  }

  async setIfNotExists<T = unknown>(key: string, value: T): Promise<boolean> {
    if (this.values.has(key)) {
      return false;
    }

    this.values.set(key, value);
    return true;
  }

  async expire(key: string): Promise<boolean> {
    return this.values.has(key);
  }

  async shutdown(): Promise<void> {}
}

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

function getRefreshTokenCookie(setCookieHeader: string[] | undefined): string {
  const cookie = setCookieHeader?.find((header) => header.startsWith('refreshToken='));
  if (!cookie) {
    throw new Error('Expected refreshToken cookie in response');
  }

  const [cookiePair] = cookie.split(';');
  if (!cookiePair) {
    throw new Error('Expected refreshToken cookie pair in response');
  }

  return cookiePair;
}

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AuthService,
      { provide: DB_CLIENT, useValue: db },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      {
        provide: JwtService,
        useValue: new JwtService({
          secret: ACCESS_TOKEN_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      },
      {
        provide: ConfigService,
        useValue: createMockConfigService({
          AUTH_JWT_SECRET: ACCESS_TOKEN_SECRET,
          JWT_REFRESH_SECRET: REFRESH_TOKEN_SECRET,
          JWT_EXPIRATION: '15m',
          JWT_REFRESH_EXPIRATION: '7d',
        }),
      },
    ],
  }).compile();

  app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

describe('POST /auth/register', () => {
  it('GIVEN valid payload WHEN registering THEN returns token pair payload and refresh cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'alice@example.com',
      username: 'alice_sync',
      displayName: null,
      role: 'user',
    });
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=')]),
    );
  });

  it('GIVEN duplicate email WHEN registering THEN returns 409', async () => {
    const agent = request(app.getHttpServer());

    await agent.post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });

    const res = await agent.post('/auth/register').send({
      username: 'alice_sync_2',
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('GIVEN stored credentials WHEN logging in THEN returns access token, user payload, and refresh cookie', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });

    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: 'alice@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=')]),
    );
  });

  it('GIVEN wrong password WHEN logging in THEN returns 401', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });

    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: 'alice@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('GIVEN refresh cookie WHEN refreshing THEN returns a new access token and rotated cookie', async () => {
    const registerResponse = await request(app.getHttpServer()).post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });

    const firstRefreshCookie = getRefreshTokenCookie(registerResponse.headers['set-cookie']);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstRefreshCookie);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    const rotatedRefreshCookie = getRefreshTokenCookie(refreshResponse.headers['set-cookie']);

    expect(rotatedRefreshCookie).toBeDefined();
    expect(rotatedRefreshCookie).not.toBe(firstRefreshCookie);
  });
});

describe('POST /auth/logout', () => {
  it('GIVEN refresh cookie WHEN logging out THEN clears cookie and rejects later refresh attempts', async () => {
    const registerResponse = await request(app.getHttpServer()).post('/auth/register').send({
      username: 'alice_sync',
      email: 'alice@example.com',
      password: 'secret123',
    });
    const refreshTokenCookie = getRefreshTokenCookie(registerResponse.headers['set-cookie']);

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshTokenCookie);

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=;')]),
    );

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshTokenCookie);
    expect(refreshResponse.status).toBe(401);
  });
});
