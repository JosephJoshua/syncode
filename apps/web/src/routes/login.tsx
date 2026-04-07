import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, LoaderCircle, LockKeyhole, Mail, Terminal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { GlowOrb, PageBackground } from '@/components/background.js';
import { FloatingSymbols } from '@/components/floating-symbols.js';
import { AnimatedFormField } from '@/components/form-field.js';
import { CursorSpotlight } from '@/components/spotlight.js';
import { TiltCard } from '@/components/tilt.js';
import { api, readApiError } from '@/lib/api-client.js';
import { requireGuest } from '@/lib/auth.js';
import { resolveLoginFormError } from '@/lib/auth-form-errors.js';
import { useAuthStore } from '@/stores/auth.store.js';

const loginFormSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Route = createFileRoute('/login')({
  beforeLoad: requireGuest,
  component: LoginPage,
});

const stagger = (i: number) => ({ delay: 0.1 + i * 0.08 });

function LoginPage() {
  const { t } = useTranslation('login');
  const navigate = useNavigate();
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
        toast.success(t('toast.signedIn'));
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
              {t('badge')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ...stagger(1), ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            {t('heading')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ...stagger(2), ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 text-sm text-muted-foreground"
          >
            {t('sub')}
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
                <CardTitle>{t('cardTitle')}</CardTitle>
                <CardDescription>{t('cardDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit} noValidate>
                  <AnimatedFormField
                    id="identifier"
                    label={t('field.emailOrUsername')}
                    icon={Mail}
                    autoComplete="username"
                    placeholder={t('field.emailOrUsernamePlaceholder')}
                    error={errors.identifier?.message}
                    registration={register('identifier')}
                    staggerDelay={stagger(4).delay}
                  />

                  <AnimatedFormField
                    id="password"
                    label={t('field.password')}
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('field.passwordPlaceholder')}
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
                            {t('button.success')}
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
                            {t('button.signingIn')}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex items-center gap-2"
                          >
                            {t('button.logIn')}
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
                <span className="font-mono">{t('statusBar.encrypted')}</span>
                <span className="ml-auto font-mono text-muted-foreground/50">
                  {t('statusBar.tls')}
                </span>
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
          {t('footer.needAccount')}{' '}
          <Link
            to="/register"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            {t('footer.registerNow')}
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
  const resolution = resolveLoginFormError(apiError, error);

  if (resolution.fieldErrors.identifier) {
    setError('identifier', {
      type: 'server',
      message: resolution.fieldErrors.identifier,
    });
  }

  if (resolution.fieldErrors.password) {
    setError('password', {
      type: 'server',
      message: resolution.fieldErrors.password,
    });
  }

  if (resolution.submissionError) {
    setSubmissionError(resolution.submissionError);
  }
}
