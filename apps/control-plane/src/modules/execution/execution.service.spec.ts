import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import { DB_CLIENT } from '../db/db.module';
import { ExecutionService } from './execution.service.js';

type SubmissionRow = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  errorTestCases: number;
  totalDurationMs: number | null;
  submittedAt: Date;
  completedAt: Date | null;
};

type ExecutionRow = {
  testCaseIndex: number;
  passed: boolean | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  memoryUsageMb: number | null;
  timedOut: boolean;
  errorMessage: string | null;
};

function createMockDb(submissionRows: SubmissionRow[], executionRows: ExecutionRow[]) {
  const submissionLimit = vi.fn().mockResolvedValue(submissionRows);
  const submissionWhere = vi.fn().mockReturnValue({ limit: submissionLimit });
  const submissionFrom = vi.fn().mockReturnValue({ where: submissionWhere });

  const executionOrderBy = vi.fn().mockResolvedValue(executionRows);
  const executionWhere = vi.fn().mockReturnValue({ orderBy: executionOrderBy });
  const executionFrom = vi.fn().mockReturnValue({ where: executionWhere });

  const select = vi
    .fn()
    .mockReturnValueOnce({ from: submissionFrom })
    .mockReturnValueOnce({ from: executionFrom });

  return {
    db: { select },
    mocks: { select, submissionLimit, executionOrderBy },
  };
}

describe('ExecutionService', () => {
  it('GIVEN existing submission WHEN loading details THEN returns detailed execution payload', async () => {
    const submittedAt = new Date('2026-04-06T09:00:00.000Z');
    const completedAt = new Date('2026-04-06T09:00:02.000Z');

    const mockDb = createMockDb(
      [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'completed',
          totalTestCases: 2,
          passedTestCases: 1,
          failedTestCases: 1,
          errorTestCases: 0,
          totalDurationMs: 37,
          submittedAt,
          completedAt,
        },
      ],
      [
        {
          testCaseIndex: 0,
          passed: true,
          expectedOutput: '2',
          actualOutput: '2',
          stdout: '2\n',
          stderr: '',
          exitCode: 0,
          durationMs: 14,
          memoryUsageMb: 8.5,
          timedOut: false,
          errorMessage: null,
        },
        {
          testCaseIndex: 1,
          passed: false,
          expectedOutput: '5',
          actualOutput: '4',
          stdout: '4\n',
          stderr: '',
          exitCode: 0,
          durationMs: 23,
          memoryUsageMb: 9.2,
          timedOut: false,
          errorMessage: null,
        },
      ],
    );

    const module = await Test.createTestingModule({
      providers: [
        ExecutionService,
        {
          provide: DB_CLIENT,
          useValue: mockDb.db,
        },
      ],
    }).compile();

    const service = module.get(ExecutionService);

    const result = await service.getSubmissionDetails(
      '550e8400-e29b-41d4-a716-446655440000',
      '11111111-2222-3333-4444-555555555555',
    );

    expect(result).toEqual({
      submissionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'completed',
      totalTestCases: 2,
      passedTestCases: 1,
      failedTestCases: 1,
      errorTestCases: 0,
      totalDurationMs: 37,
      submittedAt: submittedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      testCases: [
        {
          testCaseIndex: 0,
          passed: true,
          expectedOutput: '2',
          actualOutput: '2',
          stdout: '2\n',
          stderr: '',
          exitCode: 0,
          durationMs: 14,
          memoryUsageMb: 8.5,
          timedOut: false,
          errorMessage: null,
        },
        {
          testCaseIndex: 1,
          passed: false,
          expectedOutput: '5',
          actualOutput: '4',
          stdout: '4\n',
          stderr: '',
          exitCode: 0,
          durationMs: 23,
          memoryUsageMb: 9.2,
          timedOut: false,
          errorMessage: null,
        },
      ],
    });

    expect(mockDb.mocks.select).toHaveBeenCalledTimes(2);
  });

  it('GIVEN missing submission WHEN loading details THEN throws not found', async () => {
    const mockDb = createMockDb([], []);

    const module = await Test.createTestingModule({
      providers: [
        ExecutionService,
        {
          provide: DB_CLIENT,
          useValue: mockDb.db,
        },
      ],
    }).compile();

    const service = module.get(ExecutionService);

    await expect(
      service.getSubmissionDetails(
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-2222-3333-4444-555555555555',
      ),
    ).rejects.toMatchObject(
      new NotFoundException({
        message: 'Submission not found',
        code: ERROR_CODES.SUBMISSION_NOT_FOUND,
      }),
    );

    expect(mockDb.mocks.select).toHaveBeenCalledTimes(1);
  });
});
