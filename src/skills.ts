import { join } from "node:path";
import { SKILLS_DIR, SKILLS_FILE, VG_DIR } from "./constants.js";
import { SkillCatalogItem } from "./types.js";
import { ensureDir, readJson, writeJson, writeText } from "./util.js";

export const DEFAULT_SKILLS: SkillCatalogItem[] = [
  {
    id: "mattpocock-skills",
    name: "Matt Pocock skills",
    source: "https://github.com/mattpocock/skills",
    purpose: "诊断、TDD、架构改进、PRD、代码审查等工程工作流技能。",
    loadWhen: "需要专项工程流程时再加载，例如 TDD、诊断、架构改进或 PRD 编写。",
    install: "manual"
  },
  {
    id: "karpathy-skills",
    name: "Andrej Karpathy-style skills",
    source: "https://github.com/multica-ai/andrej-karpathy-skills",
    purpose: "强调简单性、验证、上下文管理和高质量 AI 编程习惯。",
    loadWhen: "需要强化 Agent 基础行为准则时再加载，不作为常驻长提示。",
    install: "manual"
  }
];

export function ensureSkillCatalog(root: string): string[] {
  const dir = join(root, VG_DIR, SKILLS_DIR);
  ensureDir(dir);
  const catalogPath = join(dir, SKILLS_FILE);
  const readmePath = join(dir, "README.md");
  if (!readJson<SkillCatalogItem[]>(catalogPath)) {
    writeJson(catalogPath, DEFAULT_SKILLS);
  }
  writeText(readmePath, formatSkillReadme(readSkillCatalog(root)));
  return [catalogPath, readmePath];
}

export function readSkillCatalog(root: string): SkillCatalogItem[] {
  return readJson<SkillCatalogItem[]>(join(root, VG_DIR, SKILLS_DIR, SKILLS_FILE)) ?? DEFAULT_SKILLS;
}

export function formatSkillCatalog(items: SkillCatalogItem[]): string {
  const lines = ["# vibe-guard 按需 skills", ""];
  for (const item of items) {
    lines.push(`## ${item.name}`, "");
    lines.push(`ID：${item.id}`);
    lines.push(`来源：${item.source}`);
    lines.push(`用途：${item.purpose}`);
    lines.push(`加载时机：${item.loadWhen}`);
    lines.push(`安装方式：${item.install === "manual" ? "手动安装或外部工具安装" : "外部工具安装"}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function formatSkillReadme(items: SkillCatalogItem[]): string {
  return `${formatSkillCatalog(items)}

## 使用原则

- 不把所有 skills 常驻写入 \`AGENTS.md\` 或 \`CLAUDE.md\`。
- 只有任务确实需要某类能力时，才读取对应 skill。
- 外部 skill 的源码和许可证以原仓库为准；vibe-guard 只保存索引和加载建议。
- 若要复制或安装外部 skill，请先确认许可证、来源和适配目标 Agent。
`;
}
