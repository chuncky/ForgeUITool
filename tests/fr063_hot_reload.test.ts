import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPreviewHost, hotReloadPreviewIr } from "@forgeui/preview-host";
import { openProject, saveProject, addChildNode } from "@forgeui/core";

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

describe("FR-063 resident IR hot-reload", () => {
  it("rewrites preview-ir + stamp without full prepare", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-hot-"));
    copyDir(templateRoot, tmp);
    const host = createPreviewHost();
    const prep = await host.run(tmp, { backend: "wasm", prepareOnly: true });
    expect(prep.ok).toBe(true);
    const buildDir = prep.session!.buildDir;

    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    addChildNode(loaded, sid, sid, "label");
    saveProject(loaded);

    const hot = hotReloadPreviewIr(tmp, buildDir);
    expect(hot.ok).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "hot-reload.stamp"))).toBe(true);
    const ir = JSON.parse(fs.readFileSync(path.join(buildDir, "preview-ir.json"), "utf8"));
    expect(ir.generatedAt).toBeTruthy();
    const shell = fs.readFileSync(path.join(repoRoot, "templates/wasm-sim/preview-shell.js"), "utf8");
    expect(shell).toContain("hot-reload.stamp");

    const again = await host.hotReload!(tmp);
    expect(again.ok).toBe(true);
    expect(again.diagnostics.some((d) => d.code === "E_PREV_HOT_RELOAD")).toBe(true);
  });
});
