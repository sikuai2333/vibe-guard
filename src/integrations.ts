import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPORTS_DIR, VG_DIR } from "./constants.js";
import { commandExists, ensureDir, nowIso, run, writeText } from "./util.js";

export type IntegrationId = "spec-kit" | "archcore" | "bmad" | "task-master" | "agent-install";
export type IntegrationState = "installed" | "project-configured" | "npx-available" | "one-shot-available" | "missing";

export interface CommandProbe {
  command: string;
  args: string[];
}

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  purpose: string;
  docsUrl: string;
  probes: CommandProbe[];
  projectSignals: string[];
  npxPackage?: string;
  oneShotCommand?: string;
  installCommands: string[];
  initCommands: string[];
}

export interface IntegrationStatus {
  definition: IntegrationDefinition;
  state: IntegrationState;
  command?: string;
  version?: string;
  projectSignals: string[];
  actionable: string[];
}

export interface IntegrationRunOptions {
  execute?: boolean;
  yes?: boolean;
}

export interface IntegrationRunResult {
  integration: IntegrationId;
  dryRun: boolean;
  ok: boolean;
  state: IntegrationState;
  commands: string[];
  backups: string[];
  reportPath: string;
  results: Array<{
    command: string;
    ok: boolean;
    output: string;
  }>;
  message: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "spec-kit",
    name: "Spec Kit",
    purpose: "规格驱动的规划和任务生成。",
    docsUrl: "https://github.github.com/spec-kit/install/one-time.html",
    probes: [{ command: "specify", args: ["--version"] }],
    projectSignals: [".specify", "specs"],
    oneShotCommand: "uvx --from git+https://github.com/github/spec-kit.git specify init . --integration claude",
    installCommands: [
      "先安装 uv，然后运行：uvx --from git+https://github.com/github/spec-kit.git specify init . --integration claude"
    ],
    initCommands: ["uvx --from git+https://github.com/github/spec-kit.git specify init . --integration claude"]
  },
  {
    id: "archcore",
    name: "Archcore",
    purpose: "结构化架构记忆、ADR、仓库规则和 MCP 上下文。",
    docsUrl: "https://docs.archcore.ai/cli/overview/",
    probes: [{ command: "archcore", args: ["--version"] }],
    projectSignals: [".archcore"],
    installCommands: ["irm https://archcore.ai/install.ps1 | iex"],
    initCommands: ["archcore init", "archcore mcp install", "archcore hooks install"]
  },
  {
    id: "bmad",
    name: "BMAD Method",
    purpose: "产品、架构和角色化规划工作流。",
    docsUrl: "https://docs.bmad-method.org/how-to/install-bmad/",
    probes: [
      { command: "bmad-method", args: ["--version"] },
      { command: "bmad", args: ["--version"] }
    ],
    projectSignals: ["_bmad", "bmad", ".bmad-core"],
    npxPackage: "bmad-method",
    installCommands: ["npx bmad-method install"],
    initCommands: ["npx bmad-method install --directory . --tools claude-code --yes"]
  },
  {
    id: "task-master",
    name: "Task Master AI",
    purpose: "任务拆分、依赖追踪和下一任务选择。",
    docsUrl: "https://github.com/eyaltoledano/claude-task-master",
    probes: [
      { command: "task-master", args: ["--version"] },
      { command: "task-master-ai", args: ["--version"] },
      { command: "task-master-mcp", args: ["--version"] }
    ],
    projectSignals: [".taskmaster"],
    npxPackage: "task-master-ai",
    installCommands: ["npx task-master-ai init"],
    initCommands: ["npx task-master-ai init"]
  },
  {
    id: "agent-install",
    name: "agent-install",
    purpose: "跨 Agent 的 MCP、skills 和 AGENTS.md 安装器。",
    docsUrl: "https://www.agent-install.com/",
    probes: [{ command: "agent-install", args: ["--version"] }],
    projectSignals: [],
    npxPackage: "agent-install",
    installCommands: ["npx agent-install@latest --help"],
    initCommands: ["npx agent-install@latest mcp add <server> -a claude-code"]
  }
];

