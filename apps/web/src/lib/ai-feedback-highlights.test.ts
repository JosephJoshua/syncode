import { describe, expect, it } from 'vitest';
import { splitAiHighlightSegments } from './ai-feedback-highlights.js';

describe('splitAiHighlightSegments', () => {
  it('GIVEN plain text WHEN splitting THEN returns one text segment', () => {
    expect(splitAiHighlightSegments('Focus on edge cases.')).toEqual([
      { type: 'text', value: 'Focus on edge cases.' },
    ]);
  });

  it('GIVEN highlighted markup WHEN splitting THEN preserves surrounding text and color tags', () => {
    expect(
      splitAiHighlightSegments(
        'Focus on <yellow>edge cases</yellow> and <red>runtime failures</red>.',
      ),
    ).toEqual([
      { type: 'text', value: 'Focus on ' },
      { type: 'highlight', value: 'edge cases', color: 'yellow' },
      { type: 'text', value: ' and ' },
      { type: 'highlight', value: 'runtime failures', color: 'red' },
      { type: 'text', value: '.' },
    ]);
  });
});
