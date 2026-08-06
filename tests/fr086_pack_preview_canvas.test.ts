import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addChildNode, openProject } from "@forgeui/core";
import { packProject } from "@forgeui/packer";
import { JsonRuntimeLoader, summarizePackRuntime } from "@forgeui/loader";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("FR-086 deepen pack preview canvas payload", () => {
  it("summarizePackRuntime returns screen trees with widget counts", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fr086-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    addChildNode(loaded, "home", "home", "label");
    const pack = await packProject(tmp);
    expect(pack.ok).toBe(true);

    const runtime = await new JsonRuntimeLoader().apply(pack.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    const summary = summarizePackRuntime(runtime);
    expect(summary.screenCount).toBeGreaterThan(0);
    expect(summary.widgetCount).toBeGreaterThan(0);
    expect(summary.screens[0]?.document.type).toBe("screen");
    expect(summary.screens[0]?.document.children.length).toBeGreaterThan(0);
    expect(summary.entryScreen).toBeTruthy();
  });

  it("Canvas / store wire pack overlay", () => {
    const canvas = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/Canvas.vue"), "utf8");
    const store = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/project.ts"), "utf8");
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(canvas).toContain("packPreviewScreen");
    expect(canvas).toContain("clearPackPreview");
    expect(canvas).toContain("UI 包装载预览");
    expect(store).toContain("packPreview.value");
    expect(store).toContain("clearPackPreview");
    expect(main).toContain("summarizePackRuntime");
    expect(main).toContain("screens: summary.screens");
  });
});