export async function getIntegrationStatuses(root: string): Promise<IntegrationStatus[]> {
  const npmAvailable = commandExists("npm");
  const uvxAvailable = commandExists("uvx") || commandExists("uv");
  const statuses: IntegrationStatus[] = [];
  for (const definition of INTEGRATIONS) {
    const signals = definition.projectSignals.filter((signal) => existsSync(join(root, signal)));
    const installed = await findInstalledProbe(definition);
    let state: IntegrationState = "missing";
    if (installed) state = "installed";
    else if (signals.length > 0) state = "project-configured";
    else if (definition.npxPackage && npmAvailable) state = "npx-available";
    else if (definition.oneShotCommand && uvxAvailable) state = "one-shot-available";
    const actionable = buildActionable(definition, state, signals);
    statuses.push({
      definition,
      state,
      command: installed?.command,
      version: installed?.version,
      projectSignals: signals,
      actionable
    });
  }
  return statuses;
}

export async function writeIntegrationReport(root: string): Promise<string> {
  ensureDir(join(root, VG_DIR, REPORTS_DIR));
  const statuses = await getIntegrationStatuses(root);
  const reportPath = join(root, VG_DIR, REPORTS_DIR, "integrations.md");
  writeText(reportPath, formatIntegrations(statuses));
  return reportPath;
}

export async function runIntegrationInit(root: string, id: IntegrationId, options: IntegrationRunOptions = {}): Promise<IntegrationRunResult> {
  ensureDir(join(root, VG_DIR, REPORTS_DIR));
  const status = (await getIntegrationStatuses(root)).find((item) => item.definition.id === id);
  if (!status) throw new Error(`Unknown integration: ${id}`);

  const commands = runnableCommands(status);
  const dryRun = !(options.execute && options.yes);
  const reportPath = join(root, VG_DIR, REPORTS_DIR, `integration-run-${id}.md`);
  const base: IntegrationRunResult = {
    integration: id,
    dryRun,
    ok: true,
    state: status.state,
    commands,
    backups: [],
    reportPath,
    results: [],
    message: dryRun ? "仅 dry-run；如需执行请传入 --execute --yes" : "已执行"
  };

  if (commands.length === 0) {
    base.ok = false;
    base.message = "当前集成状态下没有可安全执行的初始化命令";
    writeText(reportPath, formatIntegrationRun(base));
    return base;
  }

  const unsafe = commands.find((command) => !isSafeRunnableCommand(command));
  if (unsafe) {
    base.ok = false;
    base.message = `拒绝执行不安全或未解析的命令：${unsafe}`;
    writeText(reportPath, formatIntegrationRun(base));
    return base;
  }

  if (dryRun) {
    writeText(reportPath, formatIntegrationRun(base));
    return base;
  }

  base.backups = backupProjectSignals(root, status.definition);
  for (const commandLine of commands) {
    const [command, ...args] = splitCommandLine(commandLine);
    const result = await run(command, args, { cwd: root, timeoutMs: 180000 });
    base.results.push({
      command: commandLine,
      ok: result.code === 0,
      output: `${result.stdout}${result.stderr}`.trim().slice(0, 12000)
    });
    if (result.code !== 0) {
      base.ok = false;
      base.message = `命令执行失败：${commandLine}`;
      break;
    }
  }
  writeText(reportPath, formatIntegrationRun(base));
  return base;
}

