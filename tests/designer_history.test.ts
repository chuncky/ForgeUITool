import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("history dialog FR-004", () => {
  it("HistoryDialog and toolbar wiring exist", () => {
    const dlg = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/HistoryDialog.vue"),
      "utf8",
    );
    expect(dlg).toContain("历史版本");
    expect(dlg).toContain("restoreSnapshot");

    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("showHistory");
    expect(toolbar).not.toContain('label="历史"\n        disabled');
  });

  it("core project-snapshot module exists", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "packages/core/src/project-snapshot.ts"),
      "utf8",
    );
    expect(src).toContain(".forge/history");
    expect(src).toContain("restoreSnapshot");
  });
});
