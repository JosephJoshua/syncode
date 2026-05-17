import type { Database } from '@syncode/db';
import { auditLogs } from '@syncode/db';
import { eq } from 'drizzle-orm';
import { createTestDb, insertUser } from '@/test/integration-setup.js';
import { AuditService } from './audit.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: AuditService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  service = new AuditService(db);
});

afterEach(async () => {
  await cleanup();
});

describe('AuditService.log', () => {
  it('GIVEN audit input WHEN logging THEN persists an audit row', async () => {
    const actor = await insertUser(db);

    await service.log({
      actorId: actor.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: actor.id,
      metadata: { identifierType: 'email' },
      ipAddress: '127.0.0.1',
    });

    const row = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.actorId, actor.id),
    });

    expect(row).toMatchObject({
      actorId: actor.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: actor.id,
      metadata: { identifierType: 'email' },
      ipAddress: '127.0.0.1',
    });
  });
});
