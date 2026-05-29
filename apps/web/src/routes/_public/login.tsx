import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { LockKeyhole, Mail } from 'lucide-react';
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
import { resolveLoginFormError } from '@/lib/auth-form-errors.js';
import { useAuthStore } from '@/stores/auth.store.js';

const loginFormSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_public/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: requireGuest,
  component: LoginPage,
});

const stagger = (i: number) => ({ delay: 0.1 + i * 0.06 });

function LoginPage() {
  const { t } = useTranslation('login');
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
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
      successTimerRef.current = setTimeout(() => {
        setSession({ accessToken, user });
        toast.success(t('toast.signedIn'));
        navigate({ to: redirectTo ?? '/dashboard' }).catch(() => {});
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
    <AuthPageShell color="cyan" tagline={t('tagline')}>
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
            id="identifier"
            label={t('field.emailOrUsername')}
            icon={Mail}
            autoComplete="username"
            placeholder={t('field.emailOrUsernamePlaceholder')}
            error={errors.identifier?.message}
            registration={register('identifier')}
            staggerDelay={stagger(0).delay}
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
            staggerDelay={stagger(1).delay}
          />

          <FormErrorAlert message={submissionError} />

          <AuthSubmitButton
            isPending={loginMutation.isPending}
            isSuccess={loginMutation.isSuccess}
            idleLabel={t('button.logIn')}
            pendingLabel={t('button.signingIn')}
            successLabel={t('button.success')}
            staggerDelay={stagger(2).delay}
          />
        </form>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="mt-6 text-center text-sm text-white/30"
      >
        {t('footer.needAccount')}{' '}
        <Link
          to="/register"
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t('footer.registerNow')}
        </Link>
      </motion.p>
    </AuthPageShell>
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
