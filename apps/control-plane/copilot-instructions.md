# Control Plane

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
| `RoomsService.createRoom` | Yes (`Promise.allSettled`) | No |
| `RoomsService.destroyRoom` | Yes (`Promise.allSettled`) | No |
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
- Coverage target: ≥ 80% statements

## NestJS Quirks

- **`--import tsx` required** — workspace packages export raw `.ts` source; dev script uses `NODE_OPTIONS='--import tsx' nest start --watch`
- **`verbatimModuleSyntax: false`** — required because `emitDecoratorMetadata` generates value refs from type imports
- **`moduleResolution: "Bundler"`** — required to resolve workspace `exports` maps
- **`DB_CLIENT` token** — defined locally in `modules/db/db.module.ts`, NOT in shared packages
- **`@Global()` re-exports** — imported modules must be explicitly re-exported for consumers
