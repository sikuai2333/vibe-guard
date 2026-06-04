import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPORTS_DIR, SKIP_LOG, VG_DIR } from "./constants.js";
import { QualityResult } from "./types.js";
import { ensureDir, nowIso, readJson, run, writeText } from "./util.js";

interface PackageJson {
  scripts?: Record<string, string>;
}

export async function qualityGate(root: string, skipReason?: string): Promise<QualityResult> {
  ensureDir(join(root, VG_DIR, REPORTS_DIR));
  if (skipReason) {
    const reportPath = join(root, VG_DIR, REPORTS_DIR, "quality-latest.md");
    const entry = `- ${nowIso()}: ${skipReason}\n`;
    appendFileSync(join(root, VG_DIR, REPORTS_DIR, SKIP_LOG), entry, "utf8");
    writeText(reportPath, `# 质量门禁已跳过\n\n原因：${skipReason}\n`);
    return { ok: true, skipped: true, detected: [], checks: [], reportPath };
  }

  const checks = detectChecks(root);
  const detected = checks.map((check) => check.name);
  const results: QualityResult["checks"] = [];
  for (const check of checks) {
    const result = await run(check.command, check.args, { cwd: root, timeoutMs: 120000 });
    const output = `${result.stdout}${result.stderr}`.trim().slice(0, 8000);
    results.push({
      name: check.name,
      command: [check.command, ...check.args].join(" "),
      ok: result.code === 0,
      output
    });
  }
  const reportPath = join(root, VG_DIR, REPORTS_DIR, "quality-latest.md");
  const ok = results.length > 0 && results.every((result) => result.ok);
  writeText(reportPath, formatQualityReport(ok, detected, results));
  return { ok, skipped: false, detected, checks: results, reportPath };
}

function detectChecks(root: string): Array<{ name: string; command: string; args: string[] }> {
  const checks: Array<{ name: string; command: string; args: string[] }> = [];
  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    const pkg = readJson<PackageJson>(packagePath);
    const scripts = pkg?.scripts ?? {};
    for (const script of ["lint", "typecheck", "test", "check"]) {
      if (scripts[script]) checks.push({ name: `npm ${script}`, command: "npm", args: ["run", script] });
    }
  }
  if (existsSync(join(root, "pyproject.toml")) || existsSync(join(root, "requirements.txt"))) {
    if (existsSync(join(root, "pyproject.toml"))) {
      checks.push({ name: "python compile", command: "python", args: ["-m", "compileall", "."] });
    }
  }
  if (existsSync(join(root, "Cargo.toml"))) {
    checks.push({ name: "cargo test", command: "cargo", args: ["test"] });
  }
  if (existsSync(join(root, "go.mod"))) {
    checks.push({ name: "go test", command: "go", args: ["test", "./..."] });
  }
  return dedupeChecks(checks);
}

function dedupeChecks(checks: Array<{ name: string; command: string; args: string[] }>) {
  const seen = new Set<string>();
  return checks.filter((check) => {
    const key = `${check.command} ${check.args.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatQualityReport(ok: boolean, detected: string[], checks: QualityResult["checks"]): string {
  const lines = [`# 质量门禁`, "", `创建时间：${nowIso()}`, `状态：${ok ? "通过" : "失败或缺失"}`, ""];
  lines.push("## 检测到的检查", "");
  if (detected.length === 0) {
    lines.push("未检测到可运行的质量检查。请为项目添加 lint、typecheck、test 或 check 脚本。");
  } else {
    lines.push(...detected.map((check) => `- ${check}`));
  }
  lines.push("", "## 结果", "");
  for (const check of checks) {
    lines.push(`### ${check.name}`, "", `命令：\`${check.command}\``, `状态：${check.ok ? "通过" : "失败"}`, "");
    if (check.output) lines.push("```text", check.output, "```", "");
  }
  return `${lines.join("\n")}\n`;
}
