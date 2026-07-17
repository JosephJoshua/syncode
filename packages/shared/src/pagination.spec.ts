import { describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor, paginate } from './pagination.js';

describe('encodeCursor / decodeCursor', () => {
  it('should return original values when encoding then decoding (round-trip)', () => {
    const values = ['abc', '123'];
    const cursor = encodeCursor(values);
    const result = decodeCursor(cursor);
    expect(result).toEqual(values);
  });

  it('should survive round-trip with special characters and unicode', () => {
    const values = ['hello world', 'café', '2024-01-01T00:00:00Z', 'a/b+c=d'];
    const cursor = encodeCursor(values);
    const result = decodeCursor(cursor);
    expect(result).toEqual(values);
  });

  it('should return null for corrupted base64 input', () => {
    expect(decodeCursor('!!!not-valid-base64!!!')).toBeNull();
  });

  it('should return null for an empty encoded string', () => {
    // Base64url of empty string is empty string
    const cursor = Buffer.from('').toString('base64url');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('should return null when decoded values contain empty segments', () => {
    // Consecutive \0 produces empty segments
    const cursor = Buffer.from('a\0\0b').toString('base64url');
    expect(decodeCursor(cursor)).toBeNull();
  });
});

interface TestRow {
  id: string;
}

describe('paginate', () => {
  it('should pass null cursor and limit+1 to fetchPage on first page and return hasMore when more results exist', async () => {
    const rows: TestRow[] = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const fetchPage = vi.fn().mockResolvedValue(rows);

    const result = await paginate<TestRow>({
      cursor: null,
      limit: 2,
      getCursorValues: (row) => [row.id],
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledWith(null, 3);
    expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).not.toBeNull();
  });

  it('should return hasMore=false when results do not exceed limit', async () => {
    const rows: TestRow[] = [{ id: '1' }, { id: '2' }];
    const fetchPage = vi.fn().mockResolvedValue(rows);

    const result = await paginate<TestRow>({
      cursor: null,
      limit: 2,
      getCursorValues: (row) => [row.id],
      fetchPage,
    });

    expect(result.data).toEqual(rows);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it('should return empty data with hasMore=false when no results exist', async () => {
    const fetchPage = vi.fn().mockResolvedValue([]);

    const result = await paginate<TestRow>({
      cursor: null,
      limit: 10,
      getCursorValues: (row) => [row.id],
      fetchPage,
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it('should decode cursor and pass decoded values to fetchPage on subsequent pages', async () => {
    const cursorValues = ['42', '2024-01-01'];
    const cursor = encodeCursor(cursorValues);
    const rows: TestRow[] = [{ id: '43' }];
    const fetchPage = vi.fn().mockResolvedValue(rows);

    const result = await paginate<TestRow>({
      cursor,
      limit: 5,
      getCursorValues: (row) => [row.id],
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledWith(cursorValues, 6);
    expect(result.data).toEqual(rows);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should work correctly with limit=1 and hasMore detection', async () => {
    const rows: TestRow[] = [{ id: 'a' }, { id: 'b' }];
    const fetchPage = vi.fn().mockResolvedValue(rows);

    const result = await paginate<TestRow>({
      cursor: null,
      limit: 1,
      getCursorValues: (row) => [row.id],
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledWith(null, 2);
    expect(result.data).toEqual([{ id: 'a' }]);
    expect(result.pagination.hasMore).toBe(true);

    expect(result.pagination.nextCursor).not.toBeNull();
    const decoded = decodeCursor(result.pagination.nextCursor as string);
    expect(decoded).toEqual(['a']);
  });
});
