import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionController } from './execution.controller.js';
import { ExecutionService } from './execution.service.js';

function createExecutionServiceMock() {
  return {
    getSubmissionDetails: vi.fn(),
    getExecutionResult: vi.fn(),
    getExecutionStatus: vi.fn(),
    getStaticAnalysisResult: vi.fn(),
  };
}

describe('ExecutionController', () => {
  it('GIVEN existing submission WHEN calling submission details endpoint THEN serializes dates to ISO strings', async () => {
    const submittedAt = new Date('2026-04-06T09:00:00.000Z');
    const completedAt = new Date('2026-04-06T09:00:01.000Z');

    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getSubmissionDetails.mockResolvedValue({
      submissionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'completed',
      totalTestCases: 1,
      passedTestCases: 1,
      failedTestCases: 0,
      errorTestCases: 0,
      totalDurationMs: 12,
      submittedAt,
      completedAt,
      testCases: [
        {
          testCaseIndex: 0,
          passed: true,
          expectedOutput: '2',
          actualOutput: '2',
          stdout: '2\n',
          stderr: '',
          exitCode: 0,
          durationMs: 12,
          memoryUsageMb: 8.4,
          timedOut: false,
          errorMessage: null,
        },
      ],
    });

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };

    const result = await controller.getSubmissionDetails(
      '550e8400-e29b-41d4-a716-446655440000',
      user,
    );

    expect(result.submittedAt).toBe('2026-04-06T09:00:00.000Z');
    expect(result.completedAt).toBe('2026-04-06T09:00:01.000Z');
    expect(result.submissionId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('GIVEN pending submission WHEN calling submission details endpoint THEN serializes null completedAt', async () => {
    const submittedAt = new Date('2026-04-06T09:00:00.000Z');

    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getSubmissionDetails.mockResolvedValue({
      submissionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'running',
      totalTestCases: 1,
      passedTestCases: 0,
      failedTestCases: 0,
      errorTestCases: 0,
      totalDurationMs: null,
      submittedAt,
      completedAt: null,
      testCases: [],
    });

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };

    const result = await controller.getSubmissionDetails(
      '550e8400-e29b-41d4-a716-446655440000',
      user,
    );

    expect(result.submittedAt).toBe('2026-04-06T09:00:00.000Z');
    expect(result.completedAt).toBeNull();
  });

  it('GIVEN missing submission WHEN calling submission details endpoint THEN throws not found', async () => {
    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getSubmissionDetails.mockRejectedValue(
      new NotFoundException({
        message: 'Submission not found',
        code: ERROR_CODES.SUBMISSION_NOT_FOUND,
      }),
    );

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };

    await expect(
      controller.getSubmissionDetails('550e8400-e29b-41d4-a716-446655440000', user),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN completed job WHEN polling execution result THEN returns full result', async () => {
    const mockResult = {
      status: 'completed',
      stdout: 'hello\n',
      stderr: '',
      exitCode: 0,
      durationMs: 42,
      timedOut: false,
    };

    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getExecutionResult.mockResolvedValue(mockResult);

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };

    const result = await controller.getExecutionResult('job-1', user);

    expect(result).toEqual(mockResult);
    expect(mockExecutionService.getExecutionResult).toHaveBeenCalledWith('job-1', user.id);
  });

  it('GIVEN pending job WHEN polling execution result THEN returns job status payload', async () => {
    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getExecutionResult.mockResolvedValue({ status: 'queued' });

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };
    const result = await controller.getExecutionResult('job-1', user);

    expect(result).toEqual({ status: 'queued' });
    expect(mockExecutionService.getExecutionResult).toHaveBeenCalledWith('job-1', user.id);
  });

  it('GIVEN job id WHEN checking execution status THEN returns status object', async () => {
    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getExecutionStatus.mockResolvedValue({ status: 'running' });

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };
    const result = await controller.getExecutionStatus('job-1', user);

    expect(result).toEqual({ status: 'running' });
    expect(mockExecutionService.getExecutionStatus).toHaveBeenCalledWith('job-1', user.id);
  });

  it('GIVEN static analysis job id WHEN fetching result THEN returns service payload', async () => {
    const payload = {
      jobId: 'static-analysis-job',
      status: 'completed',
      summary: {
        diagnosticCount: 1,
        errorCount: 0,
        warningCount: 1,
        maxCyclomaticComplexity: 12,
        highComplexityCount: 1,
        duplicationCount: 0,
        toolFailureCount: 0,
      },
      diagnostics: [],
      complexity: [],
      duplications: [],
      toolResults: [],
    };

    const mockExecutionService = createExecutionServiceMock();
    mockExecutionService.getStaticAnalysisResult.mockResolvedValue(payload);

    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
    }).compile();

    const controller = module.get(ExecutionController);
    const user = { id: '11111111-2222-3333-4444-555555555555' };
    const result = await controller.getStaticAnalysisResult('static-analysis-job', user);

    expect(result).toEqual(payload);
    expect(mockExecutionService.getStaticAnalysisResult).toHaveBeenCalledWith(
      'static-analysis-job',
      user.id,
    );
  });
});
