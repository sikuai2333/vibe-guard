#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function collectTestFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectTestFiles(path));
    if (entry.isFile() && entry.name.endsWith(".test.js")) files.push(path);
  }
  return files;
}

const tests = collectTestFiles("dist");
if (tests.length === 0) {
  console.error("No compiled test files found under dist.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
  shell: false
});

process.exit(result.status ?? 1);
