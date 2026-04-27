import type {
  GenerateHintRequest,
  GenerateSessionReportRequest,
  InterviewResponseRequest,
  ReviewCodeRequest,
} from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { parseSessionReportJson } from './report-json.js';

describe('AiService', () => {
  const llmProvider = {
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        overallScore: 82,
        dimensions: {
          correctness: {
            score: 84,
            feedback: 'Correctness feedback',
            evidence: [],
          },
          efficiency: {
            score: 78,
            feedback: 'Efficiency feedback',
            evidence: [],
          },
          codeQuality: {
            score: 80,
            feedback: 'Code quality feedback',
            evidence: [],
          },
          communication: {
            score: 76,
            feedback: 'Communication feedback',
            evidence: [],
          },
          problemSolving: {
            score: 83,
            feedback: 'Problem solving feedback',
            evidence: [],
          },
        },
        strengths: ['Strong iteration'],
        areasForImprovement: ['Explain tradeoffs earlier'],
        detailedFeedback: 'Detailed feedback',
        comparisonToHistory: null,
        peerFeedbackSummary: null,
      }),
      model: 'qwen3.5-mini',
    }),
  };
  const service = new AiService(llmProvider);

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

  describe('generateSessionReport', () => {
    it('GIVEN report request WHEN generateSessionReport THEN returns validated report with injected deterministic fields', async () => {
      const request: GenerateSessionReportRequest = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        roomId: '660e8400-e29b-41d4-a716-446655440000',
        participantId: '770e8400-e29b-41d4-a716-446655440000',
        participantRole: 'candidate',
        participants: [
          {
            userId: '770e8400-e29b-41d4-a716-446655440000',
            username: 'alice',
            displayName: 'Alice',
            role: 'candidate',
          },
        ],
        problem: {
          id: '880e8400-e29b-41d4-a716-446655440000',
          title: 'Two Sum',
          description: 'Find two numbers.',
          difficulty: 'easy',
          constraints: null,
        },
        language: 'typescript',
        durationMs: 120000,
        startedAt: '2026-04-20T01:00:00.000Z',
        finishedAt: '2026-04-20T01:02:00.000Z',
        snapshots: [],
        runs: [],
        submissions: [],
        finalTestCaseBreakdown: [
          {
            testCaseIndex: 0,
            input: 'nums = [2,7,11,15], target = 9',
            description: 'Basic case',
            isHidden: false,
            passed: true,
            expectedOutput: '[0,1]',
            actualOutput: '[0,1]',
            stdout: '[0,1]\\n',
            stderr: '',
            exitCode: 0,
            durationMs: 12,
            memoryUsageMb: 8.5,
            timedOut: false,
            errorMessage: null,
          },
        ],
        peerFeedback: [],
        aiMessages: [],
        historicalContext: null,
      };

      const result = await service.generateSessionReport(request);

      expect(result.sessionId).toBe(request.sessionId);
      expect(result.testCaseBreakdown).toEqual([
        {
          testCaseIndex: 0,
          passed: true,
          timedOut: false,
          errorMessage: null,
        },
      ]);
      expect(result.overallScore).toBe(82);
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.categoryScores).toEqual({
        correctness: 84,
        efficiency: 78,
        codeQuality: 80,
        communication: 76,
        problemSolving: 83,
      });
      expect(result.feedback).toBe(result.detailedFeedback);
      expect(llmProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonMode: true,
        }),
      );
    });

    it('GIVEN optimal efficiency and class-based false-positive critique WHEN generateSessionReport THEN postprocesses the report into platform-aware coaching', async () => {
      llmProvider.generateText.mockResolvedValueOnce({
        text: JSON.stringify({
          overallScore: 82,
          dimensions: {
            efficiency: {
              score: 90,
              feedback:
                'The solution achieves optimal O(n) time complexity and O(n) space complexity using a hash map.',
              evidence: [],
            },
            codeQuality: {
              score: 50,
              feedback:
                'Code relies on raw stdin/stdout which is non-standard for class-based solutions, and string concatenation is used instead of f-strings.',
              evidence: [
                {
                  type: 'code_snippet',
                  reference: 'class Solution:',
                  description: 'Class structure should be used instead of stdin/stdout here.',
                },
              ],
            },
          },
          strengths: ['Optimal algorithm selection'],
          areasForImprovement: [
            'Separating I/O from business logic',
            'Adding comments to explain reasoning',
          ],
          detailedFeedback:
            'The candidate selected an efficient O(n) hash map strategy but mixes stdin/stdout directly into a class-based solution.',
          comparisonToHistory: null,
          peerFeedbackSummary: null,
        }),
        model: 'qwen3.5-plus',
      });

      const result = await service.generateSessionReport({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        roomId: '660e8400-e29b-41d4-a716-446655440000',
        participantId: '770e8400-e29b-41d4-a716-446655440000',
        participantRole: 'candidate',
        participants: [
          {
            userId: '770e8400-e29b-41d4-a716-446655440000',
            username: 'alice',
            displayName: 'Alice',
            role: 'candidate',
          },
        ],
        problem: {
          id: '880e8400-e29b-41d4-a716-446655440000',
          title: 'Two Sum',
          description: 'Find two numbers.',
          difficulty: 'easy',
          constraints: null,
        },
        language: 'python',
        durationMs: 120000,
        startedAt: '2026-04-20T01:00:00.000Z',
        finishedAt: '2026-04-20T01:02:00.000Z',
        snapshots: [
          {
            snapshotId: '990e8400-e29b-41d4-a716-446655440000',
            timestamp: '2026-04-20T01:01:30.000Z',
            trigger: 'submission',
            language: 'python',
            code: [
              's = input()[1:-1].split(",")',
              'nums = [int(x) for x in s]',
              'target = int(input())',
              'maps = {}',
              '',
              'for idx, num in enumerate(nums):',
              '  if num in maps:',
              '    print("[" + str(maps[num]) + "," + str(idx) + "]")',
              '    break',
              '',
              '  maps[target-int(num)] = idx',
            ].join('\n'),
            linesOfCode: 10,
          },
        ],
        runs: [],
        submissions: [],
        finalTestCaseBreakdown: [],
        peerFeedback: [],
        aiMessages: [],
        historicalContext: null,
      });

      expect(result.dimensions?.efficiency?.score).toBe(95);
      expect(result.dimensions?.codeQuality?.feedback).not.toMatch(/class-based/i);
      expect(result.dimensions?.codeQuality?.feedback).toMatch(
        /stdin\/stdout structure matches this platform/i,
      );
      expect(result.areasForImprovement?.[0]).toMatch(
        /clearer names|stdin\/stdout structure|print\(f/iu,
      );
      expect(result.detailedFeedback).not.toMatch(/class-based/i);
      expect(result.detailedFeedback).toMatch(/Recommended next step:/);
    });
  });

  describe('parseSessionReportJson', () => {
    it('GIVEN peerFeedbackSummary as string WHEN parsing THEN coerces it to null', () => {
      const result = parseSessionReportJson(
        JSON.stringify({
          overallScore: 82,
          strengths: ['Strong iteration'],
          areasForImprovement: ['Explain tradeoffs earlier'],
          detailedFeedback: 'Detailed feedback',
          comparisonToHistory: null,
          peerFeedbackSummary: 'No peer feedback available',
        }),
      );

      expect(result.peerFeedbackSummary).toBeNull();
    });

    it('GIVEN a dimension without feedback WHEN parsing THEN injects a fallback feedback string', () => {
      const result = parseSessionReportJson(
        JSON.stringify({
          overallScore: 82,
          dimensions: {
            efficiency: {
              score: 71,
              evidence: [],
            },
          },
          strengths: ['Strong iteration'],
          areasForImprovement: ['Explain tradeoffs earlier'],
          detailedFeedback: 'Detailed feedback',
          comparisonToHistory: null,
          peerFeedbackSummary: null,
        }),
      );

      expect(result.dimensions?.efficiency).toEqual({
        score: 71,
        feedback: 'No explicit efficiency feedback was provided.',
        evidence: [],
      });
    });

    it('GIVEN malformed comparisonToHistory WHEN parsing THEN coerces it to null', () => {
      const result = parseSessionReportJson(
        JSON.stringify({
          overallScore: 82,
          strengths: ['Strong iteration'],
          areasForImprovement: ['Explain tradeoffs earlier'],
          detailedFeedback: 'Detailed feedback',
          comparisonToHistory: {
            trend: 'better',
            sessionsCompared: undefined,
            averageScore: undefined,
          },
          peerFeedbackSummary: null,
        }),
      );

      expect(result.comparisonToHistory).toBeNull();
    });

    it('GIVEN soft malformed comparisonToHistory WHEN parsing THEN normalizes it', () => {
      const result = parseSessionReportJson(
        JSON.stringify({
          overallScore: 82,
          strengths: ['Strong iteration'],
          areasForImprovement: ['Explain tradeoffs earlier'],
          detailedFeedback: 'Detailed feedback',
          comparisonToHistory: {
            trend: 'better',
            sessionsCompared: '3',
            averageScore: '74',
          },
          peerFeedbackSummary: null,
        }),
      );

      expect(result.comparisonToHistory).toEqual({
        trend: 'improving',
        sessionsCompared: 3,
        averageScore: 74,
      });
    });
  });
});
