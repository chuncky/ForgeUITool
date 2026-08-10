import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("history dialog FR-004 (Beken-aligned)", () => {
  it("HistoryDialog has three-pane BK layout wiring", () => {
    const dlg = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/HistoryDialog.vue"),
      "utf8",
    );
    expect(dlg).toContain("历史版本");
    expect(dlg).toContain("恢复到此版本");
    expect(dlg).toContain("已存档");
    expect(dlg).toContain("个页面");
    expect(dlg).toContain("restoreSnapshot");
    expect(dlg).toContain("deleteSnapshot");
    expect(dlg).toContain("fetchSnapshotPreview");
    expect(dlg).toContain("HistoryScreenPreview");

    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("showHistory");
    expect(toolbar).toContain("historyLabel");
  });

  it("core snapshot module exposes preview/delete/max 50", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "packages/core/src/project-snapshot.ts"),
      "utf8",
    );
    expect(src).toContain(".forge/history");
    expect(src).toContain("MAX_SNAPSHOTS = 50");
    expect(src).toContain("loadSnapshotPreview");
    expect(src).toContain("deleteSnapshot");
    expect(src).toContain("pageCount");
    expect(src).toContain("byteSize");
  });

  it("electron IPC wires preview and delete", () => {
    const main = fs.readFileSync(
      path.join(repoRoot, "apps/designer/electron/main.mjs"),
      "utf8",
    );
    expect(main).toContain("project:getSnapshotPreview");
    expect(main).toContain("project:deleteSnapshot");
    const preload = fs.readFileSync(
      path.join(repoRoot, "apps/designer/electron/preload.cjs"),
      "utf8",
    );
    expect(preload).toContain("getSnapshotPreview");
    expect(preload).toContain("deleteSnapshot");
  });
});
