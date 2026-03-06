# AGENTS.md — SynCode

> Canonical context for AI coding agents. Nested `AGENTS.md` files in subdirectories provide domain-specific detail.

## What is SynCode?

Collaborative technical interview training platform. CS students practice coding interviews together with real-time collaborative editing (Yjs CRDT), code execution in sandboxed environments, AI-powered feedback, and session replay. Monorepo using hexagonal architecture (ports & adapters) throughout.

## Commands

```bash
# Development
pnpm dev                  # Start all apps (turbo)
pnpm build                # Build all workspaces
pnpm typecheck            # TypeScript checks across all workspaces

# Testing
pnpm test                 # Run all tests
pnpm test:cov             # Run tests with coverage

# Code quality — Biome 2.x (NOT ESLint/Prettier)
pnpm check                # Biome check (lint + format verify)
pnpm lint:fix             # Biome auto-fix (lint + format)
pnpm format               # Biome format (write)
pnpm lint                 # Turbo lint (per-workspace)

# Database
pnpm db:generate          # Generate Drizzle migrations from schema changes
pnpm db:migrate           # Run pending migrations
pnpm db:studio            # Open Drizzle Studio (DB browser)

# Infrastructure
pnpm infra:up             # Start postgres + redis (dev)
pnpm infra:down           # Stop all infra
pnpm infra:full           # Start postgres + redis + LGTM observability stack
pnpm infra:logs           # Tail docker compose logs
```

## Project Structure

```
apps/
  web/              React 19 + Vite SPA (NOT Next.js)
  control-plane/    NestJS REST API — auth, business logic, orchestration
  collab-plane/     NestJS WebSocket server — Yjs CRDT collaboration
  execution-plane/  NestJS standalone worker — sandboxed code execution
  ai-plane/         NestJS standalone worker — AI hints, reviews, interviews

packages/
  contracts/      Typed inter-plane contracts, route definitions, DI tokens, stubs
  db/             Drizzle ORM — schema, migrations, client factory
  infrastructure/ Concrete adapters (BullMQ, Redis, S3, LiveKit, circuit breaker)
  shared/         Types, Zod schemas, constants, port interfaces
  tsconfig/       Shared tsconfig bases
  ui/             Shared React components (shadcn/ui primitives)

infra/            Nginx, Caddy, Docker, Grafana, OTel, Prometheus, Loki, Tempo, scripts
e2e/              Playwright end-to-end tests
docs/             ADRs, architecture docs, contributing guide
```

## Architecture — Hexagonal (Ports & Adapters)

Every infrastructure dependency is behind an abstract interface.

**Port interfaces** — `packages/shared/src/ports/`:

| Port | Token | Adapter (in `packages/infrastructure/`) |
|---|---|---|
| `ICacheService` | `CACHE_SERVICE` | `RedisCacheAdapter` |
| `IQueueService` | `QUEUE_SERVICE` | `BullMqAdapter` |
| `IStorageService` | `STORAGE_SERVICE` | `S3StorageAdapter` |
| `IMediaService` | `MEDIA_SERVICE` | `LiveKitAdapter` |
| `ISandboxProvider` | `SANDBOX_PROVIDER` | (E2B / Kata — in app) |

**Rules:**
- Feature modules NEVER import adapters directly — `@Inject(QUEUE_SERVICE)` to get `IQueueService`
- `infrastructure.module.ts` in each app is the ONLY place adapter ↔ token bindings live
- All adapters are wrapped with circuit breaker proxies in production

## Plane Communication

| From → To | Method | Contract Client | Token |
|---|---|---|---|
| Control → Execution | BullMQ queue | `IExecutionClient` | `EXECUTION_CLIENT` |
| Control → AI | BullMQ queue | `IAiClient` | `AI_CLIENT` |
| Control ↔ Collab | HTTP | `ICollabClient` | `COLLAB_CLIENT` |

Contract clients live in `packages/contracts/`. Each has a stub implementation for independent development:

```bash
# Enable stubs via env vars (cannot be true in production)
USE_EXECUTION_STUB=true
USE_AI_STUB=true
USE_COLLAB_STUB=true
```

**Execution result flow:** Frontend → POST control-plane → queue → executor → result queue → control-plane → GET/SSE to frontend. Results flow through HTTP, NOT WebSocket.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 7, TanStack Router + Query, Zustand, Tailwind CSS v4, shadcn/ui, ky, sonner, react-hook-form + zod, lucide-react |
| **Backend** | NestJS 11, Drizzle ORM, PostgreSQL 17, Passport + JWT, BullMQ, @aws-sdk/client-s3, livekit-server-sdk, nestjs-pino, @nestjs/swagger, @nestjs/throttler, @nestjs/config + Zod |
| **Infra** | Redis 7, SeaweedFS 4.13 (S3-compatible), LiveKit, Docker Compose, Nginx + Caddy, GitHub Actions |
| **Tooling** | Biome 2.x, Vitest 3, unplugin-swc, Husky + lint-staged + commitlint, SonarCloud, OTel → Prometheus + Loki + Tempo + Grafana |

