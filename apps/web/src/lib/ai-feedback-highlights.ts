export const AI_HIGHLIGHT_COLORS = ['green', 'yellow', 'orange', 'red'] as const;

export type AiHighlightColor = (typeof AI_HIGHLIGHT_COLORS)[number];

export type AiFeedbackSegment =
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'highlight';
      value: string;
      color: AiHighlightColor;
    };

const HIGHLIGHT_PATTERN = /<(green|yellow|orange|red)>([\s\S]*?)<\/\1>/g;

export function splitAiHighlightSegments(input: string): AiFeedbackSegment[] {
  if (!input) {
    return [];
  }

  const segments: AiFeedbackSegment[] = [];
  let cursor = 0;

  for (const match of input.matchAll(HIGHLIGHT_PATTERN)) {
    const fullMatch = match[0];
    const color = match[1] as AiHighlightColor | undefined;
    const value = match[2];
    const index = match.index ?? -1;

    if (!fullMatch || !color || value === undefined || index < 0) {
      continue;
    }

    if (index > cursor) {
      segments.push({
        type: 'text',
        value: input.slice(cursor, index),
      });
    }

    segments.push({
      type: 'highlight',
      value,
      color,
    });

    cursor = index + fullMatch.length;
  }

  if (cursor < input.length) {
    segments.push({
      type: 'text',
      value: input.slice(cursor),
    });
  }

  return segments.length > 0
    ? segments
    : [
        {
          type: 'text',
          value: input,
        },
      ];
}
