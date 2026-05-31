import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { LockKeyhole, Mail, UserRound } from 'lucide-react';
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
import { api, readApiError } from '@/lib/api-client.js';
import { requireGuest } from '@/lib/auth.js';
import { resolveRegisterFormError } from '@/lib/auth-form-errors.js';
import i18n from '@/lib/i18n.js';

export const Route = createFileRoute('/_public/register')({
  beforeLoad: requireGuest,
  component: RegisterPage,
});

const stagger = (i: number) => ({ delay: 0.1 + i * 0.06 });

const registerFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, i18n.t('register:validation.usernameMinLength'))
      .max(30, i18n.t('register:validation.usernameMaxLength'))
      .regex(/^\w+$/, i18n.t('register:validation.usernamePattern')),
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
    <AuthPageShell color="coral" tagline={t('tagline')}>
      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
      >
        {t('heading')}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="mt-2 text-sm text-white/40"
      >
        {t('sub')}
      </motion.p>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8"
      >
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <AnimatedFormField
            id="username"
            label={t('field.username')}
            icon={UserRound}
            autoComplete="username"
            placeholder={t('field.usernamePlaceholder')}
            error={errors.username?.message}
            registration={register('username')}
            staggerDelay={stagger(0).delay}
          />

          <AnimatedFormField
            id="email"
            label={t('field.email')}
            icon={Mail}
            autoComplete="email"
            placeholder={t('field.emailPlaceholder')}
            error={errors.email?.message}
            registration={register('email')}
            staggerDelay={stagger(1).delay}
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
            staggerDelay={stagger(2).delay}
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
            staggerDelay={stagger(3).delay}
          />

          <FormErrorAlert message={submissionError} />

          <AuthSubmitButton
            isPending={isSubmitting || registerMutation.isPending}
            isSuccess={registerMutation.isSuccess}
            idleLabel={submissionError ? t('button.tryAgain') : t('button.createAccount')}
            pendingLabel={t('button.creatingAccount')}
            successLabel={t('button.accountCreated')}
            staggerDelay={stagger(4).delay}
          />
        </form>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.42 }}
        className="mt-6 text-center text-sm text-white/30"
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
