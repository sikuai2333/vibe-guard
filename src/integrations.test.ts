import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { formatIntegrations, getIntegrationStatuses, INTEGRATIONS, runIntegrationInit, type IntegrationId } from "./integrations.js";

test("integration registry covers required tools", () => {
  const ids = new Set(INTEGRATIONS.map((integration) => integration.id));
  for (const id of ["spec-kit", "archcore", "bmad", "task-master", "agent-install"] satisfies IntegrationId[]) {
    assert.equal(ids.has(id), true);
  }
});

test("integration status detects project signals", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    mkdirSync(join(root, ".archcore"));
    mkdirSync(join(root, ".taskmaster"));
    const statuses = await getIntegrationStatuses(root);
    assert.equal(statuses.find((status) => status.definition.id === "archcore")?.projectSignals.includes(".archcore"), true);
    assert.equal(statuses.find((status) => status.definition.id === "task-master")?.projectSignals.includes(".taskmaster"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration report includes actionable commands", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const report = formatIntegrations(await getIntegrationStatuses(root));
    assert.match(report, /Spec Kit/);
    assert.match(report, /可执行建议/);
    assert.match(report, /agent-install/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration run is dry-run by default", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const result = await runIntegrationInit(root, "task-master");
    assert.equal(result.dryRun, true);
    assert.equal(result.results.length, 0);
    assert.equal(existsSync(result.reportPath), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration run refuses unresolved placeholders", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const result = await runIntegrationInit(root, "agent-install", { execute: true, yes: true });
    assert.equal(result.ok, false);
    assert.match(result.message, /拒绝执行|没有可安全执行/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration execution backs up existing managed paths before command", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  const archcore = INTEGRATIONS.find((integration) => integration.id === "archcore");
  const originalCommands = archcore?.initCommands;
  try {
    assert.ok(archcore);
    archcore.initCommands = [`"${process.execPath}" --version`];
    mkdirSync(join(root, ".archcore"));
    writeFileSync(join(root, ".archcore", "rules.md"), "existing", "utf8");
    const result = await runIntegrationInit(root, "archcore", { execute: true, yes: true });
    assert.equal(result.dryRun, false);
    assert.equal(result.ok, true);
    assert.equal(result.backups.length, 1);
    assert.equal(existsSync(join(result.backups[0] ?? "", "rules.md")), true);
  } finally {
    if (archcore && originalCommands) archcore.initCommands = originalCommands;
    rmSync(root, { recursive: true, force: true });
  }
});
