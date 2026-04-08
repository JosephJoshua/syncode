import { CONTROL_INTERNAL, type UserDisconnectedPayload } from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpControlPlaneCallbackClient } from './http-control-plane-callback.client.js';

const CONTROL_PLANE_URL = 'http://localhost:3000';

const PAYLOAD: UserDisconnectedPayload = {
  roomId: 'room-1',
  userId: 'user-1',
  timestamp: Date.now(),
};

// Mock ky at the module level
const mockPost = vi.fn();

vi.mock('ky', () => ({
  default: {
    create: () => ({
      post: mockPost,
    }),
  },
}));

describe('HttpControlPlaneCallbackClient', () => {
  let client: HttpControlPlaneCallbackClient;

  beforeEach(() => {
    client = new HttpControlPlaneCallbackClient(CONTROL_PLANE_URL);
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN reachable control-plane WHEN notifying user disconnect THEN posts to correct endpoint', async () => {
    mockPost.mockResolvedValueOnce({});

    await client.notifyUserDisconnected(PAYLOAD);

    expect(mockPost).toHaveBeenCalledWith(CONTROL_INTERNAL.USER_DISCONNECTED.route, {
      json: PAYLOAD,
    });
  });

  it('GIVEN unreachable control-plane WHEN notifying user disconnect THEN does not throw', async () => {
    mockPost.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(client.notifyUserDisconnected(PAYLOAD)).resolves.toBeUndefined();
  });
});
