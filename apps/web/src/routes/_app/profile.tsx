import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog.js';
import { type ProfileFormValues, profileFormSchema } from '@/components/profile/profile-form.js';
import { ProfileFormCard } from '@/components/profile/profile-form-card.js';
import { ProfileHero } from '@/components/profile/profile-hero.js';
import { QuotasPanel } from '@/components/profile/quotas-panel.js';
import { api, getFieldErrorMessage, readApiError } from '@/lib/api-client.js';
import i18n from '@/lib/i18n.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
});

const profileQueryKey = ['users', 'me'] as const;
const quotasQueryKey = ['users', 'me', 'quotas'] as const;

function ProfilePage() {
  const { t } = useTranslation('profile');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fallbackUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: '',
      displayName: '',
      bio: '',
    },
  });

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    enabled: isAuthenticated,
    queryFn: () => api(CONTROL_API.USERS.PROFILE),
  });

  const quotasQuery = useQuery({
    queryKey: quotasQueryKey,
    enabled: isAuthenticated,
    queryFn: () => api(CONTROL_API.USERS.QUOTAS),
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setUser(profileQuery.data);
    reset({
      username: profileQuery.data.username,
      displayName: profileQuery.data.displayName ?? '',
      bio: profileQuery.data.bio ?? '',
    });
  }, [profileQuery.data, reset, setUser]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      api(CONTROL_API.USERS.UPDATE, {
        body: {
          username: values.username?.trim() || undefined,
          displayName: values.displayName?.trim() || undefined,
          bio: values.bio?.trim() || undefined,
        },
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(profileQueryKey, user);
      setUser(user);
      reset({
        username: user.username,
        displayName: user.displayName ?? '',
        bio: user.bio ?? '',
      });
      setIsEditing(false);
      toast.success(t('toast.profileUpdated'));
    },
    onError: (error) => {
      void handleProfileUpdateError(error, setError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(CONTROL_API.USERS.DELETE),
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      logout();
      queryClient.clear();
      toast.success(t('deleteToast.accountDeleted'));
      navigate({ to: '/' }).catch(() => {});
    },
    onError: () => {
      toast.error(t('deleteToast.deleteFailed'));
    },
  });

  const profile = profileQuery.data ?? fallbackUser;
  const quotas = quotasQuery.data;
  const isLoading = profileQuery.isLoading && !profile;
  const profileEmail = profile?.email ?? '';
  const isDeleteConfirmationValid =
    profileEmail.length > 0 &&
    deleteConfirmation.trim().toLowerCase() === profileEmail.toLowerCase();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8 lg:py-12">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] lg:gap-8">
        <div className="space-y-5 sm:space-y-6">
          <ProfileHero
            profile={profile}
            isEditing={isEditing}
            isLoading={isLoading}
            onEditToggle={() => {
              setIsEditing((current) => !current);
            }}
          />

          {isEditing ? (
            <ProfileFormCard
              errors={errors}
              isDirty={isDirty}
              isLoading={isLoading}
              isPending={updateMutation.isPending}
              profile={profile}
              register={register}
              reset={reset}
              onCancel={() => {
                if (profile) {
                  reset({
                    username: profile.username,
                    displayName: profile.displayName ?? '',
                    bio: profile.bio ?? '',
                  });
                }
                setIsEditing(false);
              }}
              onSubmit={handleSubmit((values) => {
                updateMutation.mutate(values);
              })}
            />
          ) : null}
        </div>

        <div className="space-y-5 sm:space-y-6">
          <QuotasPanel quotas={quotas} isLoading={quotasQuery.isLoading} />

          <Card className="bg-[linear-gradient(180deg,oklch(0.18_0.02_22/0.96),oklch(0.15_0.015_18/0.98))] py-0 text-white ring-0">
            <CardHeader className="border-b border-white/10 px-5 pt-6 pb-5 sm:px-6 sm:pt-7">
              <CardTitle className="text-white">{t('dangerZone.heading')}</CardTitle>
              <CardDescription className="text-white/70">
                {t('dangerZone.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pt-5 pb-6 sm:px-6 sm:pb-6">
              <DeleteAccountDialog
                confirmationEmail={deleteConfirmation}
                isPending={deleteMutation.isPending}
                isValid={isDeleteConfirmationValid}
                open={isDeleteDialogOpen}
                profileEmail={profile?.email}
                onConfirmationEmailChange={setDeleteConfirmation}
                onDelete={() => {
                  deleteMutation.mutate();
                }}
                onOpenChange={(open) => {
                  setIsDeleteDialogOpen(open);
                  if (!open) {
                    setDeleteConfirmation('');
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

async function handleProfileUpdateError(
  error: unknown,
  setError: ReturnType<typeof useForm<ProfileFormValues>>['setError'],
) {
  const apiError = await readApiError(error);

  if (!apiError) {
    toast.error(i18n.t('profile:toast.updateFailed'));
    return;
  }

  const details = apiError.details && typeof apiError.details === 'object' ? apiError.details : {};
  const usernameError = getFieldErrorMessage(details as Record<string, unknown>, 'username');
  const displayNameError = getFieldErrorMessage(details as Record<string, unknown>, 'displayName');
  const bioError = getFieldErrorMessage(details as Record<string, unknown>, 'bio');

  if (usernameError) {
    setError('username', { message: usernameError });
  }

  if (displayNameError) {
    setError('displayName', { message: displayNameError });
  }

  if (bioError) {
    setError('bio', { message: bioError });
  }

  if (!usernameError && !displayNameError && !bioError) {
    toast.error(apiError.message);
  }
}
