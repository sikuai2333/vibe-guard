import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installCodexMcp, uninstallCodexMcp } from "./agents.js";

test("installCodexMcp writes and updates only the vibe-guard table", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const configPath = join(root, "config.toml");
    writeFileSync(configPath, '[mcp_servers.fetch]\ncommand = "uvx"\nargs = ["mcp-server-fetch"]\n', "utf8");

    const first = installCodexMcp(root, configPath);
    const second = installCodexMcp(root, configPath);
    const text = readFileSync(configPath, "utf8");

    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assert.match(text, /\[mcp_servers\.fetch\]/);
    assert.match(text, /\[mcp_servers\.vibe-guard\]/);
    assert.match(text, /command = "node"/);
    assert.match(text, /dist\\{1,2}mcp\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("uninstallCodexMcp removes the vibe-guard table only", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    const configPath = join(root, "config.toml");
    installCodexMcp(root, configPath);
    writeFileSync(`${configPath}.extra`, "kept", "utf8");

    const result = uninstallCodexMcp(configPath);
    const text = readFileSync(configPath, "utf8");

    assert.equal(result.changed, true);
    assert.doesNotMatch(text, /\[mcp_servers\.vibe-guard\]/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
