# vibe-guard

[![Node.js >=22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP Server](https://img.shields.io/badge/MCP-stdio_server-111827)](https://modelcontextprotocol.io/)
[![Claude Code](https://img.shields.io/badge/Claude_Code-supported-6B46C1)](https://www.anthropic.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-supported-111827)](https://github.com/openai/codex)
[![License MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`vibe-guard` 是一个本地 CLI + MCP Server，用来给 AI 辅助开发加上**项目前调研、规划门禁、任务门禁和质量门禁**。它不替代 Spec Kit、Archcore、BMAD Method、Task Master、Context7 或 DeepWiki，而是把这些工具串成一个统一入口。

> [!IMPORTANT]
> 一行安装到本机，并同时注册 Claude Code 与 Codex 的全局 MCP 配置：
>
> ```powershell
> npm install -g github:sikuai2333/vibe-guard; vguard setup
> ```
>
> 安装完成后重启 Claude Code / Codex，新会话会自动加载 `vibe-guard` MCP tools。

## 为什么需要它

| 常见问题 | vibe-guard 的处理方式 |
| --- | --- |
| 编码前不知道已有同类项目，重复造轮子 | `vguard research` / `vguard_prior_art` 生成前置调研 |
| AI 直接开始写代码，缺少规格、架构和边界 | `vguard_development_guidance` 在动手前检查门禁 |
| 大项目越写越偏，缺少可持续上下文入口 | `.vibe-guard/` 落地 runbook、links、tasks、reports |
| 没有测试、类型检查、审查记录 | `vguard check` / `vguard_quality_gate` 执行质量门禁 |
| 外部工具初始化容易误执行、误覆盖 | 集成命令默认 dry-run，真实执行需要 `--execute --yes` |

核心原则：**少写框架，多做集成；少占上下文，多落地文件；少靠提示词，多靠阶段门禁。**

## 当前能力

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| CLI | 已实现 | `vguard setup`、`init`、`check`、`research`、`integrations` 等 |
| MCP Server | 已实现 | 10 个工具，含 `vguard_init_project` |
| Claude Code | 已支持 | 写入 `~/.claude.json` 与 `~/.claude/VIBE_GUARD.md` |
| Codex | 已支持 | 写入 `~/.codex/config.toml` 与 `~/.codex/AGENTS.md` |
| 外部集成检测 | 已实现 | Spec Kit、Archcore、BMAD、Task Master、agent-install |
| 安全执行 | 已实现 | 默认 dry-run、执行前备份、拒绝占位符和 shell 控制字符 |
| 测试 | 已通过 | Node.js 内置 test runner |

开发和测试环境：Windows + Node.js 22。

## 快速开始

### 1. 安装并注册 MCP

```powershell
npm install -g github:sikuai2333/vibe-guard; vguard setup
```

只配置某一个宿主：

```powershell
vguard setup claude
vguard setup codex
```

检查本机环境：

```powershell
vguard doctor
```

### 2. 初始化目标项目

```powershell
vguard init C:\path\to\your-project
```

这会在目标项目里创建或更新 `.vibe-guard/`、`AGENTS.md`、`CLAUDE.md` 等治理入口。已有内容会保留；工具只更新 `<!-- vibe-guard:begin -->` 和 `<!-- vibe-guard:end -->` 之间的托管区块。

### 3. 重启 Claude Code / Codex

重启后，新会话会看到 `vibe-guard` MCP tools。用户只需要告诉 agent 想做什么，agent 就可以按门禁流程调用工具。

```mermaid
flowchart LR
  A["用户提出开发目标"] --> B["vguard_development_guidance"]
  B --> C["vguard_prior_art"]
  C --> D["规格 / 架构 / 任务"]
  D --> E["vguard_next_task"]
  E --> F["实现代码"]
  F --> G["vguard_quality_gate"]
  G --> H["提交 / 交付"]
```

## MCP Tools

| Tool | 作用 |
| --- | --- |
| `vguard_project_status` | 返回项目当前门禁状态 |
| `vguard_development_guidance` | 根据项目状态给出是否适合编码、下一步动作和建议 |
| `vguard_prior_art` | 执行平衡模式同类项目调研，并写入 `.vibe-guard/research.md` |
| `vguard_next_task` | 从 `.vibe-guard/tasks.json` 返回下一个未阻塞任务 |
| `vguard_quality_gate` | 运行项目质量检查，或记录显式跳过原因 |
| `vguard_context_packet` | 返回精简项目上下文包 |
| `vguard_integrations` | 返回外部工具可用状态 |
| `vguard_integration_run` | dry-run 或显式执行支持的外部集成初始化命令 |
| `vguard_skills` | 返回按需加载的 skills 索引 |
| `vguard_init_project` | 在目标项目中初始化 `.vibe-guard/` 治理目录 |

## 命令速查

| 命令 | 用途 |
| --- | --- |
| `vguard setup [claude\|codex\|all]` | 注册全局 MCP 配置，默认同时配置 Claude Code 与 Codex |
| `vguard doctor` | 检查 Node.js、npm、Python、Git、GitHub CLI、`uv`、Claude Code、Codex |
| `vguard init [path]` | 初始化目标项目治理目录和 agent 指引 |
| `vguard guidance [path]` | 生成与 MCP guidance 一致的开发引导 |
| `vguard research "<idea>"` | 执行项目前调研 |
| `vguard status [path]` | 输出项目门禁状态 |
| `vguard start [path]` | 检查启动门禁，不满足则非零退出 |
| `vguard next [path]` | 返回下一个未阻塞任务 |
| `vguard check [--skip "reason"]` | 执行质量门禁或记录跳过原因 |
| `vguard integrations [path] [--json]` | 检查外部集成状态 |
| `vguard integration-run <id> [path] [--execute --yes]` | dry-run 或显式执行外部集成初始化 |
| `vguard skills [path]` | 查看按需加载的 skills 索引 |
| `vguard install-agent claude\|codex\|cursor\|all` | 为指定 agent 写入使用指引 |
| `vguard uninstall-agent claude\|codex\|cursor\|all` | 移除托管指引区块 |
| `vguard verify-claude [path]` | 验证项目级 Claude Code 接入 |

## `vguard setup` 做了什么

> [!NOTE]
> 所有写入都是合并模式，不覆盖已有其他配置。

| 宿主 | 写入位置 | 内容 |
| --- | --- | --- |
| Claude Code | `~/.claude.json` | 用户级 MCP server 配置 |
| Claude Code | `~/.claude/VIBE_GUARD.md` | 全局使用指引 |
| Codex | `~/.codex/config.toml` | `[mcp_servers.vibe-guard]` 配置 |
| Codex | `~/.codex/AGENTS.md` | 全局使用指引 |

手动启动 MCP Server：

```powershell
vibe-guard-mcp
```

或从源码目录启动：

```powershell
node dist/mcp.js
```

## 项目初始化产物

`vguard init [path]` 会创建或更新：

```text
.vibe-guard/
  config.json
  links.json
  runbook.md
  skills/
    README.md
    skills.json
  reports/
    integrations.md
AGENTS.md
CLAUDE.md
```

> [!CAUTION]
> 本仓库不会提交真实 `.vibe-guard/`、`AGENTS.md`、`CLAUDE.md` 或 `.mcp.json`。这些文件可能包含本机绝对路径或项目上下文，默认应留在目标项目本地。

## 外部集成

| 集成 | 用途 | 默认行为 |
| --- | --- | --- |
| Spec Kit | 规格驱动规划和任务生成 | 检测 / dry-run |
| Archcore | 架构记忆、ADR、仓库规则和 MCP 上下文 | 检测 / dry-run |
| BMAD Method | 产品、架构和角色化规划工作流 | 检测 / dry-run |
| Task Master AI | 任务拆分、依赖追踪、下一任务选择 | 检测 / dry-run |
| agent-install | 跨 agent 的 MCP、skills、AGENTS.md 安装器 | 检测 / dry-run |

真正执行外部初始化命令必须显式确认：

```powershell
vguard integration-run task-master . --execute --yes
```

执行前会备份已存在的工具托管目录，例如 `.specify`、`.archcore`、`.taskmaster`、`.bmad-core`。包含 `<server>` 这类未替换占位符，或包含不安全 shell 控制字符的命令，会被拒绝执行。

<details>
<summary><strong>环境要求</strong></summary>

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

</details>

<details>
<summary><strong>开发</strong></summary>

```powershell
git clone https://github.com/sikuai2333/vibe-guard.git
cd vibe-guard
npm install
npm run build
npm test
node dist/cli.js doctor
```

测试使用 Node.js 内置 test runner。

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

</details>

## 许可证

[MIT](LICENSE)
