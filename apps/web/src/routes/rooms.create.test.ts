import { describe, expect, it } from 'vitest';

// We need to extract matchesProblemQuery to test it.
// Since it's defined inside rooms.create.tsx, we'll inline the function for testing.
// TODO: Extract matchesProblemQuery to a shared utility when the function grows.

function matchesProblemQuery(label: string, query: string) {
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  let queryIndex = 0;
  for (let i = 0; i < normalizedLabel.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedLabel[i] === normalizedQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length;
}

describe('matchesProblemQuery', () => {
  it('should match when query is empty', () => {
    expect(matchesProblemQuery('Two Sum', '')).toBe(true);
    expect(matchesProblemQuery('Two Sum', '   ')).toBe(true);
  });

  it('should match exact substring', () => {
    expect(matchesProblemQuery('Two Sum (Easy)', 'two')).toBe(true);
    expect(matchesProblemQuery('Two Sum (Easy)', 'sum')).toBe(true);
  });

  it('should match subsequence', () => {
    expect(matchesProblemQuery('Two Sum', 'ts')).toBe(true);
    expect(matchesProblemQuery('LRU Cache (Hard)', 'lch')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(matchesProblemQuery('Two Sum', 'TWO')).toBe(true);
    expect(matchesProblemQuery('two sum', 'TWO SUM')).toBe(true);
  });

  it('should not match when query has no subsequence', () => {
    expect(matchesProblemQuery('Two Sum', 'xyz')).toBe(false);
    expect(matchesProblemQuery('Two Sum', 'zz')).toBe(false);
  });

  it('should not match when query is longer than label', () => {
    expect(matchesProblemQuery('ab', 'abc')).toBe(false);
  });
});
