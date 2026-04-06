export type DiffLine = {
  kind: 'same' | 'expected' | 'actual';
  text: string;
};

/**
 * Build a stable line diff using LCS so insertions/deletions do not shift all following lines.
 */
export function buildLineDiff(
  expectedOutput: string | null,
  actualOutput: string | null,
): DiffLine[] {
  const expectedLines = (expectedOutput ?? '').split('\n');
  const actualLines = (actualOutput ?? '').split('\n');
  const expectedLength = expectedLines.length;
  const actualLength = actualLines.length;
  const lcsTable = Array.from({ length: expectedLength + 1 }, () =>
    Array.from({ length: actualLength + 1 }, () => 0),
  );

  for (let expectedIndex = expectedLength - 1; expectedIndex >= 0; expectedIndex--) {
    for (let actualIndex = actualLength - 1; actualIndex >= 0; actualIndex--) {
      const nextExpected = lcsTable[expectedIndex + 1] ?? [];
      const currentExpected = lcsTable[expectedIndex] ?? [];
      const row = lcsTable[expectedIndex];
      if (row) {
        row[actualIndex] =
          expectedLines[expectedIndex] === actualLines[actualIndex]
            ? (nextExpected[actualIndex + 1] ?? 0) + 1
            : Math.max(nextExpected[actualIndex] ?? 0, currentExpected[actualIndex + 1] ?? 0);
      }
    }
  }

  const diff: DiffLine[] = [];
  let expectedIndex = 0;
  let actualIndex = 0;

  while (expectedIndex < expectedLength && actualIndex < actualLength) {
    if (expectedLines[expectedIndex] === actualLines[actualIndex]) {
      diff.push({ kind: 'same', text: expectedLines[expectedIndex] ?? '' });
      expectedIndex++;
      actualIndex++;
      continue;
    }

    const nextExpected = lcsTable[expectedIndex + 1] ?? [];
    const currentExpected = lcsTable[expectedIndex] ?? [];

    if ((nextExpected[actualIndex] ?? 0) >= (currentExpected[actualIndex + 1] ?? 0)) {
      diff.push({ kind: 'expected', text: expectedLines[expectedIndex] ?? '' });
      expectedIndex++;
    } else {
      diff.push({ kind: 'actual', text: actualLines[actualIndex] ?? '' });
      actualIndex++;
    }
  }

  while (expectedIndex < expectedLength) {
    diff.push({ kind: 'expected', text: expectedLines[expectedIndex] ?? '' });
    expectedIndex++;
  }

  while (actualIndex < actualLength) {
    diff.push({ kind: 'actual', text: actualLines[actualIndex] ?? '' });
    actualIndex++;
  }

  return diff.filter((line, index, lines) => !(line.text === '' && index === lines.length - 1));
}
