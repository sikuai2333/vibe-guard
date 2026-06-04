import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { qualityGate } from "./check.js";
import { initProject } from "./project.js";

test("qualityGate records skip reason", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    initProject(root);
    const result = await qualityGate(root, "planning-only verification");
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    assert.equal(existsSync(join(root, ".vibe-guard", "reports", "skip-log.md")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qualityGate runs npm scripts when present", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    initProject(root);
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { check: "node -e \"process.exit(0)\"" } }), "utf8");
    const result = await qualityGate(root);
    assert.equal(result.ok, true);
    assert.equal(result.checks.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
