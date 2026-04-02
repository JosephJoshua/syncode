import { decodeCursor, encodeCursor, paginate } from '@syncode/shared';

describe('encodeCursor / decodeCursor', () => {
  it('GIVEN cursor values WHEN encoding and decoding THEN returns original values', () => {
    const values = ['2026-04-02T00:00:00Z', 'abc-123'];
    const encoded = encodeCursor(values);
    expect(decodeCursor(encoded)).toEqual(values);
  });

  it('GIVEN invalid base64url WHEN decoding THEN returns null', () => {
    expect(decodeCursor('!!!invalid!!!')).toBeNull();
  });
});

describe('paginate', () => {
  it('GIVEN no data WHEN paginating THEN returns empty result with hasMore=false', async () => {
    const result = await paginate({
      cursor: null,
      limit: 10,
      getCursorValues: (row: { id: string }) => [row.id],
      fetchPage: async () => [],
    });

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('GIVEN more rows than limit WHEN paginating THEN trims to limit and provides cursor to last row', async () => {
    const items = [
      { id: '1', ts: '2026-01-01' },
      { id: '2', ts: '2026-01-02' },
      { id: '3', ts: '2026-01-03' },
    ];

    const result = await paginate({
      cursor: null,
      limit: 2,
      getCursorValues: (row) => [row.ts, row.id],
      fetchPage: async (_decoded, fetchLimit) => items.slice(0, fetchLimit),
    });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    // Cursor encodes the last returned row's values
    expect(decodeCursor(result.pagination.nextCursor!)).toEqual(['2026-01-02', '2']);
  });

  it('GIVEN cursor from previous page WHEN paginating THEN passes decoded values to fetchPage', async () => {
    const cursor = encodeCursor(['2026-01-01', 'abc']);
    const fetchPage = vi.fn().mockResolvedValue([]);

    await paginate({
      cursor,
      limit: 10,
      getCursorValues: (row: { id: string }) => [row.id],
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledWith(['2026-01-01', 'abc'], 11);
  });
});
