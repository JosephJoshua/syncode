export type DiffLine = {
  kind: 'same' | 'expected' | 'actual';
  text: string;
};

function buildLcsTable(expectedLines: string[], actualLines: string[]): number[][] {
  const expectedLength = expectedLines.length;
  const actualLength = actualLines.length;
  const lcsTable = Array.from({ length: expectedLength + 1 }, () =>
    Array.from({ length: actualLength + 1 }, () => 0),
  );

  for (let expectedIndex = expectedLength - 1; expectedIndex >= 0; expectedIndex--) {
    for (let actualIndex = actualLength - 1; actualIndex >= 0; actualIndex--) {
      const row = lcsTable[expectedIndex];
      if (!row) continue;
      const nextExpected = lcsTable[expectedIndex + 1] ?? [];
      const currentExpected = lcsTable[expectedIndex] ?? [];
      row[actualIndex] =
        expectedLines[expectedIndex] === actualLines[actualIndex]
          ? (nextExpected[actualIndex + 1] ?? 0) + 1
          : Math.max(nextExpected[actualIndex] ?? 0, currentExpected[actualIndex + 1] ?? 0);
    }
  }

  return lcsTable;
}

function walkDiff(
  expectedLines: string[],
  actualLines: string[],
  lcsTable: number[][],
): DiffLine[] {
  const diff: DiffLine[] = [];
  let expectedIndex = 0;
  let actualIndex = 0;

  while (expectedIndex < expectedLines.length && actualIndex < actualLines.length) {
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

  while (expectedIndex < expectedLines.length) {
    diff.push({ kind: 'expected', text: expectedLines[expectedIndex] ?? '' });
    expectedIndex++;
  }
  while (actualIndex < actualLines.length) {
    diff.push({ kind: 'actual', text: actualLines[actualIndex] ?? '' });
    actualIndex++;
  }

  return diff;
}

/**
 * Build a stable line diff using LCS so insertions/deletions do not shift all following lines.
 */
export function buildLineDiff(
  expectedOutput: string | null,
  actualOutput: string | null,
): DiffLine[] {
  const expectedLines = (expectedOutput ?? '').split('\n');
  const actualLines = (actualOutput ?? '').split('\n');
  const lcsTable = buildLcsTable(expectedLines, actualLines);
  const diff = walkDiff(expectedLines, actualLines, lcsTable);
  return diff.filter((line, index, lines) => !(line.text === '' && index === lines.length - 1));
}
