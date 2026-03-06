# 快速上手

> **[English](getting-started.md)**

## 前置条件

开始之前，请先安装以下工具：

| 工具 | 版本要求 | 安装指南 |
|---|---|---|
| **Node.js** | 18 及以上（推荐 22+） | [nodejs.org/en/download](https://nodejs.org/en/download/) |
| **pnpm** | 9 及以上 | [pnpm.io/installation](https://pnpm.io/installation) |
| **Docker Desktop** | 最新版 | [docs.docker.com/get-started/get-docker](https://docs.docker.com/get-started/get-docker/) |

确认安装是否成功：

```bash
node --version    # v18.x.x or higher (v22+ recommended)
pnpm --version    # 9.x.x or higher
docker --version  # any recent version
```

## 相关概念简介

下面是项目中会碰到的一些概念，不用提前学会，知道是什么就行。

**Monorepo** — 把多个应用和共享包放在同一个代码仓库里。我们用 [Turborepo](https://turbo.build/repo/docs) 统一管理构建和任务调度。相比前端、后端各建一个仓库，monorepo 能让所有代码保持同步。

**TypeScript** — 一门编译到 JavaScript 的语言，通过静态类型在编译期而非运行时捕获 bug。如果你用过任何带类型的语言（Java、C++、Go），概念上会很熟悉。可以从 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/basic-types.html) 入手，配合 [TypeScript Playground](https://www.typescriptlang.org/play/) 在线练手。

**NestJS** — 一个结构化的 Node.js 后端框架，用模块、控制器（处理 HTTP 请求）和服务（业务逻辑）来组织代码。参考 [NestJS First Steps](https://docs.nestjs.com/first-steps)。

**React** — 构建用户界面的组件化库。参考 [React Quick Start](https://react.dev/learn)。

**Docker** — 把软件打包成容器，不管什么操作系统都能跑出一样的环境。执行 `pnpm infra:up` 时，Docker 会启动 PostgreSQL 和 Redis 容器。参考 [Docker Get Started](https://docs.docker.com/get-started/)。

**环境变量** — 写在 `.env` 文件里的配置值，比如数据库地址、API 密钥、功能开关这些。应用启动时会读取。

**pnpm** — 一款高性能包管理器，类似 npm 但更适合 monorepo。它通过链接共享依赖来节省磁盘空间。本项目统一用 pnpm，不用 npm 或 yarn。

## 克隆与安装

```bash
git clone https://github.com/JosephJoshua/syncode.git
cd syncode
pnpm install
```

`pnpm install` 会下载 monorepo 中所有应用和包的依赖，首次执行大约需要一两分钟。

## 配置环境变量

复制示例配置文件并根据需要修改：

```bash
cp .env.example .env
```

用编辑器打开 `.env`，按以下说明配置各项：

### 数据库 + Redis（默认值即可）

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/syncode
REDIS_URL=redis://localhost:6379
```

这些配置对应 `pnpm infra:up` 启动的 Docker 容器，本地开发无需修改。

### JWT 密钥（生成随机值）

```env
JWT_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-in-production-min-32-chars
```

本地开发使用默认值即可。如果是共享或部署环境，请生成随机字符串：

```bash
openssl rand -hex 32
```

### 外部服务（本地开发可选）

```env
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=ws://localhost:7880

S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=syncode

E2B_API_KEY=
```

如果本地没有运行 LiveKit、SeaweedFS 或 E2B，可以留空，改用 Stub 模式（见下文）。

### Stub 配置（推荐新手使用）

```env
USE_EXECUTION_STUB=true
USE_AI_STUB=true
USE_COLLAB_STUB=true
```

Stub 用模拟响应代替真实的执行、AI 和协作服务，不用把所有服务都跑起来也能开发前端和 control-plane。等需要对接真实服务了，把对应的标志改成 `false` 就行。

### Plane 地址

```env
COLLAB_PLANE_URL=http://localhost:3001
CONTROL_PLANE_URL=http://localhost:3000
```

### 可观测性（可选）

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
GRAFANA_ADMIN_PASSWORD=changeme
```

只有在启动完整的可观测性组件（`pnpm infra:full`）时才需要配置。

## 启动基础设施

在 Docker 容器中启动 PostgreSQL 和 Redis：

```bash
pnpm infra:up
```

该命令执行 `docker compose -f docker-compose.yml up -d`，`-d` 表示容器在后台运行。

确认容器是否正常运行：

```bash
docker ps
```

应该能看到 `postgres` 和 `redis` 两个容器。

## 执行数据库迁移

创建数据库表：

```bash
pnpm db:migrate
```

该命令会应用 `packages/db/` 中所有待执行的 [Drizzle ORM](https://orm.drizzle.team/) 迁移。

## 启动开发服务器

```bash
pnpm dev
```

Turborepo 会同时启动所有应用：

| 应用 | 地址 | 说明 |
|---|---|---|
| `web` | [localhost:5173](http://localhost:5173) | React 前端 |
| `control-plane` | [localhost:3000/api](http://localhost:3000/api) | REST API（Swagger 文档在 `/api`） |
| `collab-plane` | localhost:3001 | WebSocket 服务器（无浏览器界面） |
| `execution-plane` | — | 队列消费者（无 HTTP 服务器） |
| `ai-plane` | — | 队列消费者（无 HTTP 服务器） |

## 验证是否正常运行

1. 打开 [localhost:5173](http://localhost:5173)，应该能看到 SynCode Web 应用
2. 打开 [localhost:3000/api](http://localhost:3000/api)，应该能看到 Swagger API 文档

如果页面无法加载，请参考下方的故障排查。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 以开发模式启动所有应用（支持热更新） |
| `pnpm build` | 构建所有应用和包 |
| `pnpm typecheck` | 对所有工作空间执行 TypeScript 类型检查 |
| `pnpm test` | 运行全部测试 |
| `pnpm test:cov` | 运行测试并生成覆盖率报告 |
| `pnpm lint:fix` | 自动修复代码检查和格式问题（Biome） |
| `pnpm format` | 自动修复格式问题（Biome） |
| `pnpm check` | 仅检查代码规范和格式，不做修改 |
| `pnpm db:generate` | 根据 schema 变更生成 Drizzle 迁移文件 |
| `pnpm db:migrate` | 执行待处理的数据库迁移 |
| `pnpm db:studio` | 打开 Drizzle Studio（可视化数据库浏览器） |
| `pnpm infra:up` | 启动 PostgreSQL + Redis（最小基础设施） |
| `pnpm infra:down` | 停止所有 Docker 容器 |
| `pnpm infra:full` | 启动全部基础设施，包括可观测性组件 |
| `pnpm infra:logs` | 查看所有 Docker 容器日志 |

## 使用 Stub 模式

在 `.env` 中设置 `USE_EXECUTION_STUB=true`、`USE_AI_STUB=true` 或 `USE_COLLAB_STUB=true` 后，control-plane 会使用模拟客户端而非连接真实服务：

- **Execution stub**：短暂延迟后返回模拟的代码执行结果
- **AI stub**：短暂延迟后返回占位的 AI 反馈
- **Collab stub**：模拟协作平面的响应，无需运行真实的 WebSocket 服务器

适用场景：
- 你在做前端开发，只需要 API 返回数据
- 你在开发 control-plane，不想启动所有服务
- 你刚开始上手项目，希望用最简单的配置先跑起来

需要切换到真实服务时，将对应的 stub 标志设为 `false`，并确保相应服务已启动。

## 故障排查

### 端口被占用

```
Error: listen EADDRINUSE: address already in use :::3000
```

其他进程正在使用该端口。找到并终止对应进程：

```bash
lsof -i :3000    # Find the process
kill <PID>        # Kill it
```

也可以在 `.env` 文件中更改端口。

### tsx 导入错误

```
TypeError: Unknown file extension ".ts"
```

后端应用依赖 `tsx` 加载器。确认 Node.js 版本是 18 及以上（推荐 22+）。开发脚本里已经带了 `--import tsx`，出现这个错误一般是因为你直接跑了应用，没走 `pnpm dev`。

### 数据库连接被拒绝

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Docker 未运行或容器未启动：

```bash
docker ps                    # Check if containers are running
pnpm infra:up                # Start them if not
```

### 缺少环境变量

```
ZodError: [
  { path: ["JWT_SECRET"], message: "Required" }
]
```

应用启动时会用 Zod schema 校验所有环境变量。报错信息会明确告诉你缺了哪个，对照 `.env.example` 检查你的 `.env` 文件就行。

### pnpm install 失败

确认 pnpm 版本为 9 及以上：

```bash
pnpm --version
```

如果版本过旧，可以通过以下方式升级：

```bash
corepack enable
corepack prepare pnpm@9 --activate
```
