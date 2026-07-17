# SynCode 贡献指南

> **[English](CONTRIBUTING.md)**

## 开发环境搭建

完整的搭建流程请参阅 [docs/getting-started.zh.md](docs/getting-started.zh.md)，包括前置依赖、环境变量配置和开发服务器启动。

## 分支命名

格式：`type/short-description`

需匹配正则：`^(feature|feat|bugfix|fix|hotfix|chore|docs|refactor|test|ci|style|perf)/[a-z0-9][a-z0-9-]*$`

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

## 提交信息

格式：`type(scope): description`

通过 commit-msg hook 由 [commitlint](https://commitlint.js.org/) 强制校验。

**Type 列表：** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scope 列表：** `web`, `control-plane`, `collab-plane`, `execution-plane`, `ai-plane`, `db`, `shared`, `contracts`, `ui`, `infra`, `ci`, `docs`, `deps`

**规则：**
- Scope 为必填项
- 主题行：10-100 个字符
- 正文：可选，不限行宽

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

## GitHub Projects

所有工作通过 [SynCode Development](https://github.com/orgs/JosephJoshua/projects) 项目看板进行跟踪。

### 看板字段

看板上的每个 Issue 都有以下字段：

| 字段 | 选项 | 说明 |
|---|---|---|
| **Status** | `Backlog` → `Ready` → `In progress` → `In review` → `Done` | 看板工作流阶段 |
| **Priority** | `P0`、`P1`、`P2` | P0 = 紧急/阻塞，P1 = 重要，P2 = 锦上添花 |
| **Size** | `XS`、`S`、`M`、`L`、`XL` | 工作量估算 |
| **Area** | `infra`、`control-plane`、`collab-plane`、`execution-plane`、`ai-plane`、`web` | 涉及的代码库区域 |
| **Type** | `task`、`story`、`bug`、`spike` | 工作类型 |

### 工作流程

1. 新 Issue 进入 **Backlog**
2. 被选入迭代后，移至 **Ready**
3. 开始开发时，移至 **In progress**
4. 提交 PR 后，移至 **In review**
5. 合并后，移至 **Done**

## Issues

- 每项非平凡的工作都应创建 GitHub Issue
- 创建 Issue 时需设置所有项目字段（Priority、Size、Area、Type）
- 开始工作时将 Issue 指派给自己
- Issue 类型分为 **story**、**task**、**bug**、**spike**：
  - **Story**：面向用户的功能（对应[用户故事](docs/user-stories.md)）
  - **Task**：技术工作项，通常是 Story 的子 Issue
  - **Bug**：缺陷修复
  - **Spike**：有时间限制的调研/探索

## Pull Request 流程

1. 基于 `develop` 分支创建新分支，遵循上述命名规范
2. 保持提交小而聚焦，每次提交不超过 500 行变更
3. 推送分支后创建 PR，目标分支为 `develop`
4. 在 PR 正文中使用 `Closes #N` 关联对应 Issue
5. 确保 CI 全部通过（lint、类型检查、测试）
6. 指定 Joseph 进行 code review

**PR 正文格式：**
```markdown
Closes #<issue-number>

如变更内容从 Issue 标题不够明显，可在此简要说明。
```

**规则：**
- 禁止直接推送到 `main` 或 `develop`，分支保护规则会拒绝推送
- 所有变更必须通过 PR 合入 `develop`
- `main` 只接受从 `develop` 的合并
- 每个 PR 应通过 `Closes #N` 关联对应 Issue

## 代码风格

项目使用 **[Biome 2.x](https://biomejs.dev/)** 同时负责 lint 和格式化，不使用 ESLint，也不使用 Prettier。

```bash
pnpm check           # Check lint + format (no changes)
pnpm lint:fix        # Auto-fix lint + format issues
pnpm format          # Auto-fix formatting
```

风格规则（配置在 `biome.json` 中）：
- 单引号
- 使用分号
- 尾逗号
- 行宽 100 字符
- 2 空格缩进

编辑器会自动识别 `biome.json` 配置。建议为 VS Code 或其他 IDE 安装 [Biome 插件](https://biomejs.dev/guides/editors/first-party-plugins/)。

## 测试

提交 PR 前请务必运行测试：

```bash
pnpm test            # Run all tests across all workspaces
pnpm test:cov        # Run with coverage reports
```

**覆盖率要求：** 所有后端代码的语句覆盖率需达到 80% 以上，由 SonarCloud 的默认质量门禁在 CI 中强制执行。前端 (`apps/web`) 的覆盖率不纳入 SonarCloud 检查范围。

项目统一使用 [Vitest](https://vitest.dev/) 进行测试。测试理念、最佳实践和编写测试的详细指南请参阅 [docs/testing.zh.md](docs/testing.zh.md)。

## 提交行数限制

pre-commit hook 会拒绝超过 **500 行变更**的提交。这一限制旨在保持 PR 的可审查性，鼓励增量式开发。如果改动较大，请拆分为多个提交。
