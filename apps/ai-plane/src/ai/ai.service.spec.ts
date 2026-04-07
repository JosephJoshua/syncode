import type {
  GenerateHintRequest,
  InterviewResponseRequest,
  ReviewCodeRequest,
} from '@syncode/contracts';
import { describe, expect, it } from 'vitest';
import { AiService } from './ai.service.js';

describe('AiService', () => {
  const service = new AiService();

  const baseHintRequest: GenerateHintRequest = {
    roomId: 'room-1',
    participantId: 'user-1',
    problemDescription: 'Two Sum',
    currentCode: 'function twoSum() {}',
    language: 'typescript',
    hintLevel: 'gentle',
  };

  describe('generateHint', () => {
    it('GIVEN known hint levels WHEN generateHint is called THEN returns distinct hint text per level', async () => {
      const levels = ['gentle', 'moderate', 'direct'] as const;
      const hints = await Promise.all(
        levels.map((hintLevel) => service.generateHint({ ...baseHintRequest, hintLevel })),
      );

      const hintTexts = hints.map((h) => h.hint);
      const uniqueTexts = new Set(hintTexts);

      expect(uniqueTexts.size).toBe(3);

      for (const hint of hints) {
        expect(hint.hint).toBeTruthy();
      }
    });

    it('GIVEN an unknown hint level WHEN generateHint is called THEN returns fallback hint', async () => {
      const result = await service.generateHint({
        ...baseHintRequest,
        hintLevel: 'unknown-level' as GenerateHintRequest['hintLevel'],
      });

      expect(result.hint).toBe(
        'Consider what data structure would let you look up values efficiently.',
      );
    });

    it('GIVEN any hint level WHEN generateHint is called THEN always includes suggestedApproach', async () => {
      const levels = ['gentle', 'moderate', 'direct', 'unknown'] as const;

      for (const hintLevel of levels) {
        const result = await service.generateHint({
          ...baseHintRequest,
          hintLevel: hintLevel as GenerateHintRequest['hintLevel'],
        });

        expect(result.suggestedApproach).toBeTruthy();
        expect(typeof result.suggestedApproach).toBe('string');
      }
    });
  });

  describe('reviewCode', () => {
    it('GIVEN a review request WHEN reviewCode is called THEN returns overallScore and 3 categories', async () => {
      const request: ReviewCodeRequest = {
        roomId: 'room-1',
        participantId: 'user-1',
        problemDescription: 'Two Sum',
        code: 'function twoSum(nums, target) { return [0, 1]; }',
        language: 'typescript',
      };

      const result = await service.reviewCode(request);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.categories).toHaveLength(3);

      for (const category of result.categories) {
        expect(category.name).toBeTruthy();
        expect(category.score).toBeGreaterThanOrEqual(0);
        expect(category.feedback).toBeTruthy();
      }

      expect(result.summary).toBeTruthy();
    });
  });

  describe('generateInterviewResponse', () => {
    it('GIVEN an interview request WHEN generateInterviewResponse is called THEN returns message, followUpQuestion, and codeAnnotations', async () => {
      const request: InterviewResponseRequest = {
        roomId: 'room-1',
        participantId: 'user-1',
        problemDescription: 'Two Sum',
        currentCode: 'function twoSum() {}',
        language: 'typescript',
        conversationHistory: [],
        userMessage: 'I think I should use a hash map.',
      };

      const result = await service.generateInterviewResponse(request);

      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');

      expect(result.followUpQuestion).toBeTruthy();
      expect(typeof result.followUpQuestion).toBe('string');

      expect(result.codeAnnotations).toBeInstanceOf(Array);
      expect(result.codeAnnotations!.length).toBeGreaterThan(0);

      for (const annotation of result.codeAnnotations!) {
        expect(typeof annotation.line).toBe('number');
        expect(typeof annotation.comment).toBe('string');
      }
    });
  });
});
