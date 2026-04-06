import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import { vi } from 'vitest';

export function createMockJwtService(token = 'test-collab-token') {
  return { signAsync: vi.fn().mockResolvedValue(token) };
}

export function createMockConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    COLLAB_PLANE_URL: 'http://localhost:3001',
  };
  const values = { ...defaults, ...overrides };
  return { get: vi.fn().mockImplementation((key: string) => values[key]) };
}

/**
 * Per-request auth guard for controller integration tests.
 * Reads identity from test-only headers so tests stay isolated
 * without shared mutable state.
 */
export class TestAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: req.headers['x-test-user-id'],
      email: req.headers['x-test-user-email'],
    };
    return true;
  }
}

export function asUser(agent: request.Test, user: { id: string; email: string }) {
  return agent.set('X-Test-User-Id', user.id).set('X-Test-User-Email', user.email);
}

export function createMockCollabClient() {
  return {
    createDocument: vi.fn().mockResolvedValue({ roomId: 'stub', createdAt: Date.now() }),
    destroyDocument: vi.fn().mockResolvedValue({ roomId: 'stub', finalSnapshot: undefined }),
    kickUser: vi.fn(),
    healthCheck: vi.fn(),
  };
}

export function createMockMediaService() {
  return {
    createRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    listRooms: vi.fn(),
    getRoomInfo: vi.fn(),
    generateToken: vi.fn(),
    removeParticipant: vi.fn(),
    muteParticipantTrack: vi.fn(),
    updateParticipantPermissions: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  };
}

export function createMockExecutionClient() {
  return {
    submit: vi.fn().mockResolvedValue({ jobId: 'stub-job' }),
  };
}
