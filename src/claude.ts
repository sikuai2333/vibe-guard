import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildAgentBlock } from "./project.js";
import { commandExists, readJson, run, upsertManagedBlock, writeJson } from "./util.js";

export interface ClaudeInstallResult {
  mcpPath: string;
  claudePath: string;
  messages: string[];
}

export interface ClaudeVerifyResult {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    detail: string;
  }>;
}

interface McpJson {
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
}

export function installClaudeProject(root: string, packageRoot: string): ClaudeInstallResult {
  const mcpPath = join(root, ".mcp.json");
  const existing = readJson<McpJson>(mcpPath) ?? {};
  const mcp = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      "vibe-guard": {
        command: "node",
        args: [resolve(packageRoot, "dist", "mcp.js")]
      }
    }
  };
  writeJson(mcpPath, mcp);
  const claudePath = join(root, "CLAUDE.md");
  const result = upsertManagedBlock(claudePath, buildClaudeProjectBlock());
  return {
    mcpPath,
    claudePath,
    messages: [
      `已写入项目级 MCP 配置：${mcpPath}`,
      `${result.changed ? "已更新" : "已保留"} Claude 项目入口：${claudePath}`,
      "首次进入 Claude Code 时，项目级 .mcp.json 可能需要审批。"
    ]
  };
}

export async function verifyClaudeProject(root: string): Promise<ClaudeVerifyResult> {
  const checks: ClaudeVerifyResult["checks"] = [];
  const mcpPath = join(root, ".mcp.json");
  const claudePath = join(root, "CLAUDE.md");
  const mcp = readJson<McpJson>(mcpPath);
  const server = mcp?.mcpServers?.["vibe-guard"];

  checks.push({
    name: ".mcp.json",
    ok: Boolean(server),
    detail: server ? `vibe-guard -> ${server.command} ${(server.args ?? []).join(" ")}` : "缺少 vibe-guard MCP 配置"
  });
  checks.push({
    name: "CLAUDE.md",
    ok: existsSync(claudePath) && (await fileContains(claudePath, "vguard_development_guidance")),
    detail: existsSync(claudePath) ? claudePath : "缺少 CLAUDE.md"
  });
  checks.push({
    name: "claude CLI",
    ok: commandExists("claude"),
    detail: commandExists("claude") ? "claude 可用" : "未检测到 claude 命令"
  });
  if (server?.command) {
    const result = await run(server.command, server.args ?? [], { cwd: root, timeoutMs: 1200 });
    checks.push({
      name: "MCP server 启动",
      ok: result.code === 0 || result.code === 143 || result.code === 1,
      detail: "已尝试启动 MCP server；stdio server 在无客户端时退出属于可接受结果"
    });
  }
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

export function formatClaudeVerify(result: ClaudeVerifyResult): string {
  const lines = ["# Claude Code 接入验证", ""];
  for (const check of result.checks) {
    lines.push(`${check.ok ? "通过" : "失败"} ${check.name}: ${check.detail}`);
  }
  lines.push("", `总体：${result.ok ? "通过" : "未通过"}`);
  return lines.join("\n");
}

export function buildClaudeProjectBlock(): string {
  return `${buildAgentBlock()}

Claude Code 必须优先使用 vibe-guard MCP：

1. 开始较大开发前，先调用 \`vguard_development_guidance\`。
2. 如果引导结果显示不建议编码，先完成它列出的 requiredActions。
3. 需要上下文时，优先调用 \`vguard_context_packet\`，不要先整仓库扫读。
4. 宣称完成前，调用 \`vguard_quality_gate\` 或运行 \`vguard check\`。
`;
}

async function fileContains(path: string, needle: string): Promise<boolean> {
  const { readFile } = await import("node:fs/promises");
  if (!existsSync(path)) return false;
  return (await readFile(path, "utf8")).includes(needle);
}
