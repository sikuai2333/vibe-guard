import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installClaudeProject, verifyClaudeProject } from "./claude.js";
import { readJson } from "./util.js";

test("installClaudeProject writes project MCP config and CLAUDE entry", async () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const result = installClaudeProject(root, root);
    assert.equal(existsSync(result.mcpPath), true);
    const mcp = readJson<{ mcpServers: Record<string, { command: string; args: string[] }> }>(result.mcpPath);
    assert.equal(mcp?.mcpServers["vibe-guard"].command, "node");
    const verify = await verifyClaudeProject(root);
    assert.equal(verify.checks.some((check) => check.name === ".mcp.json" && check.ok), true);
    assert.equal(verify.checks.some((check) => check.name === "CLAUDE.md" && check.ok), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
