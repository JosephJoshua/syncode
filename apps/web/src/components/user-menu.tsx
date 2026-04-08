import { CONTROL_API } from '@syncode/contracts';
import { Avatar, AvatarFallback } from '@syncode/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, User, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, readApiError } from '@/lib/api-client.js';
import { getUserInitial } from '@/lib/user-utils.js';
import { useAuthStore } from '@/stores/auth.store.js';

export function UserMenu() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const accountInitial = getUserInitial(user);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api(CONTROL_API.AUTH.LOGOUT);
      } catch (error) {
        const apiError = await readApiError(error);

        if (apiError?.statusCode === 401) {
          return;
        }

        throw error;
      }
    },
    onSuccess: () => {
      toast.success(t('toast.signedOut'));
    },
    onError: () => {
      toast.error(t('toast.signOutFailed'));
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate({ to: '/' }).catch(() => {});
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync().catch(() => {});
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('auth.accountMenu')}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/85 text-sm font-semibold text-foreground ring-1 ring-foreground/5 transition-all hover:border-primary/30 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Avatar className="size-9 border-none bg-transparent text-foreground shadow-none ring-0">
            <AvatarFallback className="text-foreground">
              {accountInitial ?? <User className="size-4 text-primary" />}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-36 rounded-xl border border-border/60 bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <DropdownMenu.Item asChild>
            <Link
              to="/profile"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted"
            >
              <UserRound className="size-3.5" />
              {t('auth.profile')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              void handleLogout();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-destructive/10"
            disabled={logoutMutation.isPending}
          >
            <LogOut className="size-3.5" />
            {logoutMutation.isPending ? t('auth.loggingOut') : t('auth.logOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
