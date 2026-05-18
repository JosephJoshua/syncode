export function parseQueryMultiSelect(value: unknown) {
  if (value == null) {
    return undefined;
  }

  const normalized = (Array.isArray(value) ? value : [value])
    .flatMap((item) => {
      if (typeof item !== 'string') {
        return [item];
      }

      return item
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    })
    .filter((item) => typeof item === 'string');

  if (normalized.length === 0) {
    return undefined;
  }

  return [...new Set(normalized)];
}
