import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addChildNode, openProject, saveProject } from "../packages/core/src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer save (存档)", () => {
  it("project:save IPC saves Main current without renderer payload", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toMatch(/ipcMain\.handle\("project:save", async \(\) =>/);
    expect(main).toContain("core.saveProject(current)");
    expect(main).not.toContain('ipcMain.handle("project:save", async (_e, payload)');
    expect(preload).toMatch(/saveProject: \(\) => ipcRenderer\.invoke\("project:save"\)/);
  });

  it("saveProject persists in-memory edits to disk", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-save-"));
    const src = path.join(repoRoot, "templates/hello-dual-screen");
    fs.cpSync(src, tmp, { recursive: true });

    const loaded = openProject(tmp);
    const node = addChildNode(loaded, "home", "home", "button");
    node.props.text = "SavedBtn";

    saveProject(loaded);

    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    const saved = home.children.find((c: { id: string }) => c.id === node.id);
    expect(saved).toBeTruthy();
    expect(saved.props.text).toBe("SavedBtn");
  });
});
