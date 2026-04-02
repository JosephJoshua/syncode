import { vi } from 'vitest';

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