export function formatIntegrations(statuses: IntegrationStatus[]): string {
  const lines = [`# 集成报告`, "", `创建时间：${nowIso()}`, ""];
  for (const status of statuses) {
    lines.push(`## ${status.definition.name}`, "");
    lines.push(`状态：${status.state}`);
    lines.push(`用途：${status.definition.purpose}`);
    lines.push(`文档：${status.definition.docsUrl}`);
    if (status.command) lines.push(`命令：\`${status.command}\``);
    if (status.version) lines.push(`版本：${status.version}`);
    if (status.projectSignals.length > 0) {
      lines.push(`项目特征：${status.projectSignals.join(", ")}`);
    }
    lines.push("", "可执行建议：");
    for (const command of status.actionable) lines.push(`- \`${command}\``);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatIntegrationsSummary(statuses: IntegrationStatus[]): string {
  const lines = ["# vibe-guard integrations", ""];
  for (const status of statuses) {
    const detail = status.version ? `${status.state}, ${status.version}` : status.state;
    lines.push(`${status.state === "missing" ? "缺失" : "可用"} ${status.definition.name}: ${detail}`);
    if (status.state === "missing") lines.push(`  修复建议：${status.actionable[0]}`);
  }
  return lines.join("\n");
}

export function formatIntegrationRun(result: IntegrationRunResult): string {
  const lines = [
    `# 集成执行：${result.integration}`,
    "",
    `创建时间：${nowIso()}`,
    `模式：${result.dryRun ? "dry-run" : "execute"}`,
    `状态：${result.state}`,
    `结果：${result.ok ? "通过" : "失败"}`,
    `说明：${result.message}`,
    "",
    "## 命令",
    ""
  ];
  if (result.commands.length === 0) {
    lines.push("没有命令。");
  } else {
    lines.push(...result.commands.map((command) => `- \`${command}\``));
  }
  lines.push("", "## 备份", "");
  if (result.backups.length === 0) {
    lines.push(result.dryRun ? "dry-run 模式不会创建备份。" : "没有需要备份的既有工具托管路径。");
  } else {
    lines.push(...result.backups.map((backup) => `- ${backup}`));
  }
  lines.push("", "## 执行结果", "");
  if (result.results.length === 0) {
    lines.push(result.dryRun ? "dry-run 模式未执行命令。" : "没有命令结果。");
  } else {
    for (const command of result.results) {
      lines.push(`### ${command.command}`, "", `状态：${command.ok ? "通过" : "失败"}`, "");
      if (command.output) lines.push("```text", command.output, "```", "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

async function findInstalledProbe(definition: IntegrationDefinition): Promise<{ command: string; version?: string } | undefined> {
  for (const probe of definition.probes) {
    if (!commandExists(probe.command)) continue;
    const result = await run(probe.command, probe.args, { timeoutMs: 12000 });
    const version = `${result.stdout}${result.stderr}`.trim().split(/\r?\n/)[0];
    return {
      command: [probe.command, ...probe.args].join(" "),
      version: result.code === 0 ? version || "available" : "available"
    };
  }
  return undefined;
}

function buildActionable(definition: IntegrationDefinition, state: IntegrationState, signals: string[]): string[] {
  if (state === "installed") return definition.initCommands;
  if (state === "project-configured") {
    return [
      ...definition.initCommands,
      `检测到已有项目特征：${signals.join(", ")}`
    ];
  }
  if (state === "npx-available" && definition.npxPackage) return definition.initCommands;
  if (state === "one-shot-available" && definition.oneShotCommand) return [definition.oneShotCommand];
  return definition.installCommands;
}

function runnableCommands(status: IntegrationStatus): string[] {
  if (status.state === "missing") return [];
  if (status.state === "one-shot-available" && status.definition.oneShotCommand) return [status.definition.oneShotCommand];
  return status.definition.initCommands;
}

function isSafeRunnableCommand(command: string): boolean {
  if (/<[^>]+>/.test(command)) return false;
  if (/[|;&`]/.test(command)) return false;
  return splitCommandLine(command).length > 0;
}

function backupProjectSignals(root: string, definition: IntegrationDefinition): string[] {
  const backups: string[] = [];
  const stamp = nowIso().replace(/[:.]/g, "-");
  const backupRoot = join(root, VG_DIR, "backups", `${stamp}-${definition.id}`);
  for (const signal of definition.projectSignals) {
    const source = join(root, signal);
    if (!existsSync(source)) continue;
    const target = join(backupRoot, signal);
    ensureDir(backupRoot);
    cpSync(source, target, { recursive: true, force: false, errorOnExist: true });
    backups.push(target);
  }
  return backups;
}

function splitCommandLine(commandLine: string): string[] {
  const parts: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of commandLine.matchAll(pattern)) {
    parts.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return parts.filter(Boolean);
}
