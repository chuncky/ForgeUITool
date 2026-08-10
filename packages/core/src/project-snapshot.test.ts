import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MAX_SNAPSHOTS,
  createSnapshot,
  deleteSnapshot,
  formatSnapshotSize,
  listSnapshots,
  loadSnapshotPreview,
  openProject,
  restoreSnapshot,
  saveProject,
  updateNodeProps,
} from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".forge") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("project snapshots FR-004", () => {
  it("creates and lists history under .forge/history with pageCount/size", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-"));
    copyDir(templateRoot, tmp);
    const meta = createSnapshot(tmp, "before_edit");
    expect(meta.label).toBe("before_edit");
    expect(meta.pageCount).toBeGreaterThanOrEqual(1);
    expect(meta.byteSize).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmp, ".forge/history", meta.id, "project.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".forge/history", meta.id, "screens/home.json"))).toBe(true);
    const list = listSnapshots(tmp);
    expect(list.some((s) => s.id === meta.id)).toBe(true);
    expect(formatSnapshotSize(1024)).toBe("1.0 KB");
  });

  it("loadSnapshotPreview returns screens without mutating workspace", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-p-"));
    copyDir(templateRoot, tmp);
    const meta = createSnapshot(tmp, "preview");
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "lbl_title", { props: { text: "Live" } });
    saveProject(loaded);

    const preview = loadSnapshotPreview(tmp, meta.id);
    expect(preview.meta.id).toBe(meta.id);
    expect(preview.screens.home?.children?.[0]?.props.text).toBe("Hello ForgeUI");
    // workspace still has Live
    expect(openProject(tmp).screens.get("home")!.children[0]!.props.text).toBe("Live");
  });

  it("deleteSnapshot removes one version", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-d-"));
    copyDir(templateRoot, tmp);
    const a = createSnapshot(tmp, "a");
    const b = createSnapshot(tmp, "b");
    deleteSnapshot(tmp, a.id);
    const ids = listSnapshots(tmp).map((s) => s.id);
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(a.id);
  });

  it("createSnapshot rejects when at MAX_SNAPSHOTS", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-max-"));
    copyDir(templateRoot, tmp);
    for (let i = 0; i < MAX_SNAPSHOTS; i++) {
      // unique ids via slight delay not needed — uniqueSnapshotId uses ISO + suffix
      createSnapshot(tmp, `n${i}`, i === MAX_SNAPSHOTS - 1 ? undefined : undefined);
      // force unique by renaming after create if collision — createSnapshot already unique
      if (i < MAX_SNAPSHOTS - 1) {
        // touch time by rewriting meta createdAt only — id already unique via _2 suffix loop
      }
    }
    expect(listSnapshots(tmp).length).toBe(MAX_SNAPSHOTS);
    expect(() => createSnapshot(tmp, "overflow")).toThrow(/上限/);
  });

  it("restoreSnapshot reverts project.json and screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-r-"));
    copyDir(templateRoot, tmp);
    createSnapshot(tmp, "baseline");
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "lbl_title", { props: { text: "Changed" } });
    saveProject(loaded);
    expect(openProject(tmp).screens.get("home")!.children[0]!.props.text).toBe("Changed");

    const baseline = listSnapshots(tmp).find((s) => s.label === "baseline");
    expect(baseline).toBeTruthy();
    restoreSnapshot(tmp, baseline!.id);
    expect(openProject(tmp).screens.get("home")!.children[0]!.props.text).toBe("Hello ForgeUI");
  });
});
