import { ERROR_CODES, type ErrorResponse } from '@syncode/contracts';
import { describe, expect, test } from 'vitest';
import { resolveLoginFormError, resolveRegisterFormError } from './auth-form-errors';

describe('resolveLoginFormError', () => {
  test('maps invalid credentials even when backend omits code', () => {
    const apiError: ErrorResponse = {
      statusCode: 401,
      message: 'Invalid credentials',
      timestamp: '2026-04-07T03:10:21.221Z',
      details: {
        message: 'Invalid credentials',
        error: 'Unauthorized',
        statusCode: 401,
      },
    };

    expect(resolveLoginFormError(apiError, null)).toEqual({
      fieldErrors: {},
      submissionError: 'Invalid username, email, or password. Please try again.',
    });
  });

  test('maps validation details to login fields', () => {
    const apiError: ErrorResponse = {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Validation failed',
      timestamp: '2026-04-07T03:10:21.221Z',
      details: {
        identifier: 'Enter your email address or username.',
        password: 'Enter your password.',
      },
    };

    expect(resolveLoginFormError(apiError, null)).toEqual({
      fieldErrors: {
        identifier: 'Enter your email address or username.',
        password: 'Enter your password.',
      },
      submissionError: null,
    });
  });

  test('maps banned user responses to a stable submission message', () => {
    const apiError: ErrorResponse = {
      statusCode: 403,
      code: ERROR_CODES.USER_BANNED,
      message: 'User is banned',
      timestamp: '2026-04-07T03:10:21.221Z',
    };

    expect(resolveLoginFormError(apiError, null)).toEqual({
      fieldErrors: {},
      submissionError: 'This account has been suspended. Please contact support.',
    });
  });
});

describe('resolveRegisterFormError', () => {
  test('maps duplicate email conflicts to the email field', () => {
    const apiError: ErrorResponse = {
      statusCode: 409,
      code: ERROR_CODES.AUTH_EMAIL_TAKEN,
      message: 'Email is already in use.',
      timestamp: '2026-04-07T03:10:21.221Z',
    };

    expect(resolveRegisterFormError(apiError, null)).toEqual({
      fieldErrors: {
        email: 'Email is already in use.',
      },
      submissionError: null,
    });
  });

  test('maps duplicate username conflicts to the username field', () => {
    const apiError: ErrorResponse = {
      statusCode: 409,
      code: ERROR_CODES.AUTH_USERNAME_TAKEN,
      message: 'Username is already taken.',
      timestamp: '2026-04-07T03:10:21.221Z',
    };

    expect(resolveRegisterFormError(apiError, null)).toEqual({
      fieldErrors: {
        username: 'Username is already taken.',
      },
      submissionError: null,
    });
  });

  test('maps register validation details to form fields', () => {
    const apiError: ErrorResponse = {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Validation failed',
      timestamp: '2026-04-07T03:10:21.221Z',
      details: {
        username: 'Username must be at least 3 characters.',
        email: 'Enter a valid email address.',
        password: 'Password must be at least 8 characters.',
      },
    };

    expect(resolveRegisterFormError(apiError, null)).toEqual({
      fieldErrors: {
        username: 'Username must be at least 3 characters.',
        email: 'Enter a valid email address.',
        password: 'Password must be at least 8 characters.',
      },
      submissionError: null,
    });
  });
});
