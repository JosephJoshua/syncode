import { useQueryClient } from '@tanstack/react-query';
import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const wasAuthenticated = useRef(isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      queryClient.clear();
      navigate({ to: '/login' }).catch(() => {});
    }

    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, navigate, queryClient]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
