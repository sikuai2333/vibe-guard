import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { installClaudeProject } from "./claude.js";
import { readJson, readText, removeManagedBlock, upsertManagedBlock, writeJson, writeText } from "./util.js";

interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
}

export function setupGlobalClaudeMcp(): string[] {
  // Claude Code 从用户级 ~/.claude.json 读取 MCP 配置。
  const configPath = join(homedir(), ".claude.json");
  const existing = readJson<Record<string, unknown>>(configPath) ?? {};
  const packageRoot = resolve(import.meta.dirname, "..");
  const mcpServers = (existing.mcpServers ?? {}) as Record<string, McpServerEntry>;
  mcpServers["vibe-guard"] = {
    command: "node",
    args: [join(packageRoot, "dist", "mcp.js")]
  };
  const merged = { ...existing, mcpServers };
  writeJson(configPath, merged);

  const messages = [
    `Claude MCP 配置：${configPath}`,
    `vibe-guard MCP server：node ${join(packageRoot, "dist", "mcp.js")}`,
    "重启 Claude Code 后生效。"
  ];

  const guidancePath = join(homedir(), ".claude", "VIBE_GUARD.md");
  const result = upsertManagedBlock(guidancePath, globalGuidance());
  messages.push(`Claude 全局指引：${result.changed ? "已更新" : "已保留"} ${guidancePath}`);
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
      const result = upsertManagedBlock(path, agentDoc("Codex"));
      const configResult = installCodexMcp(packageRoot);
      messages.push(`Codex 指引：${result.changed ? "已更新" : "已保留"} ${path}`);
      messages.push(`Codex MCP 配置：${configResult.changed ? "已更新" : "已保留"} ${configResult.path}`);
    }
    if (item === "cursor") {
      const path = join(homedir(), ".cursor", "rules", "vibe-guard.mdc");
      const result = upsertManagedBlock(path, agentDoc("Cursor"));
      messages.push(`Cursor 指引：${result.changed ? "已更新" : "已保留"} ${path}`);
    }
  }
  messages.push("MCP 命令：node dist/mcp.js");
  messages.push("使用 `vguard integrations` 查看 Spec Kit、Archcore、BMAD、Task Master 和 agent-install。");
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
    messages.push(`${item} 指引：${result.changed ? "已移除" : "未找到"} ${path}`);
    if (item === "codex") {
      const configResult = uninstallCodexMcp();
      messages.push(`Codex MCP 配置：${configResult.changed ? "已移除" : "未找到"} ${configResult.path}`);
    }
  }
  return messages;
}

export function installCodexMcp(packageRoot: string, configPath = join(homedir(), ".codex", "config.toml")): { path: string; changed: boolean } {
  const mcpPath = resolve(packageRoot, "dist", "mcp.js");
  const block = ["[mcp_servers.vibe-guard]", 'command = "node"', `args = [${tomlString(mcpPath)}]`].join("\n");
  return upsertTomlTable(configPath, "mcp_servers.vibe-guard", block);
}

export function uninstallCodexMcp(configPath = join(homedir(), ".codex", "config.toml")): { path: string; changed: boolean } {
  return removeTomlTable(configPath, "mcp_servers.vibe-guard");
}

function expandTargets(target: AgentTarget): Array<Exclude<AgentTarget, "all">> {
  return target === "all" ? ["claude", "codex", "cursor"] : [target];
}

function upsertTomlTable(path: string, table: string, block: string): { path: string; changed: boolean } {
  const existing = readText(path) ?? "";
  const pattern = tomlTablePattern(table);
  const next = pattern.test(existing)
    ? existing.replace(pattern, (match) => `${match.startsWith("\n") ? "\n" : ""}${block}`)
    : `${existing.trimEnd()}${existing.trimEnd() ? "\n\n" : ""}${block}\n`;
  const normalized = next.endsWith("\n") ? next : `${next}\n`;
  if (normalized === existing) return { path, changed: false };
  writeText(path, normalized);
  return { path, changed: true };
}

function removeTomlTable(path: string, table: string): { path: string; changed: boolean } {
  const existing = readText(path);
  if (!existing) return { path, changed: false };
  const next = existing.replace(tomlTablePattern(table), (match) => (match.startsWith("\n") ? "\n" : ""));
  if (next === existing) return { path, changed: false };
  writeText(path, `${next.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`);
  return { path, changed: true };
}

function tomlTablePattern(table: string): RegExp {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\r?\\n)\\[${escaped}\\]\\r?\\n[\\s\\S]*?(?=\\r?\\n\\[|$)`);
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function globalGuidance(): string {
  return `# vibe-guard 全局指引

你有 vibe-guard MCP 工具可用。在任何项目中开发时：

1. 开始较大开发前，调用 \`vguard_development_guidance\`。
2. 需要上下文时，调用 \`vguard_context_packet\`。
3. 宣称完成前，调用 \`vguard_quality_gate\`。

如果项目没有 \`.vibe-guard/\` 目录，先调用 \`vguard_init_project\` 初始化。
`;
}

function agentDoc(agent: string): string {
  if (agent === "Claude Code") return globalGuidance();
  return `# ${agent} 的 vibe-guard 指引

请将 vibe-guard 作为项目治理入口。

- 大型实现前，先调用 \`vguard_development_guidance\` 或运行 \`vguard guidance\`。
- 开始新项目方向前，运行 \`vguard research "<idea>"\`。
- 使用 \`vguard next\` 选择实现任务。
- 宣称完成前，运行 \`vguard check\`。
`;
}
