import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { LockKeyhole, Mail, Terminal, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthPageShell } from '@/components/auth-page-shell.js';
import { AuthSubmitButton } from '@/components/auth-submit-button.js';
import { FormErrorAlert } from '@/components/form-error-alert.js';
import { AnimatedFormField } from '@/components/form-field.js';
import { TiltCard } from '@/components/tilt.js';
import { api, readApiError } from '@/lib/api-client.js';
import { requireGuest } from '@/lib/auth.js';
import { resolveRegisterFormError } from '@/lib/auth-form-errors.js';
import i18n from '@/lib/i18n.js';

export const Route = createFileRoute('/_public/register')({
  beforeLoad: requireGuest,
  component: RegisterPage,
});

const stagger = (i: number) => ({ delay: 0.1 + i * 0.08 });

const registerFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, i18n.t('register:validation.usernameMinLength'))
      .max(30, i18n.t('register:validation.usernameMaxLength'))
      .regex(/^[a-zA-Z0-9_]+$/, i18n.t('register:validation.usernamePattern')),
    email: z.email(i18n.t('register:validation.emailInvalid')),
    password: z.string().min(8, i18n.t('register:validation.passwordMinLength')),
    confirmPassword: z.string().min(1, i18n.t('register:validation.confirmPasswordRequired')),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: i18n.t('register:validation.passwordsMismatch'),
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

function RegisterPage() {
  const { t } = useTranslation('register');
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
        toast.success(t('toast.accountCreated'));
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
      setSubmissionError(t('validation.reviewFields'));
    },
  );

  return (
    <AuthPageShell>
      <div className="mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1"
        >
          <Terminal className="size-3 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
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
                  id="username"
                  label={t('field.username')}
                  icon={UserRound}
                  autoComplete="username"
                  placeholder={t('field.usernamePlaceholder')}
                  error={errors.username?.message}
                  registration={register('username')}
                  staggerDelay={stagger(4).delay}
                />

                <AnimatedFormField
                  id="email"
                  label={t('field.email')}
                  icon={Mail}
                  autoComplete="email"
                  placeholder={t('field.emailPlaceholder')}
                  error={errors.email?.message}
                  registration={register('email')}
                  staggerDelay={stagger(5).delay}
                />

                <AnimatedFormField
                  id="password"
                  label={t('field.password')}
                  icon={LockKeyhole}
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('field.passwordPlaceholder')}
                  error={errors.password?.message}
                  registration={register('password')}
                  staggerDelay={stagger(6).delay}
                />

                <AnimatedFormField
                  id="confirmPassword"
                  label={t('field.confirmPassword')}
                  icon={LockKeyhole}
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('field.confirmPasswordPlaceholder')}
                  error={errors.confirmPassword?.message}
                  registration={register('confirmPassword')}
                  staggerDelay={stagger(7).delay}
                />

                <FormErrorAlert message={submissionError} />

                <AuthSubmitButton
                  isPending={isSubmitting || registerMutation.isPending}
                  isSuccess={registerMutation.isSuccess}
                  idleLabel={submissionError ? t('button.tryAgain') : t('button.createAccount')}
                  pendingLabel={t('button.creatingAccount')}
                  successLabel={t('button.accountCreated')}
                  staggerDelay={stagger(8).delay}
                />
              </form>
            </CardContent>

            <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <span className="font-mono">{t('statusBar.secure')}</span>
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
        transition={{ duration: 0.5, ...stagger(9) }}
        className="mt-6 text-center text-sm text-muted-foreground"
      >
        {t('footer.hasAccount')}{' '}
        <Link
          to="/login"
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t('footer.signIn')}
        </Link>
      </motion.p>
    </AuthPageShell>
  );
}

async function handleRegisterError(
  error: unknown,
  setError: UseFormSetError<RegisterFormValues>,
  setSubmissionError: (message: string) => void,
) {
  const apiError = await readApiError(error);
  const resolution = resolveRegisterFormError(apiError, error);

  if (resolution.fieldErrors.username) {
    setError('username', {
      type: 'server',
      message: resolution.fieldErrors.username,
    });
  }

  if (resolution.fieldErrors.email) {
    setError('email', {
      type: 'server',
      message: resolution.fieldErrors.email,
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
