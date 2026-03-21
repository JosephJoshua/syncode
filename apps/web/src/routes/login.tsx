import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthTokensResponse, TypedRoute } from '@syncode/contracts';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { api, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

const loginRoute = {
  route: 'auth/login',
  method: 'POST',
} as const satisfies TypedRoute<
  {
    email?: string;
    username?: string;
    password: string;
  },
  AuthTokensResponse
>;

const loginFormSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
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

  const loginMutation = useMutation<AuthTokensResponse, unknown, LoginFormValues>({
    mutationFn: async (values: LoginFormValues) => {
      const identifier = values.identifier.trim();

      return (await api(loginRoute, {
        body: {
          ...(identifier.includes('@') ? { email: identifier } : { username: identifier }),
          password: values.password,
        },
      })) as AuthTokensResponse;
    },
    onSuccess: async ({ accessToken, refreshToken }) => {
      setSession({ accessToken, refreshToken });
      toast.success('Signed in successfully.');
      await navigate({ to: '/dashboard' });
    },
    onError: async (error) => {
      const apiError = await readApiError(error);

      if (!apiError && error instanceof Error) {
        setError('identifier', {
          type: 'manual',
          message: error.message,
        });
        return;
      }

      if (apiError?.statusCode === 401) {
        setSubmissionError('Invalid username, email, or password. Please try again.');
        return;
      }

      if (apiError?.statusCode === 400) {
        setSubmissionError(apiError.message || 'Please check your credentials and try again.');
        return;
      }

      setSubmissionError('We could not sign you in right now. Please try again in a moment.');
    },
  });

  useEffect(() => {
    if (!loginMutation.isPending) {
      return;
    }

    setSubmissionError(null);
  }, [loginMutation.isPending]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmissionError(null);
    clearErrors('identifier');
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
              Use your account credentials to open your dashboard.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium text-gray-700">
                Email or username
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  aria-invalid={errors.identifier ? 'true' : 'false'}
                  {...register('identifier')}
                />
              </div>
              {errors.identifier ? (
                <p className="text-sm text-red-600">{errors.identifier.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loginMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-500">
            Need a new account?{' '}
            <Link to="/" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Return to the home page
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
