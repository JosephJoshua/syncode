import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Check,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Terminal,
  UserRound,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { GlowOrb, PageBackground } from '@/components/background';
import { AnimatedFormField } from '@/components/form-field';
import { CursorSpotlight } from '@/components/spotlight';
import { TiltCard } from '@/components/tilt';
import { api, getFieldErrorMessage, readApiError } from '@/lib/api-client';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

const CODE_SYMBOLS = ['</', '/>', '{;}', '( )', '[ ]', '&&', '=>', '::', '/**/', '!=', '++', '0x'];

const stagger = (i: number) => ({ delay: 0.1 + i * 0.08 });

const registerFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username must be 30 characters or fewer.')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
    email: z.email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const FloatingSymbols = memo(function FloatingSymbols() {
  const symbols = useMemo(
    () =>
      CODE_SYMBOLS.map((symbol, i) => ({
        symbol,
        left: `${8 + ((i * 7.3) % 84)}%`,
        delay: i * 1.2,
        duration: 12 + (i % 5) * 3,
        size: 10 + (i % 3) * 2,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {symbols.map((s) => (
        <span
          key={s.symbol}
          className="absolute font-mono text-primary/[0.07] select-none"
          style={{
            left: s.left,
            fontSize: `${s.size}px`,
            animation: `float-drift ${s.duration}s ${s.delay}s linear infinite`,
          }}
        >
          {s.symbol}
        </span>
      ))}
    </div>
  );
});

function RegisterPage() {
  const navigate = useNavigate();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      api(CONTROL_API.AUTH.REGISTER, {
        body: {
          username: values.username,
          email: values.email,
          password: values.password,
        },
      }),
    onSuccess: () => {
      successTimerRef.current = setTimeout(() => {
        toast.success('Account created successfully. Please sign in.');
        navigate({ to: '/login' }).catch(() => {});
      }, 600);
    },
    onError: (error) => {
      void handleRegisterError(error, setError, setSubmissionError);
    },
  });

  useEffect(() => {
    return () => clearTimeout(successTimerRef.current);
  }, []);

  const onSubmit = handleSubmit(
    async (values) => {
      clearErrors();
      setSubmissionError(null);
      await registerMutation.mutateAsync(values).catch(() => {});
    },
    () => {
      setSubmissionError('Please review the highlighted fields and try again.');
    },
  );

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
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1"
          >
            <Terminal className="size-3 text-primary" />
            <span className="text-xs font-medium tracking-wider text-primary uppercase">
              Join SynCode
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ...stagger(1), ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Create your{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              SynCode
            </span>{' '}
            account
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ...stagger(2), ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 text-sm text-muted-foreground"
          >
            Start collaborative interview practice with the same focused setup as sign in.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ...stagger(3), ease: [0.16, 1, 0.3, 1] }}
        >
          <TiltCard>
            <Card className="aurora-border border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>
                  Set up your profile to start practicing with your peers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit} noValidate>
                  <AnimatedFormField
                    id="username"
                    label="Username"
                    icon={UserRound}
                    autoComplete="username"
                    placeholder="your_username"
                    error={errors.username?.message}
                    registration={register('username')}
                    staggerDelay={stagger(4).delay}
                  />

                  <AnimatedFormField
                    id="email"
                    label="Email"
                    icon={Mail}
                    autoComplete="email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    registration={register('email')}
                    staggerDelay={stagger(5).delay}
                  />

                  <AnimatedFormField
                    id="password"
                    label="Password"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    error={errors.password?.message}
                    registration={register('password')}
                    staggerDelay={stagger(6).delay}
                  />

                  <AnimatedFormField
                    id="confirmPassword"
                    label="Confirm password"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    error={errors.confirmPassword?.message}
                    registration={register('confirmPassword')}
                    staggerDelay={stagger(7).delay}
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
                    transition={{ duration: 0.4, ...stagger(8) }}
                  >
                    <Button
                      type="submit"
                      disabled={
                        isSubmitting || registerMutation.isPending || registerMutation.isSuccess
                      }
                      className="shimmer-sweep w-full"
                      size="lg"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {registerMutation.isSuccess ? (
                          <motion.span
                            key="success"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2"
                          >
                            <Check className="size-4" />
                            Account created
                          </motion.span>
                        ) : isSubmitting || registerMutation.isPending ? (
                          <motion.span
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            <LoaderCircle className="size-4 animate-spin" />
                            Creating account...
                          </motion.span>
                        ) : submissionError ? (
                          <motion.span
                            key="retry"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            Try again
                            <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            Create account
                            <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </form>
              </CardContent>

              <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono">Provisioning secure workspace</span>
                <span className="ml-auto font-mono text-muted-foreground/50">Ready</span>
              </div>
            </Card>
          </TiltCard>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ...stagger(9) }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            Sign in
          </Link>
        </motion.p>
      </div>
    </div>
  );
}

async function handleRegisterError(
  error: unknown,
  setError: UseFormSetError<RegisterFormValues>,
  setSubmissionError: (message: string) => void,
) {
  const apiError = await readApiError(error);

  if (apiError?.code === ERROR_CODES.AUTH_EMAIL_TAKEN) {
    setError('email', {
      type: 'server',
      message: apiError.message || 'This email is already in use.',
    });
    return;
  }

  if (apiError?.code === ERROR_CODES.AUTH_USERNAME_TAKEN) {
    setError('username', {
      type: 'server',
      message: apiError.message || 'This username is already taken.',
    });
    return;
  }

  if (apiError?.code === ERROR_CODES.VALIDATION_FAILED) {
    if (applyRegisterValidationErrors(apiError.details, setError)) {
      return;
    }

    setSubmissionError(apiError.message || 'Please check your details and try again.');
    return;
  }

  if (apiError) {
    setSubmissionError(apiError.message || 'We could not create your account right now.');
    return;
  }

  if (error instanceof Error) {
    setSubmissionError(error.message);
    return;
  }

  setSubmissionError('We could not create your account right now. Please try again shortly.');
}

function applyRegisterValidationErrors(
  details: unknown,
  setError: UseFormSetError<RegisterFormValues>,
) {
  if (!details || typeof details !== 'object') {
    return false;
  }

  const validationDetails = details as Record<string, unknown>;
  const usernameMessage = getFieldErrorMessage(validationDetails, 'username');
  const emailMessage = getFieldErrorMessage(validationDetails, 'email');
  const passwordMessage = getFieldErrorMessage(validationDetails, 'password');

  if (usernameMessage) {
    setError('username', {
      type: 'server',
      message: usernameMessage,
    });
  }

  if (emailMessage) {
    setError('email', {
      type: 'server',
      message: emailMessage,
    });
  }

  if (passwordMessage) {
    setError('password', {
      type: 'server',
      message: passwordMessage,
    });
  }

  return Boolean(usernameMessage || emailMessage || passwordMessage);
}
