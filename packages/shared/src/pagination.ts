/**
 * Cursor-based pagination helper.
 */

export interface PaginateOptions<T> {
  /** Raw cursor string from the client (opaque base64). */
  cursor?: string | null;
  /** Page size. */
  limit: number;
  /**
   * Extract the cursor values from a row. Must return the same number
   * and order of values used to build the WHERE clause in `fetchPage`.
   */
  getCursorValues: (row: T) => string[];
  /**
   * Fetch rows from the data source. Receives decoded cursor values
   * (or `null` for the first page) and the number of rows to fetch
   * (always `limit + 1` to detect `hasMore`).
   */
  fetchPage: (decodedCursor: string[] | null, fetchLimit: number) => Promise<T[]>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Encode cursor values into an opaque base64 string.
 */
export function encodeCursor(values: string[]): string {
  return Buffer.from(values.join('\0')).toString('base64url');
}

/**
 * Decode an opaque cursor string back into cursor values.
 *
 * Returns `null` if the cursor is invalid.
 */
export function decodeCursor(cursor: string): string[] | null {
  try {
    const buf = Buffer.from(cursor, 'base64url');

    // Verify round-trip to detect corrupted input
    if (buf.toString('base64url') !== cursor) return null;
    const decoded = buf.toString('utf-8');
    if (decoded.length === 0) return null;
    const values = decoded.split('\0');
    if (values.some((v) => v.length === 0)) return null;
    return values;
  } catch {
    return null;
  }
}

/**
 * Execute a cursor-paginated query.
 *
 * @example
 * ```ts
 * const result = await paginate({
 *   cursor: query.cursor,
 *   limit: query.limit,
 *   getCursorValues: (row) => [row.createdAt.toISOString(), row.id],
 *   fetchPage: (decoded, fetchLimit) => {
 *     const qb = db.select().from(table);
 *     if (decoded) {
 *       qb.where(or(
 *         lt(table.createdAt, decoded[0]),
 *         and(eq(table.createdAt, decoded[0]), lt(table.id, decoded[1])),
 *       ));
 *     }
 *     return qb.limit(fetchLimit);
 *   },
 * });
 * ```
 */
export async function paginate<T>(options: PaginateOptions<T>): Promise<PaginatedResult<T>> {
  const { cursor, limit, getCursorValues, fetchPage } = options;

  const decodedCursor = cursor ? decodeCursor(cursor) : null;
  const rows = await fetchPage(decodedCursor, limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  const lastRow = data.at(-1);
  const nextCursor = hasMore && lastRow != null ? encodeCursor(getCursorValues(lastRow)) : null;

  return {
    data,
    pagination: { nextCursor, hasMore },
  };
}
