import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getStatus, initProject, nextTask } from "./project.js";

test("initProject creates managed files without deleting existing content", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    writeFileSync(join(root, "AGENTS.md"), "# Existing\n", "utf8");
    initProject(root);
    const status = getStatus(root);
    assert.equal(status.initialized, true);
    assert.equal(status.research.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("nextTask returns first unblocked pending task", () => {
  const root = mkdtempSync(join(tmpdir(), "vguard-"));
  try {
    initProject(root);
    writeFileSync(
      join(root, ".vibe-guard", "tasks.json"),
      JSON.stringify([
        { id: "a", title: "Done", status: "completed" },
        { id: "b", title: "Next", status: "pending", dependencies: ["a"] },
        { id: "c", title: "Blocked", status: "pending", dependencies: ["missing"] }
      ]),
      "utf8"
    );
    assert.equal(nextTask(root)?.id, "b");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
