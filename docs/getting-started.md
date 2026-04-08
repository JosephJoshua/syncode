# Getting Started

> **[中文版](getting-started.zh.md)**

## Prerequisites

Install these before anything else:

| Tool | Version | Install Guide |
|---|---|---|
| **Node.js** | 20 or later (22+ recommended) | [nodejs.org/en/download](https://nodejs.org/en/download/) |
| **pnpm** | 9 or later | [pnpm.io/installation](https://pnpm.io/installation) |
| **Docker Desktop** | Latest | [docs.docker.com/get-started/get-docker](https://docs.docker.com/get-started/get-docker/) |

Verify your setup:

```bash
node --version    # v20.x.x or higher (v22+ recommended)
pnpm --version    # 9.x.x or higher
docker --version  # any recent version
```

## Concepts You'll Encounter

Don't worry if these are new — you don't need to master them before starting. Brief explanations so you recognize them:

**Monorepo** — One repository containing multiple apps and shared packages. We use [Turborepo](https://turbo.build/repo/docs) to manage builds and tasks across them. The alternative would be separate git repos for frontend, backend, etc. — a monorepo keeps everything in sync.

**TypeScript** — A language that compiles to JavaScript, adding static types to catch bugs at compile time instead of runtime. If you've used any typed language (Java, C++, Go), the concepts will feel familiar. Start with the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/basic-types.html) and the [TypeScript Playground](https://www.typescriptlang.org/play/) for experimenting.

**NestJS** — A structured framework for building Node.js backends. It organizes code into modules, controllers (handle HTTP requests), and services (business logic). See [NestJS First Steps](https://docs.nestjs.com/first-steps).

**React** — A library for building user interfaces with reusable components. See the [React Quick Start](https://react.dev/learn).

**Docker** — Packages software into containers so everyone runs the same environment regardless of OS. When you run `pnpm infra:up`, Docker starts PostgreSQL and Redis in containers. See [Docker Get Started](https://docs.docker.com/get-started/).

**Environment Variables** — Configuration values stored outside your code in `.env` files. Things like database URLs, API keys, and feature flags. Your app reads them at startup.

**pnpm** — A fast package manager, similar to npm but better for monorepos. It saves disk space by linking shared dependencies. We use it instead of npm or yarn.

## Clone and Install

```bash
git clone https://github.com/JosephJoshua/syncode.git
cd syncode
pnpm install
```

`pnpm install` downloads all dependencies for every app and package in the monorepo. This takes a minute or two the first time.

## Environment Setup

Copy the example env file and customize it:

```bash
cp .env.example .env
```

Open `.env` in your editor. Here's what to set:

### Database + Redis (defaults work)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/syncode
REDIS_URL=redis://localhost:6379
```

These connect to the Docker containers started by `pnpm infra:up`. No changes needed for local development.

### JWT Secrets (generate random values)

```env
AUTH_JWT_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-in-production-min-32-chars
COLLAB_JWT_SECRET=change-me-in-production-min-32-chars
```

For local development, the defaults work fine. For anything shared or deployed, generate random strings:

```bash
openssl rand -hex 32
```

### S3 Storage (defaults work)

```env
S3_ENDPOINT=http://localhost:8333
S3_ACCESS_KEY=syncode
S3_SECRET_KEY=syncode-secret
S3_BUCKET=syncode
```

SeaweedFS runs as part of `pnpm infra:up` with hardcoded dev credentials. No changes needed.

### External Services (optional for local dev)

```env
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=ws://localhost:7880

E2B_API_KEY=
```

Leave these blank if you're not running LiveKit or E2B locally. Use stubs instead (see below).

### Stub Configuration (recommended for getting started)

```env
USE_EXECUTION_STUB=true
USE_AI_STUB=true
USE_COLLAB_STUB=true
```

Stubs simulate the execution, AI, and collab planes with fake responses. This lets you develop the frontend and control-plane without running every service. Set any of these to `false` when you want to work with the real service.

### Plane URLs

```env
COLLAB_PLANE_URL=http://localhost:3001
CONTROL_PLANE_URL=http://localhost:3000
```

### Observability (optional)

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
GRAFANA_ADMIN_PASSWORD=changeme
```

Only needed if you're running the full observability stack (`pnpm infra:full`).

## Start Infrastructure

Start PostgreSQL and Redis in Docker containers:

```bash
pnpm infra:up
```

This runs `docker compose -f docker-compose.yml up -d`. The `-d` flag means containers run in the background.

To verify they're running:

```bash
docker ps
```

You should see containers for `postgres` and `redis`.

## Run Database Migrations

Create the database tables:

```bash
pnpm db:migrate
```

This applies all pending [Drizzle ORM](https://orm.drizzle.team/) migrations from `packages/db/`.

## Start Development Servers

```bash
pnpm dev
```

This starts all apps simultaneously via Turborepo:

| App | URL | Description |
|---|---|---|
| `web` | [localhost:5173](http://localhost:5173) | React frontend |
| `control-plane` | [localhost:3000/api](http://localhost:3000/api) | REST API (Swagger docs at `/api`) |
| `collab-plane` | localhost:3001 | WebSocket server (no browser UI) |
| `execution-plane` | — | Queue worker (no HTTP server) |
| `ai-plane` | — | Queue worker (no HTTP server) |

## Verify It Works

1. Open [localhost:5173](http://localhost:5173) — you should see the SynCode web app
2. Open [localhost:3000/api](http://localhost:3000/api) — you should see the Swagger API documentation

If either doesn't load, check the troubleshooting section below.

## Common Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start all apps in development mode (hot reload) |
| `pnpm build` | Build all apps and packages |
| `pnpm typecheck` | Run TypeScript type checking across all workspaces |
| `pnpm test` | Run all tests |
| `pnpm test:cov` | Run all tests with coverage reports |
| `pnpm lint:fix` | Auto-fix lint and format issues (Biome) |
| `pnpm format` | Auto-fix formatting (Biome) |
| `pnpm check` | Check lint + format without making changes |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending database migrations |
| `pnpm db:studio` | Open Drizzle Studio (visual database browser) |
| `pnpm infra:up` | Start PostgreSQL + Redis (minimal infrastructure) |
| `pnpm infra:down` | Stop all Docker containers |
| `pnpm infra:full` | Start all infrastructure including observability stack |
| `pnpm infra:logs` | Tail logs from all Docker containers |

## Running with Stubs

When `USE_EXECUTION_STUB=true`, `USE_AI_STUB=true`, or `USE_COLLAB_STUB=true` is set in `.env`, the control-plane uses simulated clients instead of connecting to real services:

- **Execution stub**: Returns fake code execution results after a short delay
- **AI stub**: Returns placeholder AI feedback after a short delay
- **Collab stub**: Simulates collab plane responses without a real WebSocket server

This is useful when:
- You're working on the frontend and just need API responses
- You're working on the control-plane and don't want to run every service
- You're getting started and want the simplest possible setup

To switch to real services later, set the stub flags to `false` and make sure the corresponding services are running.

## Troubleshooting

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another process is using that port. Find and kill it:

```bash
lsof -i :3000    # Find the process
kill <PID>        # Kill it
```

Or change the port in your `.env` file.

### tsx import errors

```
TypeError: Unknown file extension ".ts"
```

The backend apps require the `tsx` loader. Make sure you're using Node.js 20 or later (22+ recommended). The dev scripts already include `--import tsx` — if you see this error, you may be running the app directly instead of through `pnpm dev`.

### Database connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Docker isn't running or the containers aren't up:

```bash
docker ps                    # Check if containers are running
pnpm infra:up                # Start them if not
```

### Missing environment variables

```
ZodError: [
  { path: ["AUTH_JWT_SECRET"], message: "Required" }
]
```

The app validates all environment variables at startup using Zod schemas. The error message tells you exactly which variable is missing. Check your `.env` file against `.env.example`.

### pnpm install fails

Make sure you're using pnpm 9+:

```bash
pnpm --version
```

If you have an older version:

```bash
corepack enable
corepack prepare pnpm@9 --activate
```
