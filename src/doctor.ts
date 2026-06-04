import { commandExists, run } from "./util.js";

export interface DoctorCheck {
  name: string;
  command: string;
  ok: boolean;
  detail: string;
  fix: string;
}

const CHECKS: Array<{ name: string; command: string; args: string[]; fix: string }> = [
  { name: "Node.js", command: "node", args: ["--version"], fix: "安装 Node.js 22 或更高版本。" },
  { name: "npm", command: "npm", args: ["--version"], fix: "随 Node.js 安装 npm。" },
  { name: "Python", command: "python", args: ["--version"], fix: "安装 Python 3.11+，或确认 python 已加入 PATH。" },
  { name: "Git", command: "git", args: ["--version"], fix: "安装 Git for Windows。" },
  { name: "GitHub CLI", command: "gh", args: ["--version"], fix: "安装 GitHub CLI；否则 research 会使用质量较低的降级路径。" },
  { name: "uv", command: "uv", args: ["--version"], fix: "安装 uv，用于 Python/uvx 生态的 MCP 或外部工具。" },
  { name: "Claude Code", command: "claude", args: ["--version"], fix: "如需 Claude 集成，请安装 Claude Code。" },
  { name: "Codex", command: "codex", args: ["--version"], fix: "如需 Codex 集成，请安装 Codex CLI/Desktop。" }
];

export async function doctor(): Promise<DoctorCheck[]> {
  const results: DoctorCheck[] = [];
  for (const check of CHECKS) {
    if (!commandExists(check.command)) {
      results.push({ name: check.name, command: check.command, ok: false, detail: "missing", fix: check.fix });
      continue;
    }
    const result = await run(check.command, check.args, { timeoutMs: 12000 });
    const detail = `${result.stdout}${result.stderr}`.trim().split(/\r?\n/)[0] ?? "available";
    results.push({
      name: check.name,
      command: check.command,
      ok: result.code === 0 || check.command === "codex",
      detail: detail || "available",
      fix: check.fix
    });
  }
  return results;
}

export function formatDoctor(checks: DoctorCheck[]): string {
  const lines = ["# vibe-guard doctor", ""];
  for (const check of checks) {
    lines.push(`${check.ok ? "正常" : "缺失"} ${check.name}: ${check.detail}`);
    if (!check.ok) lines.push(`  修复建议：${check.fix}`);
  }
  return lines.join("\n");
}
