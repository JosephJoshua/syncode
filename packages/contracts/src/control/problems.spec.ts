import { describe, expect, test } from 'vitest';
import {
  problemDetailQuerySchema,
  problemsListQuerySchema,
  publishProblemStatusSchema,
  updateProblemSchema,
} from './problems.js';

describe('problemsListQuerySchema', () => {
  test('GIVEN comma-separated status filters WHEN parsed THEN returns normalized status array', () => {
    const result = problemsListQuerySchema.parse({ status: 'attempted,todo,attempted' });

    expect(result.status).toEqual(['attempted', 'todo']);
  });

  test('GIVEN invalid status filter WHEN parsed THEN rejects', () => {
    const result = problemsListQuerySchema.safeParse({ status: 'finished' });

    expect(result.success).toBe(false);
  });

  test('GIVEN includeDrafts query string WHEN parsed THEN returns boolean value', () => {
    expect(problemsListQuerySchema.parse({ includeDrafts: 'true' }).includeDrafts).toBe(true);
    expect(problemsListQuerySchema.parse({ includeDrafts: 'false' }).includeDrafts).toBe(false);
  });
});

describe('problemDetailQuerySchema', () => {
  test('GIVEN includeHidden query string WHEN parsed THEN returns boolean value', () => {
    expect(problemDetailQuerySchema.parse({ includeHidden: 'true' }).includeHidden).toBe(true);
    expect(problemDetailQuerySchema.parse({ includeHidden: 'false' }).includeHidden).toBe(false);
  });
});

describe('updateProblemSchema', () => {
  test('GIVEN partial edit payload WHEN parsed THEN accepts only provided editable fields', () => {
    const result = updateProblemSchema.parse({
      title: 'Updated title',
      testCases: [{ input: '1 2', expectedOutput: '3', isHidden: true }],
    });

    expect(result).toEqual({
      title: 'Updated title',
      testCases: [{ input: '1 2', expectedOutput: '3', isHidden: true }],
    });
  });

  test('GIVEN publish status in edit payload WHEN parsed THEN rejects status mutation', () => {
    const result = updateProblemSchema.safeParse({ isPublished: true });

    expect(result.success).toBe(false);
  });
});

describe('publishProblemStatusSchema', () => {
  test('GIVEN publish status payload WHEN parsed THEN accepts explicit boolean status', () => {
    expect(publishProblemStatusSchema.parse({ isPublished: false })).toEqual({
      isPublished: false,
    });
  });
});
