import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { initializeAuth } from '@/lib/auth.js';
import { queryClient } from '@/lib/query-client.js';
import { routeTree } from './routeTree.gen.js';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initializeAuth().finally(() => {
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
