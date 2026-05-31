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
    // Solid splash screen — matches the first frame of the shatter animation.
    // When auth completes, the page renders and the shatter fragments animate
    // away. Transition is seamless: splash → shatter → hero.
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center"
        style={{ backgroundColor: 'oklch(0.82 0.18 165)' }}
      >
        <span
          className="font-display text-6xl uppercase tracking-tight sm:text-8xl"
          style={{ color: 'oklch(0.1 0.005 286 / 0.7)' }}
        >
          SynCode
        </span>
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
