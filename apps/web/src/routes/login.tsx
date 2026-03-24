import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginResponse } from '@syncode/contracts/control/auth';
import { ERROR_CODES } from '@syncode/contracts/control/error';
import { CONTROL_API } from '@syncode/contracts/control/routes';
import { Button, Input, Label } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { api, getFieldErrorMessage, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

const loginFormSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' }).catch(() => {});
    }
  }, [isAuthenticated, navigate]);

  const loginMutation = useMutation<LoginResponse, unknown, LoginFormValues>({
    mutationFn: (values: LoginFormValues): Promise<LoginResponse> =>
      api<typeof CONTROL_API.AUTH.LOGIN>(CONTROL_API.AUTH.LOGIN, {
        body: {
          identifier: values.identifier,
          password: values.password,
        },
      }) as Promise<LoginResponse>,
    onSuccess: ({ accessToken, user }) => {
      setSession({
        accessToken,
        user: user ?? null,
      });
      toast.success('Signed in successfully.');
      navigate({ to: '/dashboard' }).catch(() => {});
    },
    onError: (error) => {
      void handleLoginError(error, setError, setSubmissionError);
    },
  });

  useEffect(() => {
    if (!loginMutation.isPending) {
      return;
    }

    setSubmissionError(null);
  }, [loginMutation.isPending]);

  const onSubmit = handleSubmit((values) => {
    clearErrors();
    loginMutation.mutate(values);
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center px-4 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
            Welcome back
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Sign in to continue your interview practice.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-gray-600">
            Access collaborative rooms, saved sessions, and AI feedback from one place.
          </p>
          <div className="mt-8 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6">
            <p className="text-sm font-semibold text-indigo-900">Flexible sign-in</p>
            <p className="mt-2 text-sm leading-6 text-indigo-950/80">
              Use either your username and password or your email and password to sign in.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">Log in</h2>
            <p className="mt-2 text-sm text-gray-600">
              Use your account credentials to continue your session.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or username</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="pl-10 pr-4"
                  aria-invalid={errors.identifier ? 'true' : 'false'}
                  {...register('identifier')}
                />
              </div>
              {errors.identifier ? (
                <p className="text-sm text-red-600">{errors.identifier.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pl-10 pr-4"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  {...register('password')}
                />
              </div>
              {errors.password ? (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              ) : null}
            </div>

            {submissionError ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {submissionError}
              </div>
            ) : null}

            <Button type="submit" disabled={loginMutation.isPending} className="w-full">
              {loginMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-sm text-gray-500">
            Need a new account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Register now
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

async function handleLoginError(
  error: unknown,
  setError: UseFormSetError<LoginFormValues>,
  setSubmissionError: (message: string) => void,
) {
  const apiError = await readApiError(error);

  if (apiError?.code === ERROR_CODES.AUTH_INVALID_CREDENTIALS) {
    setSubmissionError('Invalid username, email, or password. Please try again.');
    return;
  }

  if (apiError?.code === ERROR_CODES.USER_BANNED) {
    setSubmissionError('This account has been suspended. Please contact support.');
    return;
  }

  if (apiError?.code === ERROR_CODES.VALIDATION_ERROR) {
    if (applyValidationErrors(apiError.details, setError)) {
      return;
    }

    setSubmissionError(apiError.message || 'Please check your credentials and try again.');
    return;
  }

  if (error instanceof Error) {
    setSubmissionError(error.message);
    return;
  }

  setSubmissionError('We could not sign you in right now. Please try again in a moment.');
}

function applyValidationErrors(details: unknown, setError: UseFormSetError<LoginFormValues>) {
  if (!details || typeof details !== 'object') {
    return false;
  }

  const validationDetails = details as Record<string, unknown>;
  const identifierMessage = getFieldErrorMessage(validationDetails, 'identifier');
  const passwordMessage = getFieldErrorMessage(validationDetails, 'password');

  if (identifierMessage) {
    setError('identifier', {
      type: 'server',
      message: identifierMessage,
    });
  }

  if (passwordMessage) {
    setError('password', {
      type: 'server',
      message: passwordMessage,
    });
  }

  return Boolean(identifierMessage || passwordMessage);
}
