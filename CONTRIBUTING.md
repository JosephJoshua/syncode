# Contributing to SynCode

> **[中文版](CONTRIBUTING.zh.md)**

## Development Setup

See [docs/getting-started.md](docs/getting-started.md) for a complete setup walkthrough — prerequisites, environment variables, and running the dev servers.

## Branch Naming

Format: `type/short-description`

Must match: `^(feature|feat|bugfix|fix|hotfix|chore|docs|refactor|test|ci|style|perf)/[a-z0-9][a-z0-9-]*$`

```bash
# Good
feature/user-login
fix/jwt-refresh-race
chore/update-dependencies
docs/add-architecture-guide

# Bad — rejected by pre-push hook
testbranch          # no type prefix
fixBug              # camelCase
my feature          # spaces
```

## Commit Messages

Format: `type(scope): description`

Enforced by [commitlint](https://commitlint.js.org/) via a commit-msg hook.

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `web`, `control-plane`, `collab-plane`, `execution-plane`, `ai-plane`, `db`, `shared`, `contracts`, `ui`, `infra`, `ci`, `docs`, `deps`

**Rules:**
- Scope is **required**
- Subject: 10–100 characters
- Body: optional, no line length limit

```bash
# Good
feat(web): add room lobby UI with participant list
fix(control-plane): handle JWT refresh token race condition
chore(deps): upgrade Drizzle ORM to 0.38
test(shared): add unit tests for permission utilities
refactor(contracts): extract route type helpers

# Bad — rejected by commitlint
Update code                   # no type or scope
fix bugs                      # no scope, too vague
wip                           # too short, no type/scope
feat: add login               # missing scope
feat(api): add login          # invalid scope (use "control-plane")
```

## Pull Request Workflow

1. Create a branch from `develop` following the naming convention above
2. Make your changes in small, focused commits (under 500 changed lines each)
3. Push your branch and open a PR targeting `develop`
4. Ensure CI passes (lint, typecheck, tests)
5. Request review from Joseph

**Rules:**
- Never push directly to `main` or `develop` — branch protection rejects it
- All changes go through PRs to `develop`
- `main` receives merges from `develop` only

## Code Style

We use **[Biome 2.x](https://biomejs.dev/)** for both linting and formatting. No ESLint. No Prettier.

```bash
pnpm check           # Check lint + format (no changes)
pnpm lint:fix        # Auto-fix lint + format issues
pnpm format          # Auto-fix formatting
```

Style rules (configured in `biome.json`):
- Single quotes
- Semicolons
- Trailing commas
- 100-character line width
- 2-space indentation

Your editor should pick up `biome.json` automatically. Install the [Biome extension](https://biomejs.dev/guides/editors/first-party-plugins/) for VS Code or your IDE.

## Testing

Run tests before every PR:

```bash
pnpm test            # Run all tests across all workspaces
pnpm test:cov        # Run with coverage reports
```

**Coverage requirement:** All backend code must maintain ≥ 80% statement coverage, enforced by SonarCloud's default quality gate. Frontend (`apps/web`) coverage is excluded from SonarCloud.

We use [Vitest](https://vitest.dev/) for all testing. See [docs/testing.md](docs/testing.md) for our testing philosophy, best practices, and a step-by-step guide to writing tests in this codebase.

## Commit Size Limit

A pre-commit hook rejects commits over **500 changed lines**. This keeps PRs reviewable and encourages incremental development. If your change is larger, split it into multiple commits.
