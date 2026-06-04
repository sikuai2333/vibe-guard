import { join } from "node:path";
import { REPORTS_DIR, RESEARCH_FILE, VG_DIR } from "./constants.js";
import { commandExists, ensureDir, nowIso, run, writeText } from "./util.js";

export interface Candidate {
  source: "github" | "npm" | "pypi";
  name: string;
  url?: string;
  description?: string;
  meta?: string;
}

export interface ResearchResult {
  idea: string;
  createdAt: string;
  candidates: Candidate[];
  failures: string[];
  recommendation: string;
  reportPath: string;
}

export async function research(root: string, idea: string): Promise<ResearchResult> {
  ensureDir(join(root, VG_DIR));
  ensureDir(join(root, VG_DIR, REPORTS_DIR));
  const failures: string[] = [];
  const candidates: Candidate[] = [];

  candidates.push(...await githubSearch(idea, failures));
  candidates.push(...await npmSearch(idea, failures));
  candidates.push(...await pypiSearch(idea, failures));

  const recommendation = recommend(candidates, failures);
  const result: ResearchResult = {
    idea,
    createdAt: nowIso(),
    candidates,
    failures,
    recommendation,
    reportPath: join(root, VG_DIR, RESEARCH_FILE)
  };
  writeText(result.reportPath, formatResearch(result));
  return result;
}

async function githubSearch(idea: string, failures: string[]): Promise<Candidate[]> {
  if (!commandExists("gh")) {
    failures.push("已跳过 GitHub 搜索：未安装 gh。");
    return [];
  }
  const result = await run("gh", [
    "search",
    "repos",
    idea,
    "--limit",
    "8",
    "--json",
    "fullName,description,url,stargazersCount,updatedAt"
  ], { timeoutMs: 30000 });
  if (result.code !== 0) {
    failures.push(`GitHub 搜索失败：${trimOutput(result.stderr || result.stdout)}`);
    return [];
  }
  try {
    const rows = JSON.parse(result.stdout) as Array<{
      fullName: string;
      description?: string;
      url: string;
      stargazersCount?: number;
      updatedAt?: string;
    }>;
    return rows.map((row) => ({
      source: "github" as const,
      name: row.fullName,
      url: row.url,
      description: row.description,
      meta: `${row.stargazersCount ?? 0} stars, updated ${row.updatedAt ?? "unknown"}`
    }));
  } catch (error) {
    failures.push(`GitHub 结果解析失败：${(error as Error).message}`);
    return [];
  }
}

async function npmSearch(idea: string, failures: string[]): Promise<Candidate[]> {
  if (!commandExists("npm")) {
    failures.push("已跳过 npm 搜索：未安装 npm。");
    return [];
  }
  const result = await run("npm", ["search", idea, "--json", "--searchlimit", "8"], { timeoutMs: 30000 });
  if (result.code !== 0) {
    failures.push(`npm 搜索失败：${trimOutput(result.stderr || result.stdout)}`);
    return [];
  }
  try {
    const rows = JSON.parse(result.stdout) as Array<{
      name: string;
      description?: string;
      version?: string;
      links?: { npm?: string; repository?: string };
    }>;
    return rows.map((row) => ({
      source: "npm" as const,
      name: row.name,
      url: row.links?.repository ?? row.links?.npm,
      description: row.description,
      meta: row.version ? `version ${row.version}` : undefined
    }));
  } catch (error) {
    failures.push(`npm 结果解析失败：${(error as Error).message}`);
    return [];
  }
}

async function pypiSearch(idea: string, failures: string[]): Promise<Candidate[]> {
  try {
    const response = await fetch(`https://pypi.org/search/?q=${encodeURIComponent(idea)}`, {
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "vibe-guard/0.1" }
    });
    if (!response.ok) {
      failures.push(`PyPI 搜索失败：HTTP ${response.status}`);
      return [];
    }
    const html = await response.text();
    const names = [...html.matchAll(/<span class="package-snippet__name">([^<]+)<\/span>/g)].slice(0, 8).map((match) => decodeHtml(match[1] ?? ""));
    const versions = [...html.matchAll(/<span class="package-snippet__version">([^<]+)<\/span>/g)].slice(0, 8).map((match) => decodeHtml(match[1] ?? ""));
    const descs = [...html.matchAll(/<p class="package-snippet__description">\s*([^<]+?)\s*<\/p>/gs)].slice(0, 8).map((match) => decodeHtml(match[1] ?? ""));
    return names.map((name, index) => ({
      source: "pypi" as const,
      name,
      url: `https://pypi.org/project/${name}/`,
      description: descs[index],
      meta: versions[index] ? `version ${versions[index]}` : undefined
    }));
  } catch (error) {
    failures.push(`PyPI 搜索失败：${(error as Error).message}`);
    return [];
  }
}

function recommend(candidates: Candidate[], failures: string[]): string {
  const github = candidates.filter((candidate) => candidate.source === "github").length;
  const packages = candidates.filter((candidate) => candidate.source !== "github").length;
  if (github >= 3 && packages >= 3) {
    return "组合复用：已有较多同类项目和包。优先集成或 fork，不要直接重写。";
  }
  if (github >= 3) {
    return "复用或 fork：已有仓库级同类项目。编码前先检查架构和许可证。";
  }
  if (packages >= 3) {
    return "复用：已有包级同类能力。优先组合现有库。";
  }
  if (candidates.length > 0) {
    return "继续调研：存在候选，但证据不足以直接决定实现方式。";
  }
  return failures.length > 0
    ? "降级：部分搜索失败或不可用。不要把这当作没有同类项目的证据。"
    : "可重写：默认平衡搜索未发现强同类项目。";
}

export function formatResearch(result: ResearchResult): string {
  const lines = [
    `# 同类项目调研：${result.idea}`,
    "",
    `创建时间：${result.createdAt}`,
    `建议：${result.recommendation}`,
    "",
    "## 候选",
    ""
  ];
  if (result.candidates.length === 0) {
    lines.push("平衡搜索未发现候选。");
  } else {
    for (const candidate of result.candidates) {
      lines.push(`- [${candidate.source}] ${candidate.name}${candidate.url ? ` - ${candidate.url}` : ""}`);
      if (candidate.description) lines.push(`  ${candidate.description}`);
      if (candidate.meta) lines.push(`  ${candidate.meta}`);
    }
  }
  lines.push("", "## 失败和限制", "");
  if (result.failures.length === 0) {
    lines.push("没有记录搜索失败。");
  } else {
    lines.push(...result.failures.map((failure) => `- ${failure}`));
  }
  lines.push(
    "",
    "## 下一步",
    "",
    "实现前，请手动或通过 DeepWiki/Context7 检查排名靠前的候选，并记录应复用、fork、组合还是重写。"
  );
  return `${lines.join("\n")}\n`;
}

function trimOutput(value: string): string {
  return value.trim().split(/\r?\n/).slice(0, 3).join(" ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
