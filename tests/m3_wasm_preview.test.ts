import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPreviewHost } from "@forgeui/preview-host";
import { openProject } from "@forgeui/core";

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

describe("M3 wasm preview prepare-only (Loop#15)", () => {
  it("prepares wasm IR preview tree", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-wasm-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    loaded.project.previewBackend = "wasm";
    const { saveProject } = await import("@forgeui/core");
    saveProject(loaded);

    const host = createPreviewHost();
    const result = await host.run(tmp, { backend: "wasm", prepareOnly: true });
    expect(result.ok).toBe(true);
    const buildDir = result.session!.buildDir;
    expect(fs.existsSync(path.join(buildDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "preview-ir.json"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "preview-shell.js"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "hal.c"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "lv_conf.h"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "CMakeLists.txt"))).toBe(true);
    const ir = JSON.parse(fs.readFileSync(path.join(buildDir, "preview-ir.json"), "utf8"));
    expect(ir.backend).toBe("wasm-ir");
    expect(ir.screens.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(buildDir, "preview-shell.js"), "utf8")).toContain("renderScreen");
    expect(fs.readFileSync(path.join(buildDir, "index.html"), "utf8")).toContain("screen-select");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui.c"))).toBe(true);
  });
});
