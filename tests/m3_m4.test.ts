import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPreviewHost } from "@forgeui/preview-host";
import { exportToSdk } from "@forgeui/platforms";
import { generate } from "@forgeui/codegen";

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

describe("M3 preview prepare-only", () => {
  it("prepares sdl preview build tree", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-prev-"));
    copyDir(templateRoot, tmp);
    const host = createPreviewHost();
    const result = await host.run(tmp, { backend: "sdl", prepareOnly: true });
    expect(result.ok).toBe(true);
    expect(result.session?.buildDir).toBeTruthy();
    expect(fs.existsSync(path.join(result.session!.buildDir, "CMakeLists.txt"))).toBe(true);
    expect(fs.existsSync(path.join(result.session!.buildDir, "main.c"))).toBe(true);
    expect(fs.existsSync(path.join(result.session!.buildDir, "forgeui_preview_config.h"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui.c"))).toBe(true);
  });
});

describe("M4 export-sdk qm10xd", () => {
  it("copies forgeui_generated into sdk ui/", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-sdk-"));
    const projectDir = path.join(tmp, "proj");
    const sdkDir = path.join(tmp, "sdk");
    copyDir(templateRoot, projectDir);
    fs.mkdirSync(sdkDir, { recursive: true });
    await generate(projectDir);
    const result = await exportToSdk(projectDir, { sdkPath: sdkDir, force: true });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(sdkDir, "ui/forgeui_generated/ui.c"))).toBe(true);
    expect(fs.existsSync(path.join(sdkDir, "ui/forgeui_generated/custom/ui_events.c"))).toBe(true);
    expect(fs.existsSync(path.join(sdkDir, "ui/forgeui_generated/forgeui_generated.cmake"))).toBe(true);
    expect(fs.existsSync(path.join(sdkDir, "ui/FORGEUI_INTEGRATION.md"))).toBe(true);
  });

  it("prepare auto-generates after cleanOnly even when skipGenerate", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-prep-"));
    copyDir(templateRoot, tmp);
    await generate(tmp);
    await generate(tmp, { cleanOnly: true });
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/forgeui_generated.cmake"))).toBe(false);

    const host = createPreviewHost();
    const result = await host.run(tmp, { backend: "sdl", prepareOnly: true, skipGenerate: true });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/forgeui_generated.cmake"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui.c"))).toBe(true);
  });

  it("fails without sdk path", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-sdk2-"));
    copyDir(templateRoot, tmp);
    await generate(tmp);
    const result = await exportToSdk(tmp, {});
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "E_SDK_001")).toBe(true);
  });
});
