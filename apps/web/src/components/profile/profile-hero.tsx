import type { UserProfileResponse } from '@syncode/contracts';
import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@syncode/ui';
import { Camera, X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton.js';
import { useImageDominantColor } from '@/lib/use-image-color.js';
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
  const glowColor = useImageDominantColor(profile?.avatarUrl);
  const hasAvatar = !!profile?.avatarUrl;

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

  const avatarShadow =
    hasAvatar && glowColor
      ? {
          boxShadow: [
            `0 0 40px -8px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.5)`,
            `0 -8px 30px -10px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.3)`,
            `0 20px 60px -15px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.45)`,
          ].join(', '),
        }
      : undefined;

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
    <div className="profile-fade-up rounded-[28px] bg-card/75 p-5 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {/* Avatar */}
        <div className="group/avatar relative size-20 shrink-0 sm:size-24">
          {/* Animated glow ring behind the avatar */}
          {hasAvatar && glowColor ? (
            <div
              className="avatar-glow-pulse absolute -inset-1.5 rounded-full opacity-60 blur-md"
              style={{
                background: `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.35)`,
              }}
            />
          ) : null}

          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={isUploadPending}
            className="relative size-full cursor-pointer disabled:cursor-wait"
            aria-label={t('avatar.changePhoto')}
          >
            <Avatar
              className={cn(
                'size-full text-2xl transition-all duration-300 sm:text-3xl',
                hasAvatar
                  ? 'avatar-breathe border-0 bg-transparent ring-0'
                  : 'bg-primary/10 text-primary shadow-[0_22px_50px_-28px_oklch(0.68_0.16_254/0.8)] ring-1 ring-primary/15',
              )}
              style={avatarShadow}
            >
              {hasAvatar ? (
                <AvatarImage src={profile.avatarUrl!} alt={getUserDisplayName(profile) ?? ''} />
              ) : null}
              <AvatarFallback>{getUserInitial(profile)}</AvatarFallback>
            </Avatar>

            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-all duration-200 group-hover/avatar:bg-black/40 group-hover/avatar:backdrop-blur-[1px]">
              <Camera className="size-5 scale-90 text-white opacity-0 transition-all duration-200 group-hover/avatar:scale-100 group-hover/avatar:opacity-100" />
            </div>
          </button>

          {/* Remove button */}
          {hasAvatar ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAvatarRemove();
              }}
              disabled={isUploadPending}
              className="absolute -right-1 -top-1 z-10 flex size-5 scale-75 items-center justify-center rounded-full bg-card text-muted-foreground opacity-0 shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:scale-110 hover:text-destructive group-hover/avatar:scale-100 group-hover/avatar:opacity-100 sm:size-6"
              aria-label={t('avatar.removePhoto')}
            >
              <X className="size-2.5 sm:size-3" />
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Profile info */}
        <div className="min-w-0 space-y-3">
          <div className="profile-fade-up" style={{ animationDelay: '80ms' }}>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              {t('hero.label')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {getUserDisplayName(profile) ?? t('hero.heading')}
            </h1>
            <p className="mt-1 text-sm text-primary">@{profile?.username ?? 'username'}</p>
          </div>

          <div
            className="profile-fade-up space-y-1 text-sm text-muted-foreground"
            style={{ animationDelay: '160ms' }}
          >
            <p>{profile?.email ?? t('hero.noEmail')}</p>
            <p>{profile?.bio?.trim() ? profile.bio : t('hero.noBio')}</p>
          </div>

          <div className="profile-fade-up pt-1" style={{ animationDelay: '240ms' }}>
            <Button
              type="button"
              variant={isEditing ? 'secondary' : 'default'}
              className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
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
