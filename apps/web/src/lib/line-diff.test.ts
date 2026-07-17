import { describe, expect, it } from 'vitest';
import { buildLineDiff } from './line-diff.js';

describe('buildLineDiff', () => {
  it('GIVEN identical strings WHEN diffing THEN all lines are same', () => {
    const result = buildLineDiff('hello\nworld', 'hello\nworld');
    expect(result).toEqual([
      { kind: 'same', text: 'hello' },
      { kind: 'same', text: 'world' },
    ]);
  });

  it('GIVEN completely different strings WHEN diffing THEN shows expected and actual', () => {
    const result = buildLineDiff('alpha', 'beta');
    expect(result).toEqual([
      { kind: 'expected', text: 'alpha' },
      { kind: 'actual', text: 'beta' },
    ]);
  });

  it('GIVEN null expected WHEN diffing THEN treats as empty string against actual', () => {
    const result = buildLineDiff(null, 'hello');
    expect(result).toEqual([
      { kind: 'expected', text: '' },
      { kind: 'actual', text: 'hello' },
    ]);
  });

  it('GIVEN null actual WHEN diffing THEN treats as empty string against expected', () => {
    const result = buildLineDiff('hello', null);
    expect(result).toEqual([{ kind: 'expected', text: 'hello' }]);
  });

  it('GIVEN both null WHEN diffing THEN returns empty array', () => {
    const result = buildLineDiff(null, null);
    expect(result).toEqual([]);
  });

  it('GIVEN partial overlap WHEN diffing THEN preserves common lines and marks differences', () => {
    const result = buildLineDiff('a\nb\nc', 'a\nx\nc');
    expect(result).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'expected', text: 'b' },
      { kind: 'actual', text: 'x' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('GIVEN extra lines in actual WHEN diffing THEN marks additions', () => {
    const result = buildLineDiff('a\nc', 'a\nb\nc');
    expect(result).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'actual', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('GIVEN extra lines in expected WHEN diffing THEN marks deletions', () => {
    const result = buildLineDiff('a\nb\nc', 'a\nc');
    expect(result).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'expected', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('GIVEN trailing newline WHEN diffing THEN strips trailing empty line', () => {
    const result = buildLineDiff('42\n', '41\n');
    expect(result).toEqual([
      { kind: 'expected', text: '42' },
      { kind: 'actual', text: '41' },
    ]);
  });
});
