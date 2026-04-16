import { describe, expect, it } from 'vitest';
import { buildCursorCssRules } from './cursor-styles.js';

describe('buildCursorCssRules', () => {
  it('GIVEN remote user with valid hex color THEN generates selection, cursor, and label CSS rules', () => {
    const states = new Map<number, Record<string, unknown>>([
      [42, { user: { name: 'Alice', color: '#00e599', colorLight: '#00e59933' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    expect(rules).toHaveLength(4);
    expect(rules[0]).toContain('.yRemoteSelection-42');
    expect(rules[0]).toContain('#00e59933');
    expect(rules[1]).toContain('.yRemoteSelectionHead-42');
    expect(rules[1]).toContain('border-left: 2px solid #00e599');
    expect(rules[2]).toContain('content: "Alice"');
    expect(rules[2]).toContain('background: #00e599');
    expect(rules[3]).toContain('border-radius: 50%');
  });

  it('GIVEN local clientID in states THEN skips the local user', () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { name: 'Me', color: '#ff0000' } }],
      [2, { user: { name: 'Other', color: '#00ff00' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    expect(rules.every((r) => !r.includes('yRemoteSelection-1'))).toBe(true);
    expect(rules.some((r) => r.includes('yRemoteSelection-2'))).toBe(true);
  });

  it('GIVEN user with invalid color THEN skips that user', () => {
    const states = new Map<number, Record<string, unknown>>([
      [2, { user: { name: 'Hacker', color: 'red; } body { display: none' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    expect(rules).toHaveLength(0);
  });

  it('GIVEN user with no color THEN skips that user', () => {
    const states = new Map<number, Record<string, unknown>>([[2, { user: { name: 'NoColor' } }]]);

    const rules = buildCursorCssRules(states, 1);

    expect(rules).toHaveLength(0);
  });

  it('GIVEN user name with quotes and braces THEN sanitizes them out of CSS content', () => {
    const states = new Map<number, Record<string, unknown>>([
      [2, { user: { name: 'Alice"; } .evil { color: red', color: '#ff0000' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    const labelRule = rules.find((r) => r.includes('::after'));
    expect(labelRule).toBeDefined();
    // Quotes, semicolons, and braces are stripped — CSS injection neutralized
    expect(labelRule).not.toContain('"; }');
    expect(labelRule).not.toContain('{ color');
  });

  it('GIVEN user with no colorLight THEN derives it from color with 33 suffix', () => {
    const states = new Map<number, Record<string, unknown>>([
      [2, { user: { name: 'Test', color: '#abcdef' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    const selectionRule = rules.find((r) => r.includes('yRemoteSelection-2'));
    expect(selectionRule).toContain('#abcdef33');
  });

  it('GIVEN user with invalid colorLight THEN falls back to derived color', () => {
    const states = new Map<number, Record<string, unknown>>([
      [2, { user: { name: 'Test', color: '#abcdef', colorLight: 'not-a-color' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    const selectionRule = rules.find((r) => r.includes('yRemoteSelection-2'));
    expect(selectionRule).toContain('#abcdef33');
  });

  it('GIVEN empty states map THEN returns empty rules', () => {
    const rules = buildCursorCssRules(new Map(), 1);
    expect(rules).toHaveLength(0);
  });

  it('GIVEN multiple remote users THEN generates rules for each', () => {
    const states = new Map<number, Record<string, unknown>>([
      [2, { user: { name: 'A', color: '#ff0000' } }],
      [3, { user: { name: 'B', color: '#00ff00' } }],
    ]);

    const rules = buildCursorCssRules(states, 1);

    // 4 rules per user × 2 users = 8
    expect(rules).toHaveLength(8);
    expect(rules.some((r) => r.includes('yRemoteSelection-2'))).toBe(true);
    expect(rules.some((r) => r.includes('yRemoteSelection-3'))).toBe(true);
  });
});
