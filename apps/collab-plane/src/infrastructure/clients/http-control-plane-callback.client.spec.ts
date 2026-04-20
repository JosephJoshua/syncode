import {
  CONTROL_INTERNAL,
  type ParticipantHeartbeatRequest,
  type UserDisconnectedPayload,
} from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpControlPlaneCallbackClient } from './http-control-plane-callback.client.js';

const CONTROL_PLANE_URL = 'http://localhost:3000';
const INTERNAL_SECRET = 'x'.repeat(32);

const PAYLOAD: UserDisconnectedPayload = {
  roomId: 'room-1',
  userId: 'user-1',
  timestamp: Date.now(),
};

const HEARTBEAT_REQUEST: ParticipantHeartbeatRequest = {
  participants: [
    { roomId: 'room-1', userId: 'user-1' },
    { roomId: 'room-2', userId: 'user-2' },
  ],
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
    client = new HttpControlPlaneCallbackClient(CONTROL_PLANE_URL, INTERNAL_SECRET);
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

  it('GIVEN reachable control-plane WHEN heartbeating participants THEN posts to heartbeat endpoint and returns body', async () => {
    const jsonFn = vi.fn().mockResolvedValueOnce({ updated: 2 });
    mockPost.mockReturnValueOnce({ json: jsonFn });

    const result = await client.heartbeatParticipants(HEARTBEAT_REQUEST);

    expect(mockPost).toHaveBeenCalledWith(CONTROL_INTERNAL.PARTICIPANT_HEARTBEAT.route, {
      json: HEARTBEAT_REQUEST,
    });
    expect(result).toEqual({ updated: 2 });
  });

  it('GIVEN unreachable control-plane WHEN heartbeating participants THEN returns null and does not throw', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockRejectedValueOnce(new Error('Connection refused')),
    });

    const result = await client.heartbeatParticipants(HEARTBEAT_REQUEST);

    expect(result).toBeNull();
  });
});
