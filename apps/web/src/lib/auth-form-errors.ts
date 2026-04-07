import { ERROR_CODES, type ErrorResponse } from '@syncode/contracts';
import { getFieldErrorMessage } from '@/lib/api-client';

type LoginField = 'identifier' | 'password';
type RegisterField = 'username' | 'email' | 'password';

type FormErrorResolution<TField extends string> = {
  fieldErrors: Partial<Record<TField, string>>;
  submissionError: string | null;
};

const INVALID_CREDENTIALS_MESSAGE = 'Invalid username, email, or password. Please try again.';
const BANNED_MESSAGE = 'This account has been suspended. Please contact support.';

export function resolveLoginFormError(
  apiError: ErrorResponse | null,
  error: unknown,
): FormErrorResolution<LoginField> {
  if (apiError && isValidationError(apiError)) {
    const fieldErrors = {
      identifier: getDetailFieldMessage(apiError.details, 'identifier'),
      password: getDetailFieldMessage(apiError.details, 'password'),
    };

    if (hasFieldErrors(fieldErrors)) {
      return {
        fieldErrors,
        submissionError: null,
      };
    }

    return {
      fieldErrors: {},
      submissionError: apiError.message || 'Please check your credentials and try again.',
    };
  }

  if (isInvalidCredentialsError(apiError)) {
    return {
      fieldErrors: {},
      submissionError: INVALID_CREDENTIALS_MESSAGE,
    };
  }

  if (isUserBannedError(apiError)) {
    return {
      fieldErrors: {},
      submissionError: BANNED_MESSAGE,
    };
  }

  return {
    fieldErrors: {},
    submissionError: getFallbackErrorMessage(
      apiError,
      error,
      'We could not sign you in right now.',
    ),
  };
}

export function resolveRegisterFormError(
  apiError: ErrorResponse | null,
  error: unknown,
): FormErrorResolution<RegisterField> {
  if (apiError && isValidationError(apiError)) {
    const fieldErrors = {
      username: getDetailFieldMessage(apiError.details, 'username'),
      email: getDetailFieldMessage(apiError.details, 'email'),
      password: getDetailFieldMessage(apiError.details, 'password'),
    };

    if (hasFieldErrors(fieldErrors)) {
      return {
        fieldErrors,
        submissionError: null,
      };
    }

    return {
      fieldErrors: {},
      submissionError: apiError.message || 'Please check your details and try again.',
    };
  }

  if (isEmailTakenError(apiError)) {
    return {
      fieldErrors: {
        email: apiError?.message || 'This email is already in use.',
      },
      submissionError: null,
    };
  }

  if (isUsernameTakenError(apiError)) {
    return {
      fieldErrors: {
        username: apiError?.message || 'This username is already taken.',
      },
      submissionError: null,
    };
  }

  return {
    fieldErrors: {},
    submissionError: getFallbackErrorMessage(
      apiError,
      error,
      'We could not create your account right now.',
    ),
  };
}

function isValidationError(apiError: ErrorResponse | null) {
  return (
    apiError?.code === ERROR_CODES.VALIDATION_FAILED ||
    apiError?.statusCode === 400 ||
    equalsNormalized(apiError?.message, 'Validation failed')
  );
}

function isInvalidCredentialsError(apiError: ErrorResponse | null) {
  return (
    apiError?.code === ERROR_CODES.AUTH_INVALID_CREDENTIALS ||
    (apiError?.statusCode === 401 && hasMessageFragment(apiError, 'invalid credentials'))
  );
}

function isUserBannedError(apiError: ErrorResponse | null) {
  return (
    apiError?.code === ERROR_CODES.USER_BANNED ||
    (apiError?.statusCode === 403 &&
      (hasMessageFragment(apiError, 'banned') || hasMessageFragment(apiError, 'suspended')))
  );
}

function isEmailTakenError(apiError: ErrorResponse | null) {
  return (
    apiError?.code === ERROR_CODES.AUTH_EMAIL_TAKEN ||
    (apiError?.statusCode === 409 &&
      (hasMessageFragment(apiError, 'email') || getDetailFieldMessage(apiError?.details, 'email')))
  );
}

function isUsernameTakenError(apiError: ErrorResponse | null) {
  return (
    apiError?.code === ERROR_CODES.AUTH_USERNAME_TAKEN ||
    apiError?.code === ERROR_CODES.USER_USERNAME_TAKEN ||
    (apiError?.statusCode === 409 &&
      (hasMessageFragment(apiError, 'username') ||
        getDetailFieldMessage(apiError?.details, 'username')))
  );
}

function hasMessageFragment(apiError: ErrorResponse | null, fragment: string) {
  const normalizedFragment = normalizeText(fragment);

  return [apiError?.message, getDetailMessage(apiError?.details)].some((value) =>
    normalizeText(value).includes(normalizedFragment),
  );
}

function getFallbackErrorMessage(
  apiError: ErrorResponse | null,
  error: unknown,
  defaultMessage: string,
) {
  if (apiError?.message) {
    return apiError.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return defaultMessage;
}

function getDetailFieldMessage(details: unknown, field: string) {
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  return getFieldErrorMessage(details as Record<string, unknown>, field) ?? undefined;
}

function getDetailMessage(details: unknown) {
  if (!details || typeof details !== 'object') {
    return '';
  }

  const value = (details as Record<string, unknown>).message;
  return typeof value === 'string' ? value : '';
}

function hasFieldErrors<TField extends string>(fieldErrors: Partial<Record<TField, string>>) {
  return Object.values(fieldErrors).some((message) => Boolean(message));
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function equalsNormalized(value: unknown, expected: string) {
  return normalizeText(value) === normalizeText(expected);
}
