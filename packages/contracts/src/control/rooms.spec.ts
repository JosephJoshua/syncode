import { describe, expect, test } from 'vitest';
import {
  browseRoomsQuerySchema,
  browseRoomsResponseSchema,
  changeRoomLanguageSchema,
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

  test('GIVEN status outside BROWSEABLE_ROOM_STATUSES WHEN parsed THEN rejects', () => {
    const result = browseRoomsQuerySchema.safeParse({ status: 'finished' });
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
