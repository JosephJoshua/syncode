const SENSITIVE_QUERY_KEYS = new Set(['token', 'accessToken', 'refreshToken', 'password']);

export function buildApiUrl(baseUrl, path, query = {}) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const baseWithoutApi = normalizedBase.endsWith('/api')
    ? normalizedBase.slice(0, -'/api'.length)
    : normalizedBase;
  const cleanPath = path.replace(/^\/+/, '').replace(/^api\/+/, '');
  const url = new URL(`${baseWithoutApi}/api/${cleanPath}`);

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && item !== '') {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

export class CookieJar {
  #cookies = new Map();

  store(setCookieHeaders = []) {
    for (const header of setCookieHeaders) {
      const [pair] = String(header).split(';');
      const separator = pair.indexOf('=');
      if (separator <= 0) {
        continue;
      }
      this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header() {
    return [...this.#cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }
}

export class ApiClient {
  constructor({ baseUrl, metrics, timeoutMs = 10_000, userLabel = 'anonymous' }) {
    this.baseUrl = baseUrl;
    this.metrics = metrics;
    this.timeoutMs = timeoutMs;
    this.userLabel = userLabel;
    this.cookieJar = new CookieJar();
    this.accessToken = null;
  }

  get isAuthenticated() {
    return Boolean(this.accessToken);
  }

  async request(method, path, { query, body, expectedStatuses = [200], label } = {}) {
    const url = buildApiUrl(this.baseUrl, path, query);
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = {
      Accept: 'application/json',
    };

    const cookieHeader = this.cookieJar.header();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let status = 0;
    let responseBody = null;
    let ok = false;
    const requestLabel =
      label ?? `${method} /api/${path.replace(/^\/+/, '').replace(/^api\/+/, '')}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      status = response.status;
      this.cookieJar.store(readSetCookieHeaders(response.headers));
      responseBody = await readResponseBody(response);
      ok = expectedStatuses.includes(status);
      if (!ok) {
        throw new ApiError(`Unexpected ${status} for ${requestLabel}`, {
          method,
          url: redactUrl(url.toString()),
          status,
          body: responseBody,
        });
      }
      return responseBody;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError(`Request timed out for ${requestLabel}`, {
          method,
          url: redactUrl(url.toString()),
          status,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      this.metrics.record({
        label: requestLabel,
        status,
        durationMs: performance.now() - started,
        ok,
        userLabel: this.userLabel,
      });
    }
  }

  async login(user) {
    const result = await this.request('POST', 'auth/login', {
      body: {
        identifier: user.identifier,
        password: user.password,
      },
      label: 'POST /api/auth/login',
    });
    this.accessToken = result.accessToken;
    return result.user;
  }

  async register(user) {
    const result = await this.request('POST', 'auth/register', {
      body: {
        username: user.username,
        email: user.identifier,
        password: user.password,
      },
      expectedStatuses: [201],
      label: 'POST /api/auth/register',
    });
    this.accessToken = result.accessToken;
    return result.user;
  }

  async logout() {
    await this.request('POST', 'auth/logout', {
      expectedStatuses: [204, 401],
      label: 'POST /api/auth/logout',
    });
  }
}

export class ApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

export function redactUrl(value) {
  const url = new URL(value);
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key)) {
      url.searchParams.set(key, '[redacted]');
    }
  }
  return url.toString();
}

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
