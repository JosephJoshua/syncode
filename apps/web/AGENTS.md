# AGENTS.md — Web Frontend

> Frontend-specific conventions for `apps/web/`. See root [AGENTS.md](../../AGENTS.md) for project-wide context.

## Overview

Vite SPA — NOT Next.js, no SSR. React 19 with SWC compilation.

## Stack

| Concern | Library |
|---|---|
| Routing | TanStack Router (file-based, `src/routes/`) |
| Server state | TanStack React Query |
| Client state | Zustand (`src/stores/`) |
| HTTP | ky (`src/lib/api-client.ts`) — typed routes from `@syncode/contracts` |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Components | shadcn/ui — shared primitives available in `packages/ui/` |
| Forms | react-hook-form + @hookform/resolvers + zod |
| Notifications | sonner |
| Icons | lucide-react |

## Project Layout

```
src/
  lib/
    api-client.ts     Typed HTTP client using ky + CONTROL_API routes
    query-client.ts   TanStack Query client config
  routes/
    __root.tsx        Root layout (nav bar + Outlet)
    index.tsx         Home page ('/')
  stores/
    auth.store.ts     Zustand auth store (access token, user state)
  main.tsx            App entry point
  app.tsx             App component with providers
  index.css           Tailwind imports
  routeTree.gen.ts    Auto-generated route tree (do not edit manually)
  test-setup.ts       Vitest test setup
```

## API Client

`src/lib/api-client.ts` wraps ky with auth token injection:

```typescript
import { CONTROL_API } from '@syncode/contracts/control';

// Usage: typed route definitions from contracts
const response = await api(CONTROL_API.ROOMS.CREATE, { json: body });
```

The client reads the access token from `useAuthStore` (Zustand) and attaches `Authorization: Bearer` header via `beforeRequest` hook.

## File-Based Routing

TanStack Router with `@tanstack/router-plugin` (Vite plugin). Routes are in `src/routes/`:
- `__root.tsx` — root layout (wraps all routes)
- `index.tsx` — `/` route
- `routeTree.gen.ts` — auto-generated, do not edit

Add new routes by creating files in `src/routes/` following TanStack Router conventions.

## Testing

```bash
pnpm --filter @syncode/web test        # Run tests
pnpm --filter @syncode/web test:cov    # With coverage
```

- Environment: jsdom
- Libraries: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- Setup file: `src/test-setup.ts`
- Coverage: Vitest + @vitest/coverage-v8

## Conventions

- **State split:** server state in React Query, client-only state in Zustand — never duplicate
- **Components:** shared/reusable in `packages/ui/`, app-specific in `src/` colocated with routes
- **Env vars:** prefix with `VITE_` for client exposure (e.g., `VITE_API_URL`)
- **Forms:** always use react-hook-form + zod resolver — no uncontrolled forms
