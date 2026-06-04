import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import {
  CONFIG_FILE,
  LINKS_FILE,
  REPORTS_DIR,
  RESEARCH_FILE,
  RUNBOOK_FILE,
  SKILLS_DIR,
  VG_DIR
} from "./constants.js";
import { ensureSkillCatalog } from "./skills.js";
import { ProjectStatus, VibeGuardConfig, VibeGuardLinks, VibeGuardTask } from "./types.js";
import { ensureDir, nowIso, readJson, readText, relJoin, upsertManagedBlock, writeJson, writeText } from "./util.js";

export function configPath(root: string): string {
  return join(root, VG_DIR, CONFIG_FILE);
}

export function linksPath(root: string): string {
  return join(root, VG_DIR, LINKS_FILE);
}

export function defaultConfig(root: string): VibeGuardConfig {
  const now = nowIso();
  return {
    version: 1,
    projectName: basename(root),
    createdAt: now,
    updatedAt: now,
    researchMode: "balanced",
    qualityGate: "strict-skippable",
    integrations: {
      specKit: "external",
      archcore: "external",
      bmad: "optional-external",
      taskManager: "external",
      agentInstall: "external"
    }
  };
}

export function initProject(root: string): string[] {
  const messages: string[] = [];
  ensureDir(join(root, VG_DIR));
  ensureDir(join(root, VG_DIR, REPORTS_DIR));
  ensureDir(join(root, VG_DIR, "decisions"));

  if (!existsSync(configPath(root))) {
    writeJson(configPath(root), defaultConfig(root));
    messages.push(`已创建 ${relJoin(root, VG_DIR, CONFIG_FILE)}`);
  }

  if (!existsSync(linksPath(root))) {
    const links: VibeGuardLinks = {
      notes: [
        "Spec Kit、Archcore、BMAD 和任务管理器的输出应保留在各自原生位置。",
        "vibe-guard 只保存指针、工作流入口和报告。"
      ]
    };
    writeJson(linksPath(root), links);
    messages.push(`已创建 ${relJoin(root, VG_DIR, LINKS_FILE)}`);
  }

  const runbook = buildRunbook();
  writeText(join(root, VG_DIR, RUNBOOK_FILE), runbook);
  messages.push(`已写入 ${relJoin(root, VG_DIR, RUNBOOK_FILE)}`);
  for (const skillPath of ensureSkillCatalog(root)) {
    messages.push(`已写入 ${skillPath}`);
  }

  const agentBlock = buildAgentBlock();
  const agents = upsertManagedBlock(join(root, "AGENTS.md"), agentBlock);
  messages.push(`${agents.changed ? "已更新" : "已保留"} ${relJoin(root, "AGENTS.md")}`);
  const claude = upsertManagedBlock(join(root, "CLAUDE.md"), agentBlock);
  messages.push(`${claude.changed ? "已更新" : "已保留"} ${relJoin(root, "CLAUDE.md")}`);
  return messages;
}

export function buildRunbook(): string {
  return `# vibe-guard 运行手册

请通过以下门禁使用本项目：

1. \`vguard research "<idea>"\`：编码前先检查已有项目和可复用方案。
2. \`vguard integrations\`：确认外部规划工具是已安装、可通过 npx/uvx 运行，还是缺失。
3. \`vguard integration-run <id>\`：预览外部初始化命令；只有明确需要执行时才使用 \`--execute --yes\`。
4. 规格门禁：使用 Spec Kit 或本地 spec 文件定义目标和非目标。
5. 架构门禁：记录模块边界、ADR 或 Archcore 笔记。
6. 任务门禁：创建带依赖和验收标准的小任务。
7. \`vguard check\`：运行质量检查，或记录显式跳过原因。

专项能力按需加载：需要 TDD、诊断、架构改进、PRD 或 Agent 行为准则时，再查看 \`.vibe-guard/skills/README.md\`。

外部工具仍以各自目录中的原生输出为准；vibe-guard 只负责协调和记录入口。
`;
}

