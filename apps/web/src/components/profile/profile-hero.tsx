import type { UserProfileResponse } from '@syncode/contracts';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@syncode/ui';
import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton.js';
import { getUserDisplayName, getUserInitial } from '@/lib/user-utils.js';

interface ProfileHeroProps {
  profile: UserProfileResponse | null;
  isEditing: boolean;
  isLoading: boolean;
  isUploadPending: boolean;
  onEditToggle: () => void;
  onAvatarFileSelect: (file: File) => void;
  onAvatarRemove: () => void;
}

export function ProfileHero({
  profile,
  isEditing,
  isLoading,
  isUploadPending,
  onEditToggle,
  onAvatarFileSelect,
  onAvatarRemove,
}: ProfileHeroProps) {
  const { t } = useTranslation('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarFileSelect(file);
    }
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="rounded-[28px] bg-card/75 p-5 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Skeleton className="size-20 rounded-full sm:size-24" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] bg-card/75 p-5 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="group relative">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={isUploadPending}
            className="relative cursor-pointer disabled:cursor-wait"
            aria-label={t('avatar.changePhoto')}
          >
            <Avatar className="size-20 bg-primary/10 text-2xl text-primary shadow-[0_22px_50px_-28px_oklch(0.68_0.16_254/0.8)] ring-1 ring-primary/15 transition-opacity group-hover:opacity-75 sm:size-24 sm:text-3xl">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={getUserDisplayName(profile) ?? ''} />
              ) : null}
              <AvatarFallback>{getUserInitial(profile)}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
              <Camera className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {profile?.avatarUrl ? (
            <button
              type="button"
              onClick={onAvatarRemove}
              disabled={isUploadPending}
              className="mt-1 w-full text-center text-xs text-muted-foreground hover:text-destructive"
            >
              {t('avatar.removePhoto')}
            </button>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              {t('hero.label')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {getUserDisplayName(profile) ?? t('hero.heading')}
            </h1>
            <p className="mt-1 text-sm text-primary">@{profile?.username ?? 'username'}</p>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{profile?.email ?? t('hero.noEmail')}</p>
            <p>{profile?.bio?.trim() ? profile.bio : t('hero.noBio')}</p>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant={isEditing ? 'secondary' : 'default'}
              className="w-full sm:w-auto"
              onClick={onEditToggle}
            >
              {isEditing ? t('hero.hideEditor') : t('hero.editProfile')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
