# vibe-guard

`vibe-guard` 是一个本地 CLI + MCP Server，用来给 AI 辅助开发加上项目前调研、规划门禁、任务门禁和质量门禁。它不替代 Spec Kit、Archcore、BMAD Method、Task Master、Context7 或 DeepWiki，而是把这些工具串成一个统一入口。

它主要解决几类常见问题：

- 编码前不知道已有同类项目，重复造轮子
- AI 直接开始写代码，缺少规格、架构和任务边界
- 大项目越写越偏，缺少可持续的上下文入口
- 没有测试、类型检查、审查记录，质量不可控
- 外部工具初始化容易误执行、误覆盖

核心原则：**少写框架，多做集成；少占上下文，多落地文件；少靠提示词，多靠阶段门禁。**

## 当前状态

当前版本是 `0.1.0` MVP。已实现并测试：

- CLI（含 `vguard setup` 全局 MCP 注册）
- MCP Server（10 个工具，含 `vguard_init_project`）
- 外部集成检测
- 默认 dry-run 的外部初始化命令
- prior-art research 调研报告
- 项目状态门禁
- 质量门禁
- Agent 指引文件生成
- 按需加载的 skills 索引

开发和测试环境：Windows + Node.js 22。

## 环境要求

必需：

- Node.js 22 或更高版本
- npm
- Git

推荐：

- GitHub CLI：`gh`
- Python
- `uv` / `uvx`
- Claude Code
- Codex

检查本机环境：

```powershell
vguard doctor
```

## 一行安装

```powershell
npm install -g github:sikuai2333/vibe-guard; vguard setup
```

这会把 `vguard` 安装到本机，并同时注册 Claude Code 与 Codex 的全局 MCP 配置。安装完成后重启 Claude Code / Codex，新会话会自动加载 vibe-guard MCP tools。

只配置某一个宿主：

```powershell
vguard setup claude
vguard setup codex
```

## 快速开始

### 一次性设置

```powershell
vguard setup
```

这会注册 Claude Code 与 Codex 的全局 MCP server，之后新打开的 Claude Code / Codex 会话会自动加载 vibe-guard 工具。

### 在项目中使用

```powershell
vguard init C:\path\to\your-project
```

然后在该项目目录下打开 Claude Code，Claude 会自动：

1. 检测 `.vibe-guard/` 目录和门禁状态
2. 问你想做什么
3. 自动运行调研、创建规格、拆分任务
4. 在开发全程通过 MCP 工具检查门禁

### 工作流（Claude 驱动）

用户只需告诉 Claude 想做什么，Claude 会：

1. 调用 `vguard_development_guidance` 检查门禁
2. 调用 `vguard_prior_art` 调研同类项目
3. 创建规格和架构文档
4. 拆分任务（`vguard_next_task`）
5. 实现代码
6. 调用 `vguard_quality_gate` 检查质量

全程无需手动运行 CLI 命令。

## 命令说明

### `vguard setup [claude|codex|all]`

一次性设置。默认同时配置 Claude Code 与 Codex：

- Claude Code：写入 `~/.claude.json`，并写入全局指引文件 `~/.claude/VIBE_GUARD.md`
- Codex：写入 `~/.codex/config.toml`，并写入全局指引文件 `~/.codex/AGENTS.md`

所有写入都是合并模式，不覆盖已有其他配置。

```powershell
vguard setup
```

设置完成后，重新启动 Claude Code / Codex 即可自动加载 vibe-guard 工具。后续项目只需 `vguard init` 即可。

### `vguard doctor`

检查 Node.js、npm、Python、Git、GitHub CLI、`uv`、Claude Code、Codex，以及已知外部工作流工具。

### `vguard init [path]`

在目标项目中创建或更新：

- `.vibe-guard/config.json`
- `.vibe-guard/links.json`
- `.vibe-guard/runbook.md`
- `.vibe-guard/skills/README.md`
- `.vibe-guard/skills/skills.json`
- `.vibe-guard/reports/integrations.md`
- `AGENTS.md` 托管区块
- `CLAUDE.md` 托管区块

已有内容会保留；工具只更新 `<!-- vibe-guard:begin -->` 和 `<!-- vibe-guard:end -->` 之间的内容。

说明：本仓库不提交真实 `.vibe-guard/`、`AGENTS.md`、`CLAUDE.md` 或 `.mcp.json`。这些都是用户在目标项目运行命令后生成的项目状态文件，可能包含本机路径或项目上下文。

### `vguard integrations [path] [--json]`

报告以下工具的可用状态：

- Spec Kit
- Archcore
- BMAD Method
- Task Master AI
- agent-install

输出会包含当前状态、用途、文档链接和可执行建议命令。

### `vguard integration-run <id> [path] [--execute --yes]`

支持的 `id`：

- `spec-kit`
- `archcore`
- `bmad`
- `task-master`
- `agent-install`

默认只预览命令：

