import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { openProject, saveProject, updateNodeProps } from "@forgeui/core";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** Mirrors apps/designer/electron/main.mjs tool:generate (save before codegen). */
async function mainGenerate(root: string, current: ReturnType<typeof openProject>) {
  saveProject(current);
  return generate(root);
}

describe("generate auto-save (canvas vs simulation)", () => {
  it("codegen reads disk; unsaved edits are ignored without saveProject", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-gen-nosave-"));
    fs.cpSync(path.join(repoRoot, "templates/hello-dual-screen"), tmp, { recursive: true });

    const current = openProject(tmp);
    const home = current.screens.get("home")!;
    const label = home.children.find((c) => c.type === "label") ?? home.children[0];
    updateNodeProps(current, "home", label.id, { props: { text: "UnsavedCanvasText" } });

    await generate(tmp);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).not.toContain("UnsavedCanvasText");
  });

  it("saveProject before generate aligns generated C with canvas edits", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-gen-save-"));
    fs.cpSync(path.join(repoRoot, "templates/hello-dual-screen"), tmp, { recursive: true });

    const current = openProject(tmp);
    const home = current.screens.get("home")!;
    const label = home.children.find((c) => c.type === "label") ?? home.children[0];
    updateNodeProps(current, "home", label.id, { props: { text: "SavedCanvasText" } });

    const result = await mainGenerate(tmp, current);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("SavedCanvasText");
  });
});
