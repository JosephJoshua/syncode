import ky, { HTTPError } from 'ky';
import { useAuthStore } from '@/stores/auth.store';
import type { ErrorResponse } from '../../../../packages/contracts/src/control/error';
import {
  buildUrl,
  type RequestOf,
  type ResponseOf,
  type TypedRoute,
} from '../../../../packages/contracts/src/route-utils';

const client = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? '/api',
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
    // TODO: Add afterResponse hook for 401 -> refresh token -> retry
  },
});

/**
 * API helper that uses route definitions from `@syncode/contracts`.
 *
 * @example
 * // GET (no body, no params)
 * const profile = await api(CONTROL_API.USERS.PROFILE);
 *
 * // POST with body
 * const tokens = await api(CONTROL_API.AUTH.LOGIN, {
 *   body: { email: 'a@b.com', password: '...' },
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
const resolveRouteUrl = buildUrl as (template: string, params: Record<string, string>) => string;

export async function api<
  R extends TypedRoute & { readonly route: string; readonly method: string },
>(
  route: R,
  options?: {
    params?: Record<string, string>;
    body?: RequestOf<R>;
  },
): Promise<ResponseOf<R>> {
  const resolvedRoute = options?.params
    ? resolveRouteUrl(route.route, options.params)
    : route.route;
  const url = resolvedRoute.startsWith('/') ? resolvedRoute.slice(1) : resolvedRoute;

  const method = route.method.toLowerCase();

  const response = await client(url, {
    method,
    ...(options?.body === undefined ? {} : { json: options.body }),
  });

  if (response.status === 204) {
    return undefined as ResponseOf<R>;
  }

  return response.json() as Promise<ResponseOf<R>>;
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
