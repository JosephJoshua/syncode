import { describe, expect, test } from 'vitest';
import {
  browseRoomsQuerySchema,
  browseRoomsResponseSchema,
  changeRoomLanguageSchema,
  requestRoomAiInterviewTranscriptionSchema,
} from './rooms.js';

describe('browseRoomsQuerySchema', () => {
  test('GIVEN empty input WHEN parsed THEN defaults from paginationQuerySchema are applied', () => {
    const result = browseRoomsQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.sortOrder).toBe('desc');
    expect(result.status).toBeUndefined();
    expect(result.language).toBeUndefined();
    expect(result.difficulty).toBeUndefined();
    expect(result.search).toBeUndefined();
  });

  test('GIVEN invalid difficulty WHEN parsed THEN rejects', () => {
    const result = browseRoomsQuerySchema.safeParse({ difficulty: 'impossible' });
    expect(result.success).toBe(false);
  });

  test('GIVEN search longer than 100 chars WHEN parsed THEN rejects', () => {
    const result = browseRoomsQuerySchema.safeParse({ search: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  test('GIVEN status "finished" WHEN parsed THEN rejects (finished is the only non-browseable status)', () => {
    const result = browseRoomsQuerySchema.safeParse({ status: 'finished' });
    expect(result.success).toBe(false);
  });

  test.each([
    'waiting',
    'warmup',
    'coding',
    'wrapup',
  ] as const)('GIVEN browseable status %s WHEN parsed THEN accepts', (status) => {
    const result = browseRoomsQuerySchema.parse({ status });
    expect(result.status).toBe(status);
  });

  test('GIVEN status outside ROOM_STATUSES WHEN parsed THEN rejects', () => {
    const result = browseRoomsQuerySchema.safeParse({ status: 'bogus' });
    expect(result.success).toBe(false);
  });

  test('GIVEN all valid filters WHEN parsed THEN keeps values', () => {
    const result = browseRoomsQuerySchema.parse({
      status: 'waiting',
      language: 'python',
      difficulty: 'easy',
      search: 'two sum',
    });
    expect(result.status).toBe('waiting');
    expect(result.language).toBe('python');
    expect(result.difficulty).toBe('easy');
    expect(result.search).toBe('two sum');
  });
});

describe('browseRoomsResponseSchema', () => {
  test('GIVEN a valid payload with a minimal summary WHEN parsed THEN parses without throwing', () => {
    const payload = {
      data: [
        {
          roomId: '550e8400-e29b-41d4-a716-446655440000',
          name: null,
          status: 'waiting',
          mode: 'peer',
          hostId: '550e8400-e29b-41d4-a716-446655440001',
          hostName: 'alice',
          hostAvatarUrl: null,
          language: null,
          problemTitle: null,
          problemDifficulty: null,
          participantCount: 1,
          isParticipant: false,
          maxParticipants: 2,
          createdAt: '2026-04-19T12:00:00.000Z',
        },
      ],
      pagination: {
        nextCursor: null,
        hasMore: false,
      },
    };

    expect(() => browseRoomsResponseSchema.parse(payload)).not.toThrow();
  });
});

describe('requestRoomAiInterviewTranscriptionSchema', () => {
  test('GIVEN supported audio mime type with codec suffix WHEN parsed THEN accepts', () => {
    const result = requestRoomAiInterviewTranscriptionSchema.parse({
      audioBase64: Buffer.from('audio').toString('base64'),
      mimeType: 'audio/webm;codecs=opus',
    });

    expect(result.mimeType).toBe('audio/webm;codecs=opus');
  });

  test('GIVEN unsupported audio mime type WHEN parsed THEN rejects', () => {
    const result = requestRoomAiInterviewTranscriptionSchema.safeParse({
      audioBase64: Buffer.from('audio').toString('base64'),
      mimeType: 'text/plain',
    });

    expect(result.success).toBe(false);
  });
});

describe('changeRoomLanguageSchema', () => {
  test('GIVEN valid language WHEN parsed THEN passes', () => {
    const result = changeRoomLanguageSchema.parse({ language: 'python' });
    expect(result.language).toBe('python');
  });

  test('GIVEN unknown language WHEN parsed THEN rejects', () => {
    const result = changeRoomLanguageSchema.safeParse({ language: 'brainfuck' });
    expect(result.success).toBe(false);
  });

  test('GIVEN extra fields WHEN parsed THEN rejects (strict)', () => {
    const result = changeRoomLanguageSchema.safeParse({ language: 'python', extra: 'nope' });
    expect(result.success).toBe(false);
  });
});
