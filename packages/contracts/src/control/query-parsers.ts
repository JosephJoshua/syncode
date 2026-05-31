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

export function parseQueryBoolean(value: unknown) {
  if (value == null || value === '') {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'boolean') {
    return raw;
  }

  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return undefined;
}
