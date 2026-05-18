import { describe, expect, test } from 'vitest';
import {
  enterMatchmakingQueueResponseSchema,
  enterMatchmakingQueueSchema,
  getMatchmakingStatusResponseSchema,
} from './matchmaking.js';

describe('enterMatchmakingQueueSchema', () => {
  test('GIVEN empty body WHEN parsed THEN defaults to any-preference arrays', () => {
    const parsed = enterMatchmakingQueueSchema.parse({});

    expect(parsed.languages).toEqual([]);
    expect(parsed.difficulties).toEqual([]);
    expect(parsed.problemIds).toEqual([]);
    expect(parsed.topics).toEqual([]);
    expect(parsed.roles).toEqual([]);
  });

  test('GIVEN duplicate values WHEN parsed THEN preserves payload as-is', () => {
    const parsed = enterMatchmakingQueueSchema.parse({
      languages: ['python', 'python'],
      difficulties: ['easy', 'easy'],
      problemIds: ['550e8400-e29b-41d4-a716-446655440000'],
      topics: ['arrays', 'arrays'],
      roles: ['candidate', 'candidate'],
    });

    expect(parsed.languages).toEqual(['python', 'python']);
    expect(parsed.difficulties).toEqual(['easy', 'easy']);
    expect(parsed.problemIds).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
    expect(parsed.topics).toEqual(['arrays', 'arrays']);
    expect(parsed.roles).toEqual(['candidate', 'candidate']);
  });
});

describe('getMatchmakingStatusResponseSchema', () => {
  test('GIVEN idle status WHEN parsed THEN accepts minimal payload', () => {
    expect(() => getMatchmakingStatusResponseSchema.parse({ status: 'idle' })).not.toThrow();
  });

  test('GIVEN matched payload WHEN parsed THEN accepts room + counterpart IDs', () => {
    const payload = {
      status: 'matched',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      roomId: '550e8400-e29b-41d4-a716-446655440001',
      matchedWithUserId: '550e8400-e29b-41d4-a716-446655440002',
      expiresAt: '2026-05-18T12:00:00.000Z',
      preferences: {
        languages: ['python'],
        difficulties: ['easy'],
        problemIds: ['550e8400-e29b-41d4-a716-446655440003'],
        topics: ['arrays'],
        roles: ['candidate'],
      },
    };

    expect(() => enterMatchmakingQueueResponseSchema.parse(payload)).not.toThrow();
    expect(() => getMatchmakingStatusResponseSchema.parse(payload)).not.toThrow();
  });
});
