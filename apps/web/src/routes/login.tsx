import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, LoaderCircle, LockKeyhole, Mail, Terminal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { GlowOrb, PageBackground } from '@/components/background';
import { FloatingSymbols } from '@/components/floating-symbols';
import { AnimatedFormField } from '@/components/form-field';
import { CursorSpotlight } from '@/components/spotlight';
import { TiltCard } from '@/components/tilt';
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
    mutationFn: async (values: LoginFormValues) => {
      const response = await api(CONTROL_API.AUTH.LOGIN, {
        body: {
          identifier: values.identifier,
          password: values.password,
        },
      });

      if (!response.accessToken || !response.user) {
        throw new Error('Login response is missing session data.');
      }

      return {
        accessToken: response.accessToken,
        user: response.user,
      };
    },
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
    <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <PageBackground />
      <FloatingSymbols />
      <CursorSpotlight />

      <GlowOrb className="left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 animate-[glowPulse_4s_ease-in-out_infinite]" />
      <GlowOrb
        className="left-1/3 top-2/3 -translate-x-1/2 animate-[glowPulse_6s_ease-in-out_infinite_1s]"
        size="sm"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1"
          >
            <Terminal className="size-3 text-primary" />
            <span className="text-xs font-medium tracking-wider text-primary uppercase">
              Welcome back
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ...stagger(1), ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Sign in to{' '}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              SynCode
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ...stagger(2), ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 text-sm text-muted-foreground"
          >
            Pick up where you left off with collaborative practice.
          </motion.p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ...stagger(3), ease: [0.16, 1, 0.3, 1] }}
        >
          <TiltCard>
            <Card className="aurora-border border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Log in</CardTitle>
                <CardDescription>Use your email or username to continue.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit} noValidate>
                  <AnimatedFormField
                    id="identifier"
                    label="Email or username"
                    icon={Mail}
                    autoComplete="username"
                    placeholder="you@example.com"
                    error={errors.identifier?.message}
                    registration={register('identifier')}
                    staggerDelay={stagger(4).delay}
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
                  />

                  <AnimatePresence>
                    {submissionError ? (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        role="alert"
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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

              {/* Terminal status bar */}
              <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono">Encrypted connection</span>
                <span className="ml-auto font-mono text-muted-foreground/50">TLS 1.3</span>
              </div>
            </Card>
          </TiltCard>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ...stagger(7) }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          Need a new account?{' '}
          <Link
            to="/register"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            Register now
          </Link>
        </motion.p>
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

  if (apiError?.code === ERROR_CODES.VALIDATION_FAILED) {
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
