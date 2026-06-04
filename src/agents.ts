import { homedir } from "node:os";
import { join } from "node:path";
import { installClaudeProject } from "./claude.js";
import { readJson, removeManagedBlock, upsertManagedBlock, writeJson } from "./util.js";

interface McpJson {
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
}

export function setupGlobalClaudeMcp(): string[] {
  const configPath = join(homedir(), ".claude", ".mcp.json");
  const existing = readJson<McpJson>(configPath) ?? {};
  const merged: McpJson = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      "vibe-guard": {
        command: "vibe-guard-mcp"
      }
    }
  };
  writeJson(configPath, merged);
  const messages = [
    `已写入全局 MCP 配置：${configPath}`,
    `vibe-guard MCP server 已注册为 vibe-guard-mcp（需要先 npm link）`,
    "重新启动 Claude Code 后生效。"
  ];
  // also write the global guidance file
  const guidancePath = join(homedir(), ".claude", "VIBE_GUARD.md");
  const result = upsertManagedBlock(guidancePath, globalGuidance());
  messages.push(`${result.changed ? "已写入" : "已保留"} 全局指引：${guidancePath}`);
  return messages;
}

export type AgentTarget = "claude" | "codex" | "cursor" | "all";

export function installAgent(target: AgentTarget, packageRoot: string, projectRoot = process.cwd()): string[] {
  const targets = expandTargets(target);
  const messages: string[] = [];
  for (const item of targets) {
    if (item === "claude") {
      messages.push(...installClaudeProject(projectRoot, packageRoot).messages);
    }
    if (item === "codex") {
      const path = join(homedir(), ".codex", "AGENTS.md");
      const result = upsertManagedBlock(path, agentDoc("Codex", packageRoot));
      messages.push(`${result.changed ? "已安装" : "已保留"} Codex 指引：${path}`);
    }
    if (item === "cursor") {
      const path = join(homedir(), ".cursor", "rules", "vibe-guard.mdc");
      const result = upsertManagedBlock(path, agentDoc("Cursor", packageRoot));
      messages.push(`${result.changed ? "已安装" : "已保留"} Cursor 指引：${path}`);
    }
  }
  messages.push("MCP 命令：node dist/mcp.js");
  messages.push("使用 `vguard integrations` 查看 Spec Kit、Archcore、BMAD、Task Master 和 agent-install 命令。");
  return messages;
}

export function uninstallAgent(target: AgentTarget): string[] {
  const targets = expandTargets(target);
  const messages: string[] = [];
  for (const item of targets) {
    const path =
      item === "claude"
        ? join(homedir(), ".claude", "VIBE_GUARD.md")
        : item === "codex"
          ? join(homedir(), ".codex", "AGENTS.md")
          : join(homedir(), ".cursor", "rules", "vibe-guard.mdc");
    const result = removeManagedBlock(path);
    messages.push(`${result.changed ? "已移除" : "未找到"} ${item} 托管区块：${path}`);
  }
  return messages;
}

function expandTargets(target: AgentTarget): Array<Exclude<AgentTarget, "all">> {
  return target === "all" ? ["claude", "codex", "cursor"] : [target];
}

function globalGuidance(): string {
  return `# vibe-guard 全局指引

你有 vibe-guard MCP 工具可用。在任何项目中开发时：

1. 开始较大开发前，调用 \`vguard_development_guidance\`。
2. 需要上下文时，调用 \`vguard_context_packet\`。
3. 宣称完成前，调用 \`vguard_quality_gate\`。

如果项目没有 \`.vibe-guard/\` 目录，使用 \`vguard_init_project\` 初始化。
`;
}

function agentDoc(agent: string, _packageRoot: string): string {
  if (agent === "Claude Code") {
    return globalGuidance();
  }
  return `# ${agent} 的 vibe-guard 指引

请将 vibe-guard 作为项目治理入口。

- 大型实现前，先调用 \`vguard_development_guidance\` 或运行 \`vguard guidance\`。
- 开始新项目方向前，运行 \`vguard research "<idea>"\`。
- 使用 \`vguard next\` 选择实现任务。
- 宣称完成前，运行 \`vguard check\`。
`;
}
