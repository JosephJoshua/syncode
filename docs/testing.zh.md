# 测试

> **[English](testing.md)**

## 为什么要写测试

测试不是走形式，它有三个实际作用：

1. **重构时的安全网** — 修改内部实现后，测试能告诉你行为是否依然正确。没有测试，谁都不敢重构，因为无法确认是否引入了 bug。
2. **防止回归** — 修复过的 bug 不会悄悄复现。复现 bug 的测试会永远守着那个入口。
3. **活文档** — 测试名就是行为规格说明。看到 `test('returns 401 when token is expired')` 就能理解预期行为，不用去读实现代码。

SynCode 要求所有后端代码的**语句覆盖率不低于 80%**，由 SonarCloud 在 CI 中通过默认质量门禁强制执行。前端（`apps/web`）的覆盖率不在 SonarCloud 检查范围内。但覆盖率高不代表测试质量好，请阅读[最佳实践](#测试最佳实践)章节了解什么样的测试才真正有价值。

## 测试金字塔

<p align="center">
  <img src="assets/testing-pyramid.svg" alt="Testing Pyramid" width="520" />
</p>

**为什么是金字塔形？** 底层反馈快、成本低，顶层覆盖面广、信心高。单元测试能以极低的代价快速捕获大部分 bug；集成测试验证组件之间的协作是否正常；E2E 测试确认整个系统能跑通，但速度慢、容易出错，所以只保留必要的数量。

比例很关键：如果大部分测试都是 E2E，测试套件会跑得很慢，还经常失败。如果只有单元测试，组件之间的连接问题可能漏掉。

## 行为测试 — 测"做了什么"而非"怎么做的"

这是最核心的测试原则。把握好了，测试就是长期资产；把握不好，测试就变成负担。

### 核心思路

测试应该描述**行为**（从外部看代码做了什么），而非**实现**（代码内部是怎么做的）。

- **行为：** "用户使用正确的凭据登录后，获得 JWT token"
- **实现：** "service 调用了 `findByEmail`，然后调用 `bcrypt.compare`，再调用 `jwt.sign`"

### 为什么这很重要

如果测试绑定了实现细节，每次重构都会导致测试失败，哪怕实际功能并没有坏。改个内部方法名？测试挂了。加一层缓存？测试挂了。调换两个无关操作的顺序？测试还是挂了。最后测试不再是安全网，而是每次改动都要额外付出的成本。

行为测试能在重构中存活，因为它只关注**输入和输出**，不关心中间过程。

### GIVEN-WHEN-THEN 模式

把测试写成规格说明：

- **GIVEN** — 初始状态（前置条件）
- **WHEN** — 被测试的操作
- **THEN** — 预期结果

我们的 circuit breaker 测试已经在用这种约定：

```typescript
// packages/infrastructure/src/circuit-breaker/__tests__/circuit-breaker.spec.ts

test('GIVEN circuit is CLOSED WHEN failures reach threshold THEN transitions to OPEN', async () => {
  // GIVEN — circuit starts in CLOSED state (default)
  const failingFn = async () => { throw new Error('Service down'); };
  const config = { name: 'test-circuit', failureThreshold: 3, resetTimeoutMs: 10000 };

  // WHEN — we cause 3 failures (the threshold)
  for (let i = 0; i < 3; i++) {
    await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow('Service down');
  }

  // THEN — circuit transitions to OPEN
  const stats = circuitBreaker.getStats('test-circuit');
  expect(stats?.state).toBe(CircuitState.OPEN);
  expect(stats?.failureCount).toBe(3);
});
```

注意：这个测试不关心 circuit breaker 内部如何追踪失败次数。它只检查可观测的结果，即状态是否改变、计数是否正确。

### 好测试与坏测试的对比

假设要测试 `AuthService.login()`：

**反面示例 — 测试实现细节：**

```typescript
test('login calls the right methods', async () => {
  await authService.login({ email: 'test@example.com', password: 'secret123' });

  // These assertions couple the test to internal method names and call order
  expect(userRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
  expect(bcrypt.compare).toHaveBeenCalledWith('secret123', user.passwordHash);
  expect(jwtService.sign).toHaveBeenCalledWith({ sub: user.id });
});
```

以下改动都会导致这个测试失败：
- 把 `findByEmail` 改名为 `findByCredential`
- 在数据库查询前加一层缓存
- 从 bcrypt 切换到 argon2
- 修改 JWT payload 的结构

这些改动都没有破坏行为（正确登录依然能拿到 token），但测试全部会挂。

**正面示例 — 测试行为：**

```typescript
test('GIVEN a registered user WHEN logging in with correct password THEN returns valid tokens', async () => {
  // GIVEN
  const user = await createTestUser({ email: 'test@example.com', password: 'secret123' });

  // WHEN
  const result = await authService.login({ email: 'test@example.com', password: 'secret123' });

  // THEN
  expect(result.accessToken).toBeDefined();
  expect(result.refreshToken).toBeDefined();
});

test('GIVEN a registered user WHEN logging in with wrong password THEN throws UnauthorizedException', async () => {
  // GIVEN
  await createTestUser({ email: 'test@example.com', password: 'secret123' });

  // WHEN / THEN
  await expect(
    authService.login({ email: 'test@example.com', password: 'wrong' })
  ).rejects.toThrow(UnauthorizedException);
});
```

这些测试能在任何内部重构中存活下来。只有实际行为发生变化时它们才会失败，而那正是你需要被提醒的时候。

### 该断言什么

- **输出和返回值** — 函数调用的直接结果
- **调用方可见的副作用** — 数据库中新增了一条记录、队列中多了一个任务、触发了一个事件
- **错误条件** — 抛出了正确的异常，带有正确的状态码

**不应该断言的内容：**
- 内部方法的调用（谨慎使用 `toHaveBeenCalledWith`，只在副作用本身就是行为时使用，比如验证是否发送了邮件）
- 操作的执行顺序（除非顺序本身就是需求）
- 私有状态或内部数据结构

## 六边形架构如何让测试变得简单

这就是架构设计带来的实际好处。如果你看过[架构文档](architecture.zh.md#六边形架构端口与适配器)，就知道 SynCode 采用了 Port/Adapter 模式。下面说说这个模式是怎么让测试变得又快又稳的。

### 没有 Port 接口时的问题

如果 service 直接导入具体实现：

```typescript
import { BullMqAdapter } from '@syncode/infrastructure';
import { RedisCacheAdapter } from '@syncode/infrastructure';

class ExecutionService {
  constructor(
    private queue = new BullMqAdapter({ url: 'redis://localhost:6379' }),
    private cache = new RedisCacheAdapter({ url: 'redis://localhost:6379' }),
  ) {}
}
```

要测这个 service，就得跑一个真实的 Redis。测试会变慢（有网络调用）、不稳定（Redis 挂了怎么办？）、配置也麻烦（CI 里还得跑 Docker）。

### 使用 Port 接口后的方案

service 依赖接口而不是具体实现：

```typescript
class ExecutionService {
  constructor(
    @Inject(QUEUE_SERVICE) private queue: IQueueService,
    @Inject(CACHE_SERVICE) private cache: ICacheService,
  ) {}
}
```

测试时注入轻量级的 fake 对象即可：

```typescript
const module = await Test.createTestingModule({
  providers: [
    ExecutionService,
    {
      provide: QUEUE_SERVICE,
      useValue: {
        enqueue: vi.fn().mockResolvedValue({ id: 'job-123' }),
        // ... only mock what this test needs
      },
    },
    {
      provide: CACHE_SERVICE,
      useValue: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  ],
}).compile();
```

不需要 Redis，不需要 Docker，不需要网络调用。测试在毫秒级就能跑完。

```
Production:  ExecutionService → @Inject(QUEUE_SERVICE) → BullMqAdapter → Redis
Unit test:   ExecutionService → @Inject(QUEUE_SERVICE) → { enqueue: vi.fn() }
```

### 这就是我们采用这种架构的原因

六边形架构不是为了好看。它实打实地带来了：

- **快速的单元测试** — 不依赖基础设施
- **稳定的测试** — 没有不稳定的网络调用
- **精准的测试** — 只 mock 需要的部分，只测真正重要的逻辑

Stub 实现（`StubExecutionClient`、`StubAiClient`、`StubCollabClient`）是同一思路在 Plane 层面的应用，它们既是测试替身，也可以在运行时使用。

## SynCode 中的单元测试

### 工具

| 工具 | 用途 |
|---|---|
| [Vitest](https://vitest.dev/) | 测试运行器和断言库（`describe`、`test`、`expect`） |
| [unplugin-swc](https://github.com/nicepkg/unplugin-swc) | 在 Vitest 中支持 NestJS 装饰器（替代 TypeScript 的 `emitDecoratorMetadata`） |
| [@nestjs/testing](https://docs.nestjs.com/fundamentals/testing) | 创建带有 mock provider 的测试模块 |

### 测试文件的位置

两种约定，同一个模块内保持统一即可：

```
modules/auth/
  auth.service.ts
  auth.service.spec.ts       ← 方式 A：与源文件放在一起
  __tests__/
    auth.service.spec.ts     ← 方式 B：放在 __tests__ 子目录中
```

circuit breaker 包采用的是方式 B，两种都可以。

### 测试 NestJS Service 的基本步骤

以下是测试一个依赖注入 Port 接口的 service 的模板：

```typescript
import { Test } from '@nestjs/testing';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let service: RoomsService;
  let mockCache: ICacheService;

  beforeEach(async () => {
    // Create mock implementations
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      shutdown: vi.fn(),
    };

    // Build a test module with mock providers
    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: CACHE_SERVICE, useValue: mockCache },
        // ... other dependencies
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  test('GIVEN a valid room config WHEN creating a room THEN returns the room ID', async () => {
    // GIVEN
    const config = { name: 'Interview Room', language: 'python' };

    // WHEN
    const result = await service.createRoom(config);

    // THEN
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Interview Room');
  });
});
```

### Vitest 的 mock 用法

| 函数 | 使用场景 |
|---|---|
| `vi.fn()` | 从零创建一个 mock 函数 |
| `vi.fn().mockResolvedValue(x)` | mock 一个异步函数，使其 resolve 为 `x` |
| `vi.fn().mockRejectedValue(err)` | mock 一个异步函数，使其 reject 为 `err` |
| `vi.spyOn(obj, 'method')` | 对已有方法进行 spy（默认保留原始实现） |

```typescript
// Mock that returns different values on successive calls
const mockGet = vi.fn()
  .mockResolvedValueOnce(null)        // first call: cache miss
  .mockResolvedValueOnce({ id: 1 });  // second call: cache hit

// Verify a mock was called (only when the call IS the behavior)
expect(mockCache.set).toHaveBeenCalledWith('room:123', expect.any(Object));
```

### 哪些内容需要单元测试

| 内容 | 是否需要测试 | 原因 |
|---|---|---|
| Service 方法 | **需要** | 这是你的业务逻辑，也是应用的核心 |
| Guard、Interceptor、Pipe | **复杂的需要** | 只在包含非平凡逻辑时才测试 |
| 工具函数（`packages/shared/`） | **需要** | 被广泛使用的共享代码必须可靠 |
| DTO | **不需要** | 只是数据结构的定义，Zod 会在运行时做校验 |
| Controller | **通常不需要** | Controller 只是薄封装层，用集成测试覆盖更合适 |
| Module 文件 | **不需要** | 只是模块装配，NestJS 会处理 |

### 运行测试

```bash
pnpm test                                          # All workspaces
cd apps/control-plane && pnpm test                 # Single app
cd apps/control-plane && vitest run src/modules/auth  # Single module
cd apps/control-plane && vitest watch              # Watch mode (re-runs on save)
```

## 集成测试

集成测试验证多个组件配合真实基础设施一起工作的情况。它能发现单元测试遗漏的问题：SQL 查询运行不了、序列化有 bug、中间件顺序不对、Guard 行为异常等。

### 工具

| 工具 | 用途 |
|---|---|
| Vitest | 测试运行器（与单元测试相同） |
| [supertest](https://github.com/ladjs/supertest) | 在测试中向 NestJS 应用发送真实 HTTP 请求 |
| [Testcontainers](https://testcontainers.com/) | 启动一次性 Docker 容器（PostgreSQL、Redis）用于测试 |

### Testcontainers 的工作原理

测试套件启动前，Testcontainers 会启动一个使用随机端口的真实 PostgreSQL 容器。测试获得一个指向真实、隔离数据库的连接字符串。测试结束后容器被销毁，每次运行都从干净的状态开始。

这消除了因本地数据不同导致的"在我机器上是好的"问题，并且能确认你的 SQL 查询和数据库迁移确实能正常运行。

```
生命周期：
  globalSetup  →  启动 PG 容器，创建带有迁移的模板数据库
  beforeEach   →  CREATE DATABASE test_<id> TEMPLATE syncode_template（约 10ms）
  test         →  在隔离数据库中运行
  afterEach    →  DROP DATABASE test_<id>
  globalTeardown → 停止容器
```

每个测试用例都拥有一个完全独立、已迁移的数据库，零共享状态。在 `apps/control-plane` 目录下运行 `pnpm test:integration`。

### 用 supertest 测试 Controller

```typescript
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import { AppModule } from '@/app.module';

describe('Auth Controller (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  test('GIVEN valid registration data WHEN posting to /auth/register THEN returns 201 with tokens', async () => {
    // WHEN
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new@example.com', password: 'validpassword123', name: 'Test User' });

    // THEN
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('accessToken');
  });

  test('GIVEN an invalid email WHEN posting to /auth/register THEN returns 400', async () => {
    // WHEN
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'validpassword123' });

    // THEN
    expect(response.status).toBe(400);
  });
});
```

### 集成测试的覆盖范围

- **认证流程** — 注册 → 登录 → 访问受保护路由 → 刷新 token
- **CRUD 操作** — 创建 → 查询 → 更新 → 删除，验证数据库状态
- **错误场景** — 无效输入（400）、未认证（401）、资源不存在（404）
- **中间件和 Guard** — 验证认证机制确实能拦截未授权的请求

不要在集成测试层面覆盖所有边界情况，那是单元测试的职责。集成测试的重点是验证组件之间的连接是否正确。

## E2E 测试

E2E 测试通过真实浏览器验证完整系统，是最接近人工手动测试的方式。

### 工具

| 工具 | 用途 |
|---|---|
| [Playwright](https://playwright.dev/) | 浏览器自动化，包括页面导航、点击按钮、填写表单、断言页面内容 |

> **当前状态：** `e2e/` 目录已存在但为空，Playwright 尚未安装。

### E2E 测试的覆盖范围

只覆盖关键用户旅程：

- 用户能否注册、登录并看到仪表盘？
- 用户能否创建房间、加入房间并看到编辑器？
- 用户能否编写代码并运行？

这些就是你的冒烟测试。如果它们都通过了，整个系统的核心功能就是正常的。

### Playwright 的工作原理

Playwright 启动一个真实浏览器，导航到你的应用，像用户一样进行交互：

```typescript
import { test, expect } from '@playwright/test';

test('GIVEN a registered user WHEN logging in with valid credentials THEN shows the dashboard', async ({ page }) => {
  // WHEN
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Log in' }).click();

  // THEN
  await expect(page.getByText('Dashboard')).toBeVisible();
});
```

### E2E 测试的最佳实践

- **只测试正常路径和关键错误路径** — 不要试图覆盖每个边界情况。E2E 测试速度慢，维护成本高。
- **使用 `data-testid` 属性**来可靠地选择元素。CSS 类名会随样式变化而改变，test ID 则不会：`<button data-testid="submit-code">Run</button>` → `page.getByTestId('submit-code')`。
- **保持测试独立** — 每个测试在 `beforeEach` 中通过 API 调用准备自己的数据，不依赖其他测试的状态。
- **不要重复测试已有覆盖的内容** — 如果表单校验已经有了单元测试，就不需要为每种无效输入再写 E2E 测试。

## 测试最佳实践

以下原则适用于所有测试层级。

### 修 Bug 时先写测试

在写修复代码之前，先写一个能复现 bug 的测试，运行它，确认它失败。然后写修复代码，再次运行测试，确认通过。这样这个 bug 就再也不会悄悄复现了。这是"测试驱动开发"最实用的应用方式，屡试不爽。

### 每个测试只验证一个行为

每个测试应该验证一件事。测试名应该读起来像规格说明：

```typescript
// Bad — multiple behaviors in one test
test('user registration', async () => {
  const result = await authService.register(validData);
  expect(result.id).toBeDefined();
  expect(result.email).toBe('test@example.com');
  expect(mockEmailService.send).toHaveBeenCalled();
  expect(mockCache.set).toHaveBeenCalledWith(`user:${result.id}`, expect.any(Object));
});

// Good — each behavior gets its own test
test('GIVEN valid data WHEN registering THEN creates user with correct email', ...);
test('GIVEN valid data WHEN registering THEN sends welcome email', ...);
test('GIVEN valid data WHEN registering THEN caches the new user', ...);
```

只有一个断言的测试失败时，你立刻就知道哪里出了问题。有五个断言的测试失败时，你还得去排查。

### 不要测试框架本身

NestJS 的依赖注入是正常工作的。Drizzle 的查询构建器是正常工作的。Vitest 的 mock 机制是正常工作的。测试**你的**逻辑，不要测试框架的逻辑。

```typescript
// Bad — testing that NestJS DI works
test('service is defined', () => {
  expect(service).toBeDefined();
});

// Bad — testing that Drizzle generates correct SQL
test('query uses WHERE clause', () => {
  expect(query.toSQL()).toContain('WHERE');
});
```

这些测试没有实际价值，而且永远不会失败（除非测试环境本身配错了，但那是另一个问题）。

### 使用描述性的测试名

测试名就是文档。读测试输出的人应该能理解预期行为：

```typescript
// Bad
test('auth test 3', ...);
test('should work', ...);
test('error case', ...);

// Good
test('returns 401 when JWT token is expired', ...);
test('GIVEN no rooms WHEN listing rooms THEN returns empty array', ...);
test('rejects passwords shorter than 8 characters', ...);
```

### Arrange-Act-Assert (AAA)

每个测试都应该有三个清晰的段落。这与 GIVEN-WHEN-THEN 是同一个思路：

```typescript
test('GIVEN cached data WHEN fetching room THEN returns from cache without DB query', async () => {
  // Arrange (GIVEN)
  const cachedRoom = { id: '123', name: 'Test Room' };
  mockCache.get.mockResolvedValue(cachedRoom);

  // Act (WHEN)
  const result = await service.getRoom('123');

  // Assert (THEN)
  expect(result).toEqual(cachedRoom);
  expect(mockDb.query).not.toHaveBeenCalled();
});
```

### 保持测试的执行速度

单个单元测试应该在 100ms 内完成。如果更慢，说明有问题，很可能是在做真实的网络调用、访问真实的数据库，或者执行实际的加密运算。把这些依赖 mock 掉。

整个单元测试套件应该在 30 秒内跑完。快速的测试会被经常运行，慢的测试会被忽略。

### 不要 mock 不属于你的东西

对第三方库做 mock 要小心。如果你把 `bcrypt.compare` mock 成永远返回 `true`，测试就没法告诉你 bcrypt 用对了没有。参考以下原则：

- 简单、快速的库（bcrypt、zod、uuid）：使用真实实现
- 慢速或外部服务（HTTP 客户端、数据库）：mock 掉或使用 Testcontainers
- 项目内的 Port 接口：放心 mock，它们本来就是为了可替换而设计的

### 测试公开 API，不要测试私有方法

如果一个私有方法复杂到你觉得需要单独测试，那说明它应该被提取成独立的函数或类，暴露公开 API，然后测那个 API。

```typescript
// Bad — testing a private method directly
test('_hashPassword uses bcrypt with cost 12', () => {
  const hash = service['_hashPassword']('secret');  // accessing private method
  // ...
});

// Good — test the public behavior that uses the private method
test('GIVEN a valid password WHEN registering THEN stores a hashed password (not plaintext)', async () => {
  await service.register({ email: 'test@example.com', password: 'secret123' });
  const user = await getTestUser('test@example.com');
  expect(user.passwordHash).not.toBe('secret123');
});
```

### 覆盖率是方向指引，不是目标

80% 的覆盖率不等于测试写得好。一个把所有函数都调一遍但不做任何断言的测试，覆盖率照样很高，但啥也没验证：

```typescript
// Achieves 100% coverage. Tests absolutely nothing.
test('covers everything', async () => {
  await service.register(validData);
  await service.login(validData);
  await service.refreshToken(token);
  await service.logout(token);
  // no assertions!
});
```

把覆盖率当**指南针**用就好，它告诉你哪些代码还没测到。但测试质量看的是断言写得好不好，不是覆盖率数字高不高。

## 测试命令速查

| 命令 | 说明 |
|---|---|
| `pnpm test` | 运行所有 workspace 的测试 |
| `pnpm test:cov` | 运行所有测试并生成覆盖率报告 |
| `cd apps/control-plane && pnpm test` | 运行单个应用的测试 |
| `cd apps/control-plane && vitest run src/modules/auth` | 运行单个模块的测试 |
| `cd apps/control-plane && vitest watch` | watch 模式，文件修改后自动重新运行 |
| `cd packages/infrastructure && pnpm test:watch` | infrastructure 包的 watch 模式 |

覆盖率报告生成在各 workspace 的 `coverage/` 目录下。在浏览器中打开 `coverage/index.html` 可以查看可视化报告，了解哪些代码行被覆盖了。