## Code Style — Biome 2.x

Single quotes, always semicolons, trailing commas, 2-space indent, 100-char line width.

```typescript
// Good
const user = await this.usersService.findById(id);
const rooms = items.map((item) => ({
  id: item.id,
  name: item.name,
}));

// Bad — double quotes, missing semicolons, no trailing commas
const user = await this.usersService.findById(id)
const rooms = items.map((item) => ({
  id: item.id,
  name: item.name
}))
```

## Git Conventions

### Commits

Format: `type(scope): description` — scope is REQUIRED, subject 10–100 chars.

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `web`, `control-plane`, `collab-plane`, `execution-plane`, `ai-plane`, `db`, `shared`, `contracts`, `ui`, `infra`, `ci`, `docs`, `deps`

```bash
# Good
feat(web): add room lobby UI with participant list
fix(control-plane): handle JWT refresh token race condition
chore(deps): upgrade Drizzle ORM to 0.45

# Bad — rejected by commitlint
Update code          # no type/scope
fix bugs             # no scope, too vague
fix(api): something  # "api" is not a valid scope
```

### Branches

Format: `type/short-description` — regex: `^(feature|feat|bugfix|fix|hotfix|chore|docs|refactor|test|ci|style|perf)/[a-z0-9][a-z0-9-]*$`

### Rules
- Never push to main or develop directly — always PR
- Commits under 500 changed lines (enforced by pre-commit hook)
- Backend test coverage ≥ 80% (SonarCloud quality gate)
- Every PR should reference an issue with `Closes #N` in the body

## GitHub Projects

Work is tracked on a GitHub Projects board with these fields:

| Field | Options |
|---|---|
| **Status** | Backlog → Ready → In progress → In review → Done |
| **Priority** | P0 (critical), P1 (important), P2 (nice-to-have) |
| **Size** | XS, S, M, L, XL |
| **Area** | infra, control-plane, collab-plane, execution-plane, ai-plane, web |
| **Type** | task, story, bug, spike |

Issues are typed as **story** (user-facing feature from [user stories](docs/user-stories.md)), **task** (technical work item, often a sub-issue of a story), **bug**, or **spike** (time-boxed research).

## Testing

- **Framework:** Vitest everywhere + unplugin-swc for NestJS decorator support
- **Coverage:** ≥ 80% for backend apps (SonarCloud default quality gate)
- **Files:** `*.spec.ts` or `*.test.ts` next to source or in `__tests__/`
- **Naming:** GIVEN-WHEN-THEN convention
- **Principle:** Test behavior, not implementation

```bash
# Run all tests
pnpm test

# Run specific workspace
pnpm --filter @syncode/control-plane test

# Run with coverage
pnpm test:cov
```

## OpenAPI / Swagger

- DTOs in `modules/<name>/dto/<name>.dto.ts` — class + `@ApiProperty` decorators
- Every endpoint: `@ApiResponse` for success + all error codes
- Every POST/PATCH/PUT: `@ApiBody({ type: XxxDto })`
- Every guarded controller: `@ApiBearerAuth()` at class level
- Handler `@Body()` types must match `@ApiBody` DTO types
- Enum fields: import `as const` array from `@syncode/shared` for `@ApiProperty({ enum })`
- Error shape: `{ statusCode, message, timestamp, details? }` (single shape, no separate validation error)
- Only document 503/504 on endpoints where circuit breaker errors actually propagate

## Environment

Copy `.env.example` to `.env` for local dev. Backend apps validate env at startup via Zod schemas in `src/config/env.config.ts`.

Key vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `COLLAB_PLANE_URL`, `E2B_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`

## Boundaries

### Always
- Inject port tokens — never import adapters directly in feature modules
- Use Biome — never ESLint or Prettier
- Use migrations (`pnpm db:generate` + `pnpm db:migrate`) — never `db push` in production
- Use `pnpm add` / `pnpm add -D` to install dependencies — never hand-write versions
- Include `--import tsx` in NestJS dev/start scripts (workspace packages export raw `.ts`)

### Ask First
- Adding new DB table schemas
- Adding new apps or packages (must update `sonar-project.properties` + `.github/workflows/ci.yml`)
- Installing Monaco, tldraw, or livekit-client (room feature not yet built)

### Never
- Commit `.env` files (only `.env.example` is tracked)
- Push to main/develop directly — always PR
- Write commits over 500 changed lines — split them
- Use Next.js — this is a Vite SPA, no SSR
- Add ESLint or Prettier — Biome exclusively
- Use `synchronize: true` or `db push` in production

## Nested Agent Context

| Directory | File | Focus |
|---|---|---|
| `apps/control-plane/` | [`AGENTS.md`](apps/control-plane/AGENTS.md) | NestJS modules, Swagger, error handling, circuit breaker |
| `apps/web/` | [`AGENTS.md`](apps/web/AGENTS.md) | Vite SPA, TanStack Router/Query, Zustand, testing |
| `packages/db/` | [`AGENTS.md`](packages/db/AGENTS.md) | Drizzle ORM, schema, migrations |
