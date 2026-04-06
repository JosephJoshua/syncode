import type { ErrorResponse, RequestOf, ResponseOf, TypedRoute } from '@syncode/contracts';
import { buildUrl, CONTROL_API } from '@syncode/contracts';
import ky, { HTTPError } from 'ky';
import { useAuthStore } from '@/stores/auth.store';

const resolveUrl = buildUrl as (template: string, params?: Record<string, string>) => string;
const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
  .env;

const prefixUrl = importMetaEnv?.VITE_API_URL ?? '/api';

const client = ky.create({
  prefixUrl,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
        }
      },
    ],
  },
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshRoute = CONTROL_API.AUTH.REFRESH.route;
      const url = `${prefixUrl.replace(/\/$/, '')}/${refreshRoute}`;

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.status === 401) {
        useAuthStore.getState().logout();
        return false;
      }

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { accessToken: string };
      useAuthStore.getState().setSession({ accessToken: data.accessToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * API helper that uses route definitions from `@syncode/contracts`.
 *
 * @example
 * // GET (no body, no params)
 * const profile = await api(CONTROL_API.USERS.PROFILE);
 *
 * // POST with body
 * const tokens = await api(CONTROL_API.AUTH.LOGIN, {
 *   body: { identifier: 'a@b.com', password: '...' },
 * });
 *
 * // DELETE with path params
 * await api(CONTROL_API.ROOMS.DESTROY, { params: { id: roomId } });
 *
 * // POST with both
 * const job = await api(CONTROL_API.ROOMS.RUN, {
 *   params: { id: roomId },
 *   body: { code, language },
 * });
 */
export async function api<T extends TypedRoute<unknown, unknown>>(
  route: T & { readonly route: string; readonly method: string },
  options?: {
    params?: Record<string, string>;
    body?: RequestOf<T>;
    searchParams?: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<ResponseOf<T>> {
  try {
    return await executeRequest(route, options);
  } catch (error) {
    if (
      error instanceof HTTPError &&
      error.response.status === 401 &&
      !route.route.startsWith('auth/')
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return executeRequest(route, options);
      }
    }

    throw error;
  }
}

async function executeRequest<T extends TypedRoute<unknown, unknown>>(
  route: T & { readonly route: string; readonly method: string },
  options?: {
    params?: Record<string, string>;
    body?: RequestOf<T>;
    searchParams?: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<ResponseOf<T>> {
  const template = route.route.startsWith('/') ? route.route.slice(1) : route.route;
  const url = resolveUrl(template, options?.params);

  const method = route.method.toLowerCase();

  const response = await client(url, {
    method,
    searchParams: normalizeSearchParams(options?.searchParams),
    ...(options?.body === undefined ? {} : { json: options.body }),
  });

  if (response.status === 204) {
    return undefined as ResponseOf<T>;
  }

  return response.json<ResponseOf<T>>();
}

function normalizeSearchParams(
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined || value === null) {
      return [];
    }

    return [[key, String(value)] as const];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

export class ApiError extends Error {
  readonly response: ErrorResponse;

  constructor(response: ErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.response = response;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function readApiError(error: unknown): Promise<ErrorResponse | null> {
  if (!(error instanceof HTTPError)) {
    return null;
  }

  try {
    return (await error.response.clone().json()) as ErrorResponse;
  } catch {
    return null;
  }
}

export function getFieldErrorMessage(details: Record<string, unknown>, field: string) {
  const value = details[field];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  if (
    value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value.message;
  }

  return null;
}
