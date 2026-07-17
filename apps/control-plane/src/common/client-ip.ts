type HeaderValue = string | string[] | undefined;

export interface ClientIpRequest {
  headers?: Record<string, HeaderValue>;
  ip?: string;
  ips?: string[];
  socket?: {
    remoteAddress?: string;
  };
}

function firstHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0)?.trim();
  }

  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function firstForwardedForValue(value: HeaderValue): string | undefined {
  const header = firstHeaderValue(value);
  return header
    ?.split(',')
    .map((item) => item.trim())
    .find(Boolean);
}

export function getClientIpFromRequest(request: ClientIpRequest): string {
  return (
    request.ips?.[0] ??
    request.ip ??
    firstHeaderValue(request.headers?.['x-real-ip']) ??
    firstForwardedForValue(request.headers?.['x-forwarded-for']) ??
    request.socket?.remoteAddress ??
    'unknown'
  );
}
