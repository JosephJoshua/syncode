/**
 * Server-only stub implementations for independent development.
 *
 * These use `node:crypto` and must NOT be re-exported from the main barrel
 * (`index.ts`) — doing so would break browser builds (Vite/Rollup).
 *
 * Import from `@syncode/contracts/stubs` in NestJS apps only.
 */
export { StubAiClient } from './ai/stub';
export { StubCollabClient } from './collab/stub';
export { StubExecutionClient } from './execution/stub';