export function buildAgentBlock(): string {
  return `# vibe-guard 入口

在本项目中实现较大代码变更前：

1. 阅读 \`.vibe-guard/runbook.md\`。
2. 查看 \`.vibe-guard/research.md\` 中的同类项目调研。
3. 查看 \`.vibe-guard/config.json\` 和 \`.vibe-guard/links.json\`。
4. 使用 \`vguard integrations\` 确认 Spec Kit、Archcore、BMAD、Task Master 或 agent-install 是否可用。
5. 使用 \`vguard integration-run <id>\` 预览外部初始化命令；没有 \`--execute --yes\` 不要执行。
6. 使用 \`vguard_development_guidance\` 或 \`vguard guidance\` 判断是否适合开始编码。
7. 使用 \`vguard status\`、\`vguard next\` 和 \`vguard check\` 作为项目门禁。
8. 只有需要专项能力时才查看 \`.vibe-guard/skills/README.md\`，不要把所有 skills 常驻加载进上下文。
9. 不要绕过 \`vguard check\`；如需跳过，必须用 \`vguard check --skip "<reason>"\` 记录原因。
`;
}

export function getStatus(root: string): ProjectStatus {
  const vg = join(root, VG_DIR);
  const research = join(vg, RESEARCH_FILE);
  const specCandidates = [join(vg, "spec.md"), join(root, "spec.md"), join(root, "specs")];
  const archCandidates = [join(root, ".archcore"), join(vg, "decisions")];
  const taskCandidates = [join(vg, "tasks.json"), join(root, "tasks"), join(root, ".taskmaster")];
  const qualityReports = join(vg, REPORTS_DIR, "quality-latest.md");
  return {
    root,
    initialized: existsSync(vg) && existsSync(configPath(root)),
    research: {
      ok: existsSync(research),
      label: "调研门禁",
      detail: existsSync(research) ? research : "缺少 .vibe-guard/research.md"
    },
    spec: {
      ok: specCandidates.some(existsSync),
      label: "规格门禁",
      detail: specCandidates.find(existsSync) ?? "缺少规格输出"
    },
    architecture: {
      ok: archCandidates.some(existsSync),
      label: "架构记忆门禁",
      detail: archCandidates.find(existsSync) ?? "缺少架构笔记或 .archcore"
    },
    tasks: {
      ok: taskCandidates.some(existsSync),
      label: "任务门禁",
      detail: taskCandidates.find(existsSync) ?? "缺少任务"
    },
    quality: {
      ok: existsSync(qualityReports),
      label: "质量门禁",
      detail: existsSync(qualityReports) ? qualityReports : "缺少质量报告"
    }
  };
}

export function readTasks(root: string): VibeGuardTask[] {
  const file = join(root, VG_DIR, "tasks.json");
  return readJson<VibeGuardTask[]>(file) ?? [];
}

export function nextTask(root: string): VibeGuardTask | undefined {
  const tasks = readTasks(root);
  const completed = new Set(tasks.filter((task) => task.status === "completed").map((task) => task.id));
  return tasks.find((task) => {
    if (task.status !== "pending") return false;
    return (task.dependencies ?? []).every((id) => completed.has(id));
  });
}

export function formatStatus(status: ProjectStatus): string {
  const gates = [status.research, status.spec, status.architecture, status.tasks, status.quality];
  return [
    `项目：${status.root}`,
    `已初始化：${status.initialized ? "是" : "否"}`,
    ...gates.map((gate) => `${gate.ok ? "通过" : "等待"} ${gate.label}: ${gate.detail}`)
  ].join("\n");
}

export function contextPacket(root: string): string {
  const files = [
    join(root, VG_DIR, RUNBOOK_FILE),
    join(root, VG_DIR, RESEARCH_FILE),
    join(root, VG_DIR, "spec.md"),
    join(root, VG_DIR, "tasks.json"),
    join(root, VG_DIR, SKILLS_DIR, "README.md"),
    join(root, VG_DIR, REPORTS_DIR, "integrations.md"),
    join(root, VG_DIR, REPORTS_DIR, "quality-latest.md")
  ];
  return files
    .map((file) => {
      const text = readText(file);
      if (!text) return undefined;
      return `## ${file}\n\n${text.slice(0, 12000)}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
