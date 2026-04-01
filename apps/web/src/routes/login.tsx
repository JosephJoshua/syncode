import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import { Button, Card, CardContent } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, LoaderCircle, LockKeyhole, Mail, Terminal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageBackground } from '@/components/background';
import { AnimatedFormField } from '@/components/form-field';
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

function SynCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="login-logo-left" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="login-logo-right" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <clipPath id="login-logo-weave-lower">
          <rect x="220" y="320" width="130" height="130" rx="12" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="108" fill="#0a0a14" />
      <g transform="translate(256 256) scale(0.80) translate(-256 -256)">
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="320,56 80,232 320,408"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="url(#login-logo-right)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="320,56 80,232 320,408"
          fill="none"
          stroke="url(#login-logo-left)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          clipPath="url(#login-logo-weave-lower)"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="url(#login-logo-right)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          clipPath="url(#login-logo-weave-lower)"
        />
      </g>
    </svg>
  );
}

const stagger = (i: number) => ({ delay: 0.1 + i * 0.08 });

function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  useEffect(() => {
    return () => clearTimeout(successTimerRef.current);
  }, []);

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      api(CONTROL_API.AUTH.LOGIN, {
        body: {
          identifier: values.identifier,
          password: values.password,
        },
      }),
    onSuccess: ({ accessToken, user }) => {
      // Delay navigation to show the success animation
      successTimerRef.current = setTimeout(() => {
        setSession({ accessToken, user });
        toast.success('Signed in successfully.');
        navigate({ to: '/dashboard' }).catch(() => {});
      }, 600);
    },
    onError: (error) => {
      void handleLoginError(error, setError, setSubmissionError);
    },
  });

  const onSubmit = handleSubmit((values) => {
    clearErrors();
    setSubmissionError(null);
    loginMutation.mutate(values);
  });

  return (
    <div className="relative isolate min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at top, color-mix(in oklab, var(--primary) 8%, transparent), transparent 32%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <PageBackground />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mb-5 flex w-fit flex-col items-center gap-3"
            >
              <SynCodeLogo className="h-14 w-14" />
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  SynCode
                </p>
                <div className="inline-flex items-center gap-2 text-xs text-primary">
                  <Terminal className="size-3" />
                  <span className="font-medium tracking-wide uppercase">Welcome back</span>
                </div>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ...stagger(1), ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl font-bold tracking-tight text-foreground"
            >
              Sign in to continue
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ...stagger(2), ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 text-sm text-muted-foreground"
            >
              Use your email or username to access your interview workspace.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ...stagger(3), ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="border border-border/60 bg-card shadow-none">
              <CardContent className="px-5 pt-4.5 pb-4.5 sm:px-6 sm:pt-5 sm:pb-5">
                <form className="space-y-3" onSubmit={onSubmit} noValidate>
                  <div className="space-y-2.5">
                    <AnimatedFormField
                      id="identifier"
                      label="Email or username"
                      icon={Mail}
                      autoComplete="username"
                      placeholder="you@example.com"
                      error={errors.identifier?.message}
                      registration={register('identifier')}
                      staggerDelay={stagger(4).delay}
                      fieldClassName="space-y-1.5"
                      labelClassName="text-[0.75rem] font-medium tracking-[0.02em] text-foreground/82"
                      inputWrapperClassName="rounded-xl"
                      inputClassName="h-12 rounded-xl border-border/80 bg-muted/35 px-4 py-3 pl-11 text-[0.9375rem] placeholder:text-muted-foreground/75 dark:bg-card/75"
                      iconClassName="left-3.5 size-4 text-foreground/50"
                    />

                    <AnimatedFormField
                      id="password"
                      label="Password"
                      icon={LockKeyhole}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      error={errors.password?.message}
                      registration={register('password')}
                      staggerDelay={stagger(5).delay}
                      fieldClassName="space-y-1.5"
                      labelClassName="text-[0.75rem] font-medium tracking-[0.02em] text-foreground/82"
                      inputWrapperClassName="rounded-xl"
                      inputClassName="h-12 rounded-xl border-border/80 bg-muted/35 px-4 py-3 pl-11 text-[0.9375rem] placeholder:text-muted-foreground/75 dark:bg-card/75"
                      iconClassName="left-3.5 size-4 text-foreground/50"
                    />
                  </div>

                  <AnimatePresence>
                    {submissionError ? (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm leading-5 text-destructive"
                      >
                        {submissionError}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ...stagger(6) }}
                  >
                    <Button
                      type="submit"
                      disabled={loginMutation.isPending || loginMutation.isSuccess}
                      className="shimmer-sweep w-full"
                      size="lg"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {loginMutation.isSuccess ? (
                          <motion.span
                            key="success"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2"
                          >
                            <Check className="size-4" />
                            Success
                          </motion.span>
                        ) : loginMutation.isPending ? (
                          <motion.span
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            <LoaderCircle className="size-4 animate-spin" />
                            Signing in...
                          </motion.span>
                        ) : (
                          <motion.span
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            Log in
                            <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ...stagger(7) }}
            className="mt-3.5 text-center text-sm leading-6 text-muted-foreground"
          >
            Need a new account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              Register now
            </Link>
          </motion.p>
        </div>
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
