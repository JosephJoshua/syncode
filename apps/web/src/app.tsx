import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { initializeAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';

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
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
