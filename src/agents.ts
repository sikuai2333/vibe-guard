import { homedir } from "node:os";
import { join } from "node:path";
import { installClaudeProject } from "./claude.js";
import { INTEGRATIONS } from "./integrations.js";
import { removeManagedBlock, upsertManagedBlock } from "./util.js";

export type AgentTarget = "claude" | "codex" | "cursor" | "all";

export function installAgent(target: AgentTarget, packageRoot: string, projectRoot = process.cwd()): string[] {
  const targets = expandTargets(target);
  const messages: string[] = [];
  for (const item of targets) {
    if (item === "claude") {
      const path = join(homedir(), ".claude", "VIBE_GUARD.md");
      const result = upsertManagedBlock(path, agentDoc("Claude Code", packageRoot));
      messages.push(`${result.changed ? "已安装" : "已保留"} Claude 指引：${path}`);
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

function agentDoc(agent: string, packageRoot: string): string {
  return `# ${agent} 的 vibe-guard 指引

请将 vibe-guard 作为项目治理入口。

- CLI 根目录：${packageRoot}
- MCP Server 命令：\`node ${join(packageRoot, "dist", "mcp.js")}\`
- 大型实现前，先调用 \`vguard_development_guidance\` 或运行 \`vguard guidance\`。
- 开始新项目方向前，运行 \`vguard research "<idea>"\`。
- 使用 \`vguard next\` 选择实现任务。
- 宣称完成前，运行 \`vguard check\`。
- 假设 Spec Kit、Archcore、BMAD、Task Master 或 agent-install 已安装前，先运行 \`vguard integrations\`。

已知外部集成文档：
${INTEGRATIONS.map((integration) => `- ${integration.name}: ${integration.docsUrl}`).join("\n")}
`;
}
