# Database Package

> Database-specific conventions for `packages/db/`. See root [AGENTS.md](../../AGENTS.md) for project-wide context.

## Overview

Drizzle ORM with `postgres` driver (not `pg`/`node-postgres`). PostgreSQL 17.

## Commands

```bash
pnpm db:generate    # Generate migration from schema changes (root shortcut)
pnpm db:migrate     # Run pending migrations (root shortcut)
pnpm db:studio      # Open Drizzle Studio — visual DB browser (root shortcut)

# From within packages/db/:
pnpm generate       # drizzle-kit generate
pnpm migrate        # tsx src/migrate.ts
pnpm push           # drizzle-kit push (DEV ONLY — never production)
pnpm seed           # tsx src/seed.ts
pnpm studio         # drizzle-kit studio
```

## Schema

Schema files live in `src/schema/`. Each table is its own file.

When modifying schemas:
1. Edit the schema file in `src/schema/`
2. Run `pnpm db:generate` to create a migration
3. Run `pnpm db:migrate` to apply it
4. Never use `db push` in production — always use migrations

## Zod Integration

`drizzle-zod` generates Zod schemas from Drizzle table definitions. Use these for request validation in the control-plane.

## Rules

- **Never** use `synchronize: true` or `drizzle-kit push` in production
- **Always** generate a migration file for schema changes
- **Ask first** before adding new table schemas — requires team agreement
- `DB_CLIENT` token is defined locally in each app's `db.module.ts`, not here
