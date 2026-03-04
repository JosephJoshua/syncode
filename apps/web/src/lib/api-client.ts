import type { RequestOf, ResponseOf, TypedRoute } from '@syncode/contracts';
import { buildUrl } from '@syncode/contracts';
import ky from 'ky';
import { useAuthStore } from '@/stores/auth.store';

const resolveUrl = buildUrl as (template: string, params?: Record<string, string>) => string;

const client = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? '/api',
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
export async function api<T extends TypedRoute>(
  route: T & { readonly route: string; readonly method: string },
  options?: {
    params?: Record<string, string>;
    body?: RequestOf<T>;
  },
): Promise<ResponseOf<T>> {
  const template = route.route.startsWith('/') ? route.route.slice(1) : route.route;
  const url = resolveUrl(template, options?.params);

  const method = route.method.toLowerCase();

  const response = await client(url, {
    method,
    ...(options?.body === undefined ? {} : { json: options.body }),
  });

  if (response.status === 204) {
    return undefined as ResponseOf<T>;
  }

  return response.json<ResponseOf<T>>();
}
