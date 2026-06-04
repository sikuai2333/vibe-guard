import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { MANAGED_BEGIN, MANAGED_END } from "./constants.js";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function projectPath(input?: string): string {
  return resolve(input ?? process.cwd());
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readText(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

export function writeText(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, "utf8");
}

export function readJson<T>(path: string): T | undefined {
  const text = readText(path);
  if (!text) return undefined;
  return JSON.parse(text) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function commandExists(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSyncLike(probe, args, 5000);
  return result.code === 0 && result.stdout.trim().length > 0;
}

export async function run(command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: process.platform === "win32",
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
    }, options.timeoutMs ?? 30000);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolvePromise({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

export function spawnSyncLike(command: string, args: string[], timeoutMs: number): CommandResult {
  const result = spawnSync(command, args, {
    shell: process.platform === "win32",
    windowsHide: true,
    timeout: timeoutMs,
    encoding: "utf8"
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? ""
  };
}

export function backupFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const backupPath = `${path}.vguard-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  renameSync(path, backupPath);
  writeText(path, readFileSync(backupPath, "utf8"));
  return backupPath;
}

export function upsertManagedBlock(path: string, body: string): { changed: boolean; backup?: string } {
  const existing = readText(path) ?? "";
  const block = `${MANAGED_BEGIN}\n${body.trim()}\n${MANAGED_END}`;
  const pattern = new RegExp(`${escapeRegExp(MANAGED_BEGIN)}[\\s\\S]*?${escapeRegExp(MANAGED_END)}`);
  const next = pattern.test(existing)
    ? existing.replace(pattern, block)
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${block}\n`;
  if (next === existing) return { changed: false };
  const backup = existing ? backupFile(path) : undefined;
  writeText(path, next);
  return { changed: true, backup };
}

export function removeManagedBlock(path: string): { changed: boolean; backup?: string } {
  const existing = readText(path);
  if (!existing) return { changed: false };
  const pattern = new RegExp(`\\n?${escapeRegExp(MANAGED_BEGIN)}[\\s\\S]*?${escapeRegExp(MANAGED_END)}\\n?`);
  if (!pattern.test(existing)) return { changed: false };
  const backup = backupFile(path);
  writeText(path, existing.replace(pattern, "\n").trimEnd() + "\n");
  return { changed: true, backup };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function relJoin(root: string, ...parts: string[]): string {
  return join(root, ...parts);
}

export function nowIso(): string {
  return new Date().toISOString();
}
