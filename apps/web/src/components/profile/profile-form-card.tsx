import type { UserProfileResponse } from '@syncode/contracts';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
} from '@syncode/ui';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FieldErrors, UseFormRegister, UseFormReset } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton.js';
import type { ProfileFormValues } from './profile-form.js';

interface ProfileFormCardProps {
  errors: FieldErrors<ProfileFormValues>;
  isDirty: boolean;
  isLoading: boolean;
  isPending: boolean;
  profile: UserProfileResponse | null;
  register: UseFormRegister<ProfileFormValues>;
  reset: UseFormReset<ProfileFormValues>;
  onCancel: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export function ProfileFormCard({
  errors,
  isDirty,
  isLoading,
  isPending,
  profile,
  register,
  reset,
  onCancel,
  onSubmit,
}: ProfileFormCardProps) {
  const { t } = useTranslation('profile');

  return (
    <Card className="bg-card/75 py-0 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0">
      <CardHeader className="border-b border-border/40 px-5 pt-6 pb-5 sm:px-6 sm:pt-7">
        <CardTitle>{t('form.title')}</CardTitle>
        <CardDescription>{t('form.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pt-5 pb-6 sm:px-6 sm:pb-6">
        {isLoading ? (
          <ProfileFormSkeleton />
        ) : (
          <form className="space-y-4 sm:space-y-5" onSubmit={onSubmit}>
            <Field
              id="username"
              label={t('field.username')}
              hint={t('form.usernameHelp')}
              error={errors.username?.message}
            >
              <Input
                id="username"
                autoComplete="username"
                className={getProfileInputClassName(Boolean(errors.username))}
                {...register('username')}
              />
            </Field>

            <Field
              id="displayName"
              label={t('field.displayName')}
              hint={t('form.displayNameHelp')}
              error={errors.displayName?.message}
            >
              <Input
                id="displayName"
                className={getProfileInputClassName(Boolean(errors.displayName))}
                {...register('displayName')}
              />
            </Field>

            <Field
              id="bio"
              label={t('field.bio')}
              hint={t('form.bioHelp')}
              error={errors.bio?.message}
            >
              <textarea
                id="bio"
                rows={5}
                {...register('bio')}
                className={cn(
                  'min-h-32 flex w-full rounded-xl border px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:ring-2',
                  getProfileInputClassName(Boolean(errors.bio)),
                )}
              />
            </Field>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={isPending || !profile}
                onClick={() => {
                  if (!profile) {
                    return;
                  }

                  reset({
                    username: profile.username,
                    displayName: profile.displayName ?? '',
                    bio: profile.bio ?? '',
                  });
                }}
                className="w-full sm:w-auto"
              >
                {t('button.reset')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={onCancel}
                className="w-full sm:w-auto"
              >
                {t('button.cancel')}
              </Button>
              <Button type="submit" disabled={isPending || !isDirty} className="w-full sm:w-auto">
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" />
                    {t('button.saving')}
                  </span>
                ) : (
                  t('button.saveChanges')
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      {['username', 'display-name', 'bio'].map((field) => (
        <div key={field} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className={field === 'bio' ? 'h-28 w-full' : 'h-10 w-full'} />
        </div>
      ))}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <Skeleton className="h-10 w-full sm:w-20" />
        <Skeleton className="h-10 w-full sm:w-24" />
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>
    </div>
  );
}

function getProfileInputClassName(hasError: boolean) {
  return cn(
    'border-border/70 bg-muted/55 focus-visible:border-primary/40 focus-visible:ring-primary/15',
    hasError ? 'border-destructive/60 focus-visible:ring-destructive/15' : '',
  );
}
