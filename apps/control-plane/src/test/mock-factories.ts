import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
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
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const id = req.headers['x-test-user-id'];
    const email = req.headers['x-test-user-email'];
    if (!id || !email) {
      throw new UnauthorizedException({ message: 'Unauthorized' });
    }
    req.user = { id, email };
    return true;
  }
}

export function asUser(agent: request.Test, user: { id: string; email: string }) {
  return agent.set('X-Test-User-Id', user.id).set('X-Test-User-Email', user.email);
}

export function createMockCollabClient() {
  return {
    createDocument: vi
      .fn()
      .mockResolvedValue({ roomId: 'stub', createdAt: Date.now(), created: true }),
    destroyDocument: vi.fn().mockResolvedValue({ roomId: 'stub', finalSnapshot: undefined }),
    kickUser: vi.fn(),
    updateRoomState: vi.fn().mockResolvedValue({ success: true }),
    broadcastParticipantReady: vi.fn().mockResolvedValue({ success: true }),
    changeLanguage: vi.fn().mockResolvedValue({ success: true }),
    getRoomChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
    healthCheck: vi.fn().mockResolvedValue(true),
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
    getResult: vi.fn().mockResolvedValue(null),
    getJobStatus: vi.fn().mockResolvedValue('queued'),
    submitStaticAnalysis: vi
      .fn()
      .mockImplementation((_request, options) =>
        Promise.resolve({ jobId: options?.idempotencyKey ?? 'static-analysis-job' }),
      ),
    getStaticAnalysisResult: vi.fn().mockResolvedValue(null),
    getStaticAnalysisJobStatus: vi.fn().mockResolvedValue('queued'),
    cancel: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    onResult: vi.fn(),
    onStaticAnalysisResult: vi.fn(),
  };
}

export function createMockAiClient() {
  return {
    submitHintRequest: vi.fn().mockResolvedValue({ jobId: 'ai-hint-job' }),
    getHintResult: vi.fn().mockResolvedValue({
      hint: 'Try tracking complements in a hash map to reduce repeated scans.',
      reflectionPrompt: 'What value do you need to look up at each iteration?',
    }),
    submitCodeAnalysisRequest: vi.fn().mockResolvedValue({ jobId: 'ai-code-analysis-job' }),
    getCodeAnalysisResult: vi.fn().mockResolvedValue(null),
    submitWeaknessAnalysisRequest: vi.fn().mockResolvedValue({ jobId: 'ai-weakness-analysis-job' }),
    getWeaknessAnalysisResult: vi.fn().mockResolvedValue(null),
    submitReviewRequest: vi.fn().mockResolvedValue({ jobId: 'ai-review-job' }),
    getReviewResult: vi.fn().mockResolvedValue(null),
    submitInterviewResponse: vi
      .fn()
      .mockImplementation((request) =>
        Promise.resolve({ jobId: request.idempotencyKey ?? 'ai-interview-job' }),
      ),
    getInterviewResult: vi.fn().mockResolvedValue(null),
    submitInterviewTranscription: vi
      .fn()
      .mockResolvedValue({ jobId: 'ai-interview-transcription' }),
    getInterviewTranscriptionResult: vi.fn().mockResolvedValue({ text: 'stub transcript' }),
    submitSessionReportRequest: vi.fn().mockResolvedValue({ jobId: 'session-report-job' }),
    getSessionReportResult: vi.fn().mockResolvedValue(null),
    onSessionReportResult: vi.fn(),
    onWeaknessAnalysisResult: vi.fn(),
    onInterviewResult: vi.fn(),
    getHintJobStatus: vi.fn().mockResolvedValue('completed'),
    getCodeAnalysisJobStatus: vi.fn().mockResolvedValue('queued'),
    getWeaknessAnalysisJobStatus: vi.fn().mockResolvedValue('queued'),
    getReviewJobStatus: vi.fn().mockResolvedValue('queued'),
    getInterviewJobStatus: vi.fn().mockResolvedValue('queued'),
    getInterviewTranscriptionJobStatus: vi.fn().mockResolvedValue('queued'),
    getSessionReportJobStatus: vi.fn().mockResolvedValue('queued'),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

export function createMockSessionReportsService() {
  return {
    enqueueForFinishedSession: vi.fn().mockResolvedValue(undefined),
    handleResult: vi.fn().mockResolvedValue(undefined),
    handleWeaknessAnalysisResult: vi.fn().mockResolvedValue(undefined),
    getReport: vi.fn(),
  };
}

export function createMockStorageService() {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue(Buffer.from('')),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue({ deleted: [], failed: [] }),
    exists: vi.fn().mockResolvedValue(false),
    getMetadata: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ keys: [], isTruncated: false }),
    copy: vi.fn().mockResolvedValue(undefined),
    getUploadUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-put'),
    getDownloadUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-get'),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}
