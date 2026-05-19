import { describe, expect, test } from 'vitest';
import { problemsListQuerySchema } from './problems.js';

describe('problemsListQuerySchema', () => {
  test('GIVEN comma-separated status filters WHEN parsed THEN returns normalized status array', () => {
    const result = problemsListQuerySchema.parse({ status: 'attempted,todo,attempted' });

    expect(result.status).toEqual(['attempted', 'todo']);
  });

  test('GIVEN invalid status filter WHEN parsed THEN rejects', () => {
    const result = problemsListQuerySchema.safeParse({ status: 'finished' });

    expect(result.success).toBe(false);
  });
});