```powershell
vguard integration-run spec-kit .
```

真正执行必须同时提供 `--execute` 和 `--yes`：

```powershell
vguard integration-run task-master . --execute --yes
```

执行前会备份已存在的工具托管目录，例如 `.specify`、`.archcore`、`.taskmaster`、`.bmad-core`。备份位置在 `.vibe-guard/backups/`。包含 `<server>` 这类未替换占位符，或包含不安全 shell 控制字符的命令，会被拒绝执行。

### `vguard research "<idea>"`

执行平衡模式的项目前调研，并写入 `.vibe-guard/research.md`。当前会检查：

- GitHub 仓库，优先使用 `gh`
- npm 包
- PyPI 风格搜索结果

如果某个来源失败，报告会记录失败原因，不会把“搜索失败”误判为“没有同类项目”。

### `vguard skills [path]`

查看按需加载的 skills 索引。当前默认索引包含：

- `mattpocock/skills`
- `multica-ai/andrej-karpathy-skills`

`vibe-guard` 不会把这些 skills 全部塞进 `AGENTS.md` 或 `CLAUDE.md`。常驻入口只保留一行提示，详细说明在 `.vibe-guard/skills/README.md`，需要专项能力时再加载。

### `vguard status [path]`

输出目标项目的门禁状态。

### `vguard start [path]`

检查启动门禁。如果缺少必要门禁，会以非零状态退出。

### `vguard next [path]`

读取 `.vibe-guard/tasks.json`，返回依赖已经完成的下一个待处理任务。

### `vguard check [--skip "reason"]`

检测并运行质量检查。Node 项目会优先使用已有 npm scripts，例如 `lint`、`typecheck`、`test`、`check`。

显式跳过：

```powershell
vguard check --skip "仅文档变更"
```

跳过原因会写入 `.vibe-guard/reports/skip-log.md`。

### `vguard install-agent claude|codex|cursor|all`

为指定 Agent 写入非破坏性的使用指引。

对 Claude Code，会在目标项目里写入项目级 `.mcp.json`（推荐使用 `vguard setup` 做全局配置，而不是每个项目单独配置）。

对 Codex，会写入 `~/.codex/config.toml` 的 MCP server 配置和 `~/.codex/AGENTS.md` 指引。对 Cursor，写入全局指引文件。

仓库里提供 [.mcp.example.json](.mcp.example.json) 作为格式示例。真实 `.mcp.json` 包含本机绝对路径，默认不会提交。

### `vguard verify-claude [path]`

验证：

- `.mcp.json` 是否包含 `vibe-guard`
- `CLAUDE.md` 是否包含 `vguard_development_guidance`
- 本机是否有 `claude` 命令
- MCP Server 是否能尝试启动

### `vguard guidance [path] [--intent start-development|implement-feature|before-commit|status]`

在 CLI 中生成与 MCP `vguard_development_guidance` 一致的开发引导。它会根据当前门禁判断是否适合直接编码，并给出下一步动作。

### `vguard uninstall-agent claude|codex|cursor|all`

只移除 `vibe-guard` 托管区块，不删除用户其他配置。

## MCP Server

推荐通过 `vguard setup` 全局注册 MCP server。注册后，所有项目的新 Claude Code / Codex 会话都会自动加载 vibe-guard 工具。

手动启动 MCP Server：

```powershell
node dist/mcp.js
```

如果已经全局链接：

```powershell
vibe-guard-mcp
```

提供的 MCP tools：

- `vguard_project_status`
- `vguard_development_guidance`
- `vguard_prior_art`
- `vguard_next_task`
- `vguard_quality_gate`
- `vguard_context_packet`
- `vguard_integrations`
- `vguard_integration_run`
- `vguard_skills`
- `vguard_init_project`

## 目录结构

```text
src/
  agents.ts        Agent 指引安装 + 全局 MCP 设置
  check.ts         质量门禁检测和执行
  cli.ts           CLI 入口
  doctor.ts        本机环境检查
  integrations.ts  外部工具注册表和安全初始化执行器
  mcp.ts           MCP Server
  project.ts       项目文件、状态、runbook、任务
  research.ts      项目前调研
  skills.ts        按需加载的 skills 索引
```

## 安全模型

- 保留已有 `AGENTS.md` 和 `CLAUDE.md` 内容。
- 生成内容放在明确的托管区块内。
- 外部初始化命令默认 dry-run。
- 真实执行必须带 `--execute --yes`。
- 执行前会备份已知工具托管目录。
- 未替换占位符和不安全 shell 控制字符会被拒绝。
- 质量门禁允许跳过，但必须记录原因。
- skills 只做索引和按需加载提示，不默认塞进常驻上下文。

## 开发

```powershell
git clone https://github.com/sikuai2333/vibe-guard.git
cd vibe-guard
npm install
npm run build
npm test
node dist/cli.js doctor
```

测试使用 Node.js 内置 test runner。

## 许可证

MIT
