import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { developmentGuidance } from "./guidance.js";
import { initProject } from "./project.js";

test("developmentGuidance blocks coding when required gates are missing", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    initProject(root);
    const guidance = developmentGuidance(root, "implement-feature");
    assert.equal(guidance.okToCode, false);
    assert.equal(guidance.requiredActions.length > 0, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
