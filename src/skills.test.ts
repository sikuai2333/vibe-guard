import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureSkillCatalog, formatSkillCatalog, readSkillCatalog } from "./skills.js";

test("ensureSkillCatalog writes a lightweight skills index", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    ensureSkillCatalog(root);
    assert.equal(existsSync(join(root, ".vibe-guard", "skills", "skills.json")), true);
    assert.equal(existsSync(join(root, ".vibe-guard", "skills", "README.md")), true);
    const items = readSkillCatalog(root);
    assert.equal(items.length >= 2, true);
    assert.match(formatSkillCatalog(items), /按需/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
