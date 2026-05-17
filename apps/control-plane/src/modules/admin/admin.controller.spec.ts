import { AdminController } from './admin.controller.js';
import type { AdminService } from './admin.service.js';

const ADMIN = { id: '11111111-1111-4111-8111-111111111111' };
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

const ADMIN_USER = {
  id: TARGET_ID,
  email: 'target@example.com',
  username: 'target',
  displayName: 'Target User',
  role: 'user' as const,
  avatarUrl: null,
  bannedAt: null,
  bannedReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminController', () => {
  const service = {
    listUsers: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
  } as unknown as AdminService;

  let controller: AdminController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminController(service);
  });

  it('GIVEN admin query WHEN listing users THEN returns service result', async () => {
    const response = {
      data: [ADMIN_USER],
      pagination: { hasMore: false, nextCursor: null },
    };
    vi.mocked(service.listUsers).mockResolvedValue(response);

    await expect(controller.listUsers(ADMIN, { limit: 20 })).resolves.toEqual(response);
  });

  it('GIVEN ban payload WHEN banning user THEN returns updated user', async () => {
    const banned = {
      ...ADMIN_USER,
      bannedAt: '2026-01-02T00:00:00.000Z',
      bannedReason: 'policy',
    };
    vi.mocked(service.banUser).mockResolvedValue(banned);

    await expect(controller.banUser(ADMIN, TARGET_ID, { reason: 'policy' })).resolves.toEqual(
      banned,
    );
  });

  it('GIVEN unban request WHEN unbanning user THEN returns updated user', async () => {
    vi.mocked(service.unbanUser).mockResolvedValue(ADMIN_USER);

    await expect(controller.unbanUser(ADMIN, TARGET_ID)).resolves.toEqual(ADMIN_USER);
  });
});
