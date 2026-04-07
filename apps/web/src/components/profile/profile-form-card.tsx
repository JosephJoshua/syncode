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
import { Skeleton } from '@/components/ui/skeleton';
import type { ProfileFormValues } from './profile-form';

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
      <CardHeader className="border-b border-border/40 pb-5">
        <CardTitle>{t('form.title')}</CardTitle>
        <CardDescription>{t('form.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 py-5 sm:px-6">
        {isLoading ? (
          <ProfileFormSkeleton />
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <Field
              id="username"
              label={t('field.username')}
              hint={t('form.usernameHelp')}
              error={errors.username?.message}
            >
              <Input id="username" autoComplete="username" {...register('username')} />
            </Field>

            <Field
              id="displayName"
              label={t('field.displayName')}
              hint={t('form.displayNameHelp')}
              error={errors.displayName?.message}
            >
              <Input id="displayName" {...register('displayName')} />
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
                  'flex w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15',
                  errors.bio ? 'border-destructive/60 focus-visible:ring-destructive/15' : '',
                )}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2">
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
              >
                {t('button.reset')}
              </Button>
              <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
                {t('button.cancel')}
              </Button>
              <Button type="submit" disabled={isPending || !isDirty}>
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
    <div className="space-y-2">
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
    <div className="space-y-5">
      {['username', 'display-name', 'bio'].map((field) => (
        <div key={field} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className={field === 'bio' ? 'h-28 w-full' : 'h-10 w-full'} />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
