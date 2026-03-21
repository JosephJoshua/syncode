import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { AccessTokenResponse, TypedRoute } from '@syncode/contracts';
import { LoaderCircle, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { api, readApiError } from '@/lib/api-client';

const registerRoute = {
  route: 'auth/register',
  method: 'POST',
} as const satisfies TypedRoute<
  {
    username: string;
    email: string;
    password: string;
  },
  AccessTokenResponse
>;

const registerFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(32, 'Username must be 32 characters or fewer.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores.'),
  email: z.email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.'),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const registerMutation = useMutation<AccessTokenResponse, unknown, RegisterFormValues>({
    mutationFn: async (values) =>
      ((await api(registerRoute, {
        body: {
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        },
      })) as AccessTokenResponse),
    onSuccess: async () => {
      toast.success('Account created. You can log in now.');
      await navigate({ to: '/login' });
    },
    onError: async (error) => {
      const apiError = await readApiError(error);

      if (apiError?.statusCode === 409) {
        setError('email', {
          type: 'server',
          message: 'That email is already registered.',
        });
        return;
      }

      if (apiError?.statusCode === 400) {
        setError('email', {
          type: 'server',
          message: apiError.message || 'Please review your registration details.',
        });
        return;
      }

      if (error instanceof Error) {
        setError('email', {
          type: 'server',
          message: error.message,
        });
        return;
      }

      setError('email', {
        type: 'server',
        message: 'We could not create your account right now. Please try again shortly.',
      });
    },
  });

  const onSubmit = handleSubmit((values) => {
    clearErrors('email');
    registerMutation.mutate(values);
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center px-4 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Create your account
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Start practicing interviews with your team.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-gray-600">
            Set up your SynCode account to collaborate in coding rooms, run code, and review
            interview sessions together.
          </p>
          <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
            <p className="text-sm font-semibold text-emerald-900">Account setup</p>
            <p className="mt-2 text-sm leading-6 text-emerald-950/80">
              Choose a username you can also use later when signing in with either username and
              password or email and password.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">Register</h2>
            <p className="mt-2 text-sm text-gray-600">
              Create your account, then continue to the login page.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="code_partner"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  aria-invalid={errors.username ? 'true' : 'false'}
                  {...register('username')}
                />
              </div>
              {errors.username ? (
                <p className="text-sm text-red-600">{errors.username.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  {...register('email')}
                />
              </div>
              {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Choose a secure password"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  {...register('password')}
                />
              </div>
              {errors.password ? (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {registerMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-500">
              Go to login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
