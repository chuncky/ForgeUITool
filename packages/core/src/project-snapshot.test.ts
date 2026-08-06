import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createSnapshot,
  listSnapshots,
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
  it("creates and lists history under .forge/history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-snap-"));
    copyDir(templateRoot, tmp);
    const meta = createSnapshot(tmp, "before_edit");
    expect(meta.label).toBe("before_edit");
    expect(fs.existsSync(path.join(tmp, ".forge/history", meta.id, "project.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".forge/history", meta.id, "screens/home.json"))).toBe(true);
    const list = listSnapshots(tmp);
    expect(list.some((s) => s.id === meta.id)).toBe(true);
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
