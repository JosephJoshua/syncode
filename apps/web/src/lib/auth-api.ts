import type { ErrorResponse, LoginInput, LoginResponse } from '@syncode/contracts';
import { CONTROL_API } from '@syncode/contracts';
import { api, readApiError } from '@/lib/api-client';

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
    const response = await api(CONTROL_API.AUTH.LOGIN, {
      body: input,
    });

    return response as LoginResponse;
  } catch (error) {
    const apiError = await readApiError(error);

    throw new LoginApiError(apiError?.message ?? 'Login request failed.', apiError);
  }
}
