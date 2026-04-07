export type { TagInfo as ProblemTagInfo } from '@syncode/contracts';

/**
 * Converts a tag slug like "hash-table" into a display name like "Hash Table".
 * Used as a fallback when the full tag catalog isn't available.
 */
export function formatTagSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
