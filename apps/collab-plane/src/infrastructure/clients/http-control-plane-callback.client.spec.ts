import {
  CONTROL_INTERNAL,
  type ParticipantHeartbeatRequest,
  type PersistDocSnapshotPayload,
  type SnapshotReadyPayload,
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

const SNAPSHOT_READY_PAYLOAD: SnapshotReadyPayload = {
  roomId: 'room-1',
  snapshot: [1, 2, 3],
  code: 'print("ok")',
  language: 'python',
  timestamp: Date.now(),
  trigger: 'session_end',
  phase: 'finished',
};

const DOC_SNAPSHOT_PAYLOAD: PersistDocSnapshotPayload = {
  state: [1, 2, 3],
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

  it('GIVEN reachable control-plane WHEN notifying snapshot ready THEN posts to snapshot endpoint', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockResolvedValueOnce({ success: true }),
    });

    await client.notifySnapshotReady(SNAPSHOT_READY_PAYLOAD);

    expect(mockPost).toHaveBeenCalledWith(CONTROL_INTERNAL.SNAPSHOT_READY.route, {
      json: SNAPSHOT_READY_PAYLOAD,
    });
  });

  it('GIVEN control-plane rejects snapshot ready WHEN notifying THEN rethrows', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockResolvedValueOnce({ success: false }),
    });

    await expect(client.notifySnapshotReady(SNAPSHOT_READY_PAYLOAD)).rejects.toThrow(
      'Control-plane rejected code snapshot for room room-1',
    );
  });

  it('GIVEN unreachable control-plane WHEN notifying snapshot ready THEN rethrows', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockRejectedValueOnce(new Error('Connection refused')),
    });

    await expect(client.notifySnapshotReady(SNAPSHOT_READY_PAYLOAD)).rejects.toThrow(
      'Connection refused',
    );
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

  it('GIVEN reachable control-plane WHEN authorizing join THEN posts to room-scoped endpoint and returns body', async () => {
    const jsonFn = vi.fn().mockResolvedValueOnce({ authorized: true });
    mockPost.mockReturnValueOnce({ json: jsonFn });

    const result = await client.authorizeJoin('room-abc', 'user-xyz');

    expect(mockPost).toHaveBeenCalledWith('internal/rooms/room-abc/authorize-join', {
      json: { userId: 'user-xyz' },
    });
    expect(result).toEqual({ authorized: true });
  });

  it('GIVEN unreachable control-plane WHEN authorizing join THEN fails closed with authorized=false', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockRejectedValueOnce(new Error('Connection refused')),
    });

    const result = await client.authorizeJoin('room-abc', 'user-xyz');

    expect(result).toEqual({ authorized: false });
  });

  it('GIVEN reachable control-plane WHEN persisting doc snapshot THEN posts to room-scoped endpoint', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockResolvedValueOnce({ success: true }),
    });

    await client.persistDocSnapshot('room-abc', DOC_SNAPSHOT_PAYLOAD);

    expect(mockPost).toHaveBeenCalledWith('internal/rooms/room-abc/doc-snapshot', {
      json: DOC_SNAPSHOT_PAYLOAD,
    });
  });

  it('GIVEN control-plane rejects doc snapshot WHEN persisting THEN rethrows', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockResolvedValueOnce({ success: false }),
    });

    await expect(client.persistDocSnapshot('room-abc', DOC_SNAPSHOT_PAYLOAD)).rejects.toThrow(
      'Control-plane rejected doc snapshot for room room-abc',
    );
  });

  it('GIVEN unreachable control-plane WHEN persisting doc snapshot THEN rethrows', async () => {
    mockPost.mockReturnValueOnce({
      json: vi.fn().mockRejectedValueOnce(new Error('Connection refused')),
    });

    await expect(client.persistDocSnapshot('room-abc', DOC_SNAPSHOT_PAYLOAD)).rejects.toThrow(
      'Connection refused',
    );
  });
});
