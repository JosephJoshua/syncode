import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API } from '@syncode/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { type ProfileFormValues, profileFormSchema } from '@/components/profile/profile-form';
import { ProfileFormCard } from '@/components/profile/profile-form-card';
import { ProfileHero } from '@/components/profile/profile-hero';
import { QuotasPanel } from '@/components/profile/quotas-panel';
import { api, getFieldErrorMessage, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

const profileQueryKey = ['users', 'me'] as const;
const quotasQueryKey = ['users', 'me', 'quotas'] as const;

function ProfilePage() {
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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login' }).catch(() => {});
    }
  }, [isAuthenticated, navigate]);

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

  useEffect(() => {
    if (!profileQuery.isError) {
      return;
    }

    void handleUnauthorizedProfileError(profileQuery.error, logout, queryClient, navigate);
  }, [logout, navigate, profileQuery.error, profileQuery.isError, queryClient]);

  useEffect(() => {
    if (!quotasQuery.isError) {
      return;
    }

    void handleUnauthorizedProfileError(quotasQuery.error, logout, queryClient, navigate);
  }, [logout, navigate, queryClient, quotasQuery.error, quotasQuery.isError]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      api(CONTROL_API.USERS.UPDATE, {
        body: {
          username: values.username?.trim() || undefined,
          displayName: values.displayName?.trim() || '',
          bio: values.bio?.trim() || '',
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
      toast.success('Profile updated.');
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
      toast.success('Account deleted.');
      navigate({ to: '/' }).catch(() => {});
    },
    onError: async (error) => {
      const apiError = await readApiError(error);

      if (apiError?.statusCode === 401) {
        logout();
        queryClient.clear();
        navigate({ to: '/login' }).catch(() => {});
        return;
      }

      toast.error('Unable to delete your account right now.');
    },
  });

  const profile = profileQuery.data ?? fallbackUser;
  const quotas = quotasQuery.data;
  const isLoading = profileQuery.isLoading && !profile;
  const profileEmail = profile?.email ?? '';
  const isDeleteConfirmationValid =
    profileEmail.length > 0 && deleteConfirmation.trim() === profileEmail;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
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
                setIsEditing(false);
              }}
              onSubmit={handleSubmit((values) => {
                updateMutation.mutate(values);
              })}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <QuotasPanel quotas={quotas} isLoading={quotasQuery.isLoading} />

          <Card className="bg-[linear-gradient(180deg,oklch(0.18_0.02_22/0.96),oklch(0.15_0.015_18/0.98))] py-0 text-white ring-0">
            <CardHeader className="border-b border-white/10 pb-5">
              <CardTitle className="text-white">Danger zone</CardTitle>
              <CardDescription className="text-white/70">
                Soft-deleting your account will sign you out and disable future access.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-5 sm:px-6">
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

async function handleUnauthorizedProfileError(
  error: unknown,
  logout: () => void,
  queryClient: ReturnType<typeof useQueryClient>,
  navigate: ReturnType<typeof useNavigate>,
) {
  const apiError = await readApiError(error);

  if (apiError?.statusCode !== 401) {
    return;
  }

  logout();
  queryClient.clear();
  navigate({ to: '/login' }).catch(() => {});
}

async function handleProfileUpdateError(
  error: unknown,
  setError: ReturnType<typeof useForm<ProfileFormValues>>['setError'],
) {
  const apiError = await readApiError(error);

  if (!apiError) {
    toast.error('Unable to update your profile right now.');
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
