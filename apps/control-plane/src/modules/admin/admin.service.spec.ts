import { InternalServerErrorException } from '@nestjs/common';
import type { Database } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';
import type { AuditService } from './audit.service.js';

function createServiceWithAuditFailure() {
  const returning = vi.fn().mockResolvedValue([
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'target@example.com',
      username: 'target',
      displayName: null,
      role: 'user',
      avatarUrl: null,
      bannedAt: new Date('2026-01-01T00:00:00.000Z'),
      bannedReason: 'policy',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning,
      })),
    })),
  }));
  const insert = vi.fn(() => ({
    values: vi.fn(async () => {
      throw new InternalServerErrorException('audit unavailable');
    }),
  }));
  const tx = { update, insert };
  const auditService = {
    log: vi.fn(async () => undefined),
    logWithClient: vi.fn(async (client: typeof tx) => client.insert({}).values({})),
  };
  const db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ role: 'admin', bannedAt: null }),
      },
    },
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return {
    service: new AdminService(db as unknown as Database, auditService as unknown as AuditService),
    mocks: { db, tx, returning, update, insert, auditService },
  };
}

describe('AdminService', () => {
  it('GIVEN audit insert fails WHEN banning a user THEN rejects instead of silently applying an unaudited admin mutation', async () => {
    const { service, mocks } = createServiceWithAuditFailure();

    await expect(
      service.banUser(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        {
          reason: 'policy',
        },
      ),
    ).rejects.toThrow('audit unavailable');

    expect(mocks.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.auditService.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('GIVEN audit insert fails WHEN unbanning a user THEN rejects instead of silently applying an unaudited admin mutation', async () => {
    const { service, mocks } = createServiceWithAuditFailure();

    await expect(
      service.unbanUser(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow('audit unavailable');

    expect(mocks.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.auditService.logWithClient).toHaveBeenCalledTimes(1);
  });
});
