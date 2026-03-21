import type { ErrorResponse, LoginInput, LoginResponse, TypedRoute } from '@syncode/contracts';
import { api, readApiError } from '@/lib/api-client';

const loginRoute = {
  route: 'auth/login',
  method: 'POST',
} as const satisfies TypedRoute<LoginInput, LoginResponse>;

export class LoginApiError extends Error {
  constructor(
    message: string,
    readonly error: ErrorResponse | null,
  ) {
    super(message);
    this.name = 'LoginApiError';
  }
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  try {
    const response = await api(loginRoute, {
      body: input,
    });

    return response as LoginResponse;
  } catch (error) {
    const apiError = await readApiError(error);

    throw new LoginApiError(apiError?.message ?? 'Login request failed.', apiError);
  }
}
