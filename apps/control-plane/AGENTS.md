# AGENTS.md — Control Plane

> Backend-specific conventions for `apps/control-plane/`. See root [AGENTS.md](../../AGENTS.md) for project-wide context.

## Module Structure

```
src/
  common/
    decorators/     @CurrentUser, @RequireGlobalPermission, @RequireRoomPermission
    dto/            Shared DTOs (ErrorResponseDto, HealthResponseDto)
    filters/        GlobalExceptionFilter
    guards/         JwtAuthGuard, GlobalPermissionGuard, RoomPermissionGuard
  config/
    env.config.ts   Zod-validated environment variables
  infrastructure/
    infrastructure.module.ts   THE adapter ↔ token binding file
  modules/
    auth/           Authentication (register, login, refresh)
    db/             Database module (DB_CLIENT token)
    execution/      Code execution orchestration
    internal/       Internal endpoints (collab-plane → control-plane)
    problems/       Problem CRUD
    rooms/          Room lifecycle, code running, submission
    users/          User profile CRUD
```

Typical module: `<name>.controller.ts`, `<name>.service.ts`, `<name>.module.ts`, `dto/<name>.dto.ts` (some modules omit the service if logic is minimal)

## Infrastructure Module

`src/infrastructure/infrastructure.module.ts` is the ONLY place adapter bindings live. It's `@Global()`.

| Token | Real Adapter | Stub (when enabled) |
|---|---|---|
| `QUEUE_SERVICE` | `BullMqAdapter` + circuit breaker | — |
| `CACHE_SERVICE` | `RedisCacheAdapter` + circuit breaker | — |
| `STORAGE_SERVICE` | `S3StorageAdapter` + circuit breaker | — |
| `MEDIA_SERVICE` | `LiveKitAdapter` + circuit breaker | — |
| `EXECUTION_CLIENT` | `QueueExecutionClient` | `StubExecutionClient` |
| `AI_CLIENT` | `QueueAiClient` | `StubAiClient` |
| `COLLAB_CLIENT` | `HttpCollabClient` + circuit breaker | `StubCollabClient` |

All real adapters from `@syncode/infrastructure`. Stubs from `@syncode/contracts`.

## Error Handling

`GlobalExceptionFilter` produces a single error shape for ALL errors:

```json
{ "statusCode": 500, "message": "...", "timestamp": "...", "details": {} }
```

No separate validation error shape — `details` carries extra info when present.

### Circuit Breaker Error Propagation

Not all services propagate 503/504. Only document these on endpoints where they actually reach the client:

| Service Method | Catches CB Errors? | Can Return 503/504? |
|---|---|---|
| `RoomsService.createRoom` | Yes (try/catch in helpers) | No |
| `RoomsService.destroyRoom` | Yes (try/catch in helpers) | No |
| `RoomsService.submitProblem` | Yes (per-test-case try/catch) | No |
| `RoomsService.runCode` | No | Yes — 503/504 can propagate |
| Health check | Yes (all wrapped in try/catch) | No — reports as `"degraded"` |

## Swagger / OpenAPI

- DTOs: `modules/<name>/dto/<name>.dto.ts` — class + `@ApiProperty` decorators
- Every endpoint: `@ApiResponse` for success + all possible error codes
- Every POST/PATCH/PUT: `@ApiBody({ type: XxxDto })`
- Every guarded controller: `@ApiBearerAuth()` at class level
- Handler `@Body()` types MUST match `@ApiBody` DTO types
- Enum fields: import the `as const` array from `@syncode/shared`, use derived type for field
- Polymorphic responses: `@ApiExtraModels()` + `oneOf`/`getSchemaPath()` from `@nestjs/swagger`

## Route Definitions

Controllers use `@Controller()` (no prefix) + route paths from `@syncode/contracts`:

```typescript
import { CONTROL_API } from '@syncode/contracts/control';

@Controller()
export class RoomsController {
  @Post(CONTROL_API.ROOMS.CREATE.route)
  // ...
}
```

All REST routes defined in `packages/contracts/src/control/routes.ts`.

## Environment Validation

`src/config/env.config.ts` validates ALL env vars at startup with Zod. Stubs cannot be enabled in production (`.refine()` check).

Key vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `S3_*`, `LIVEKIT_*`, `COLLAB_PLANE_URL`, `USE_*_STUB`, `CORS_ORIGINS`, `THROTTLE_TTL_SECS`, `THROTTLE_LIMIT`

## Testing

```bash
pnpm --filter @syncode/control-plane test          # Run all tests
pnpm --filter @syncode/control-plane test:cov      # With coverage
vitest run src/modules/auth                         # Specific module (from app dir)
```

- Uses `unplugin-swc` in `vitest.config.ts` for NestJS decorator support
- Integration tests: `supertest` for HTTP endpoints
- Coverage target: ≥ 80% statements (SonarCloud quality gate)

### Testing principles

- **Test behavior, not implementation.** Assert on return values, thrown errors, and observable side effects — not on which mocks were called or how many times.
- **Each test must add unique value.** If two tests exercise the same code path with trivially different inputs, merge them or drop one.
- **Don't mock Drizzle query chains for complex joins.** Methods with multi-table joins, correlated subqueries, or cursor pagination are better tested with integration tests against a real DB. Unit tests for these devolve into implementation-coupled mock wiring.
- **Do unit-test business logic.** Error handling (graceful degradation, retry, propagation), access control (403/404), response shaping, and pure functions are good unit test targets.
- **Subsystem failure tests can be merged.** "collab down" and "media down" test the same pattern (graceful degradation). One test covering both-down is sufficient unless they have different error-handling code paths.

## Idempotency

Reusable `@Idempotent()` decorator + `IdempotencyInterceptor` in `src/common/interceptors/`. Uses DB-backed `idempotency_keys` table (not Redis). Keys are scoped by `{userId}:{method}:{route}:{uuid}` to prevent cross-user and cross-endpoint replays. `mergeMap` (not `tap`) ensures DB writes complete before response is returned.

## Domain Types vs API Types

Services return domain types (e.g., `CreateRoomResult` with `Date` fields) defined in `rooms.types.ts`. Controllers map domain types to API response DTOs (e.g., `createdAt.toISOString()`). Services must NOT return contract/DTO types directly — that's a layering violation.

## Auth

`AuthUser` type in `src/modules/auth/auth.types.ts` — `{ id: string; email: string }`. Used with `@CurrentUser()` decorator. `JwtStrategy.validate()` returns `AuthUser`.

## NestJS Quirks

- **`--import tsx` required** — workspace packages export raw `.ts` source; dev script uses `NODE_OPTIONS='--import tsx' nest start --watch`
- **`verbatimModuleSyntax: false`** — required because `emitDecoratorMetadata` generates value refs from type imports
- **`moduleResolution: "Bundler"`** — required to resolve workspace `exports` maps
- **`DB_CLIENT` token** — defined locally in `modules/db/db.module.ts`, NOT in shared packages
- **`@Global()` re-exports** — imported modules must be explicitly re-exported for consumers
