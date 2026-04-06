import type { UserProfileResponse } from '@syncode/contracts';
import { Avatar, AvatarFallback, Button } from '@syncode/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserDisplayName, getUserInitial } from '@/lib/user-utils';

interface ProfileHeroProps {
  profile: UserProfileResponse | null;
  isEditing: boolean;
  isLoading: boolean;
  onEditToggle: () => void;
}

export function ProfileHero({ profile, isEditing, isLoading, onEditToggle }: ProfileHeroProps) {
  if (isLoading) {
    return (
      <div className="rounded-[28px] bg-card/75 p-6 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Skeleton className="size-24 rounded-full" />
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
    <div className="rounded-[28px] bg-card/75 p-6 shadow-[0_24px_60px_-38px_oklch(0.2_0.02_260/0.55)] ring-0 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar className="size-24 bg-primary/10 text-3xl text-primary shadow-[0_22px_50px_-28px_oklch(0.68_0.16_254/0.8)] ring-1 ring-primary/15">
          <AvatarFallback>{getUserInitial(profile)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {getUserDisplayName(profile) ?? 'Your profile'}
            </h1>
            <p className="mt-1 text-sm text-primary">@{profile?.username ?? 'username'}</p>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{profile?.email ?? 'No email available'}</p>
            <p>{profile?.bio?.trim() ? profile.bio : 'No bio yet. Add a short intro below.'}</p>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant={isEditing ? 'secondary' : 'default'}
              onClick={onEditToggle}
            >
              {isEditing ? 'Hide editor' : 'Edit profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
