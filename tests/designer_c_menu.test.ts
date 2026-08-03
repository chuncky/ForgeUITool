import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { createPreviewHost } from "@forgeui/preview-host";

const repoRoot = path.resolve(import.meta.dirname, "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyProject(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".forge") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyProject(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("C language menu (FR-060d)", () => {
  it("WorkspaceToolbar exposes five Beken-aligned menu items", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("全部清理");
    expect(toolbar).toContain("生成代码");
    expect(toolbar).toContain("编译");
    expect(toolbar).toContain("模拟运行");
    expect(toolbar).toContain("生成+编译+模拟运行");
    expect(toolbar).not.toContain("编译准备");
    expect(toolbar).not.toContain("previewPrep");
    const cMenuBlock = toolbar.slice(toolbar.indexOf("C语言"), toolbar.indexOf("交付"));
    expect(cMenuBlock).not.toContain("导出到 SDK");
    expect(cMenuBlock).not.toContain("打包 UI 包");
  });

  it("main IPC passes buildOnly and runOnly to PreviewHost", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("buildOnly");
    expect(main).toContain("runOnly");
  });

  it("main IPC saves project before generate and preview (except cleanOnly / runOnly)", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const genBlock = main.slice(main.indexOf('"tool:generate"'), main.indexOf('"tool:preview"'));
    const previewBlock = main.slice(main.indexOf('"tool:preview"'), main.indexOf('"tool:exportSdk"'));
    const saveBlock = main.slice(main.indexOf('"project:save"'), main.indexOf('"project:undo"'));
    expect(genBlock).toContain("saveProject(current)");
    expect(genBlock).toContain("clearProjectHistory()");
    expect(genBlock).toContain("!opts.cleanOnly");
    expect(previewBlock).toContain("saveProject(current)");
    expect(previewBlock).toContain("clearProjectHistory()");
    expect(previewBlock).toContain("!runOnly");
    expect(saveBlock).toContain("clearProjectHistory()");
  });

  it("cleanOnly removes generated code but keeps preview cache", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-clean-"));
    copyProject(templateRoot, tmp);
    await generate(tmp);
    const genFile = path.join(tmp, "forgeui_generated/ui.c");
    expect(fs.existsSync(genFile)).toBe(true);

    const outDir = path.join(tmp, ".forge/preview-build/out");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "marker.txt"), "x");

    const result = await generate(tmp, { cleanOnly: true });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(genFile)).toBe(false);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/custom/ui_events.c"))).toBe(true);
    expect(fs.existsSync(outDir)).toBe(true);
    expect(fs.existsSync(path.join(outDir, "marker.txt"))).toBe(true);
  });

  it("runOnly fails when preview exe is missing", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-runonly-"));
    copyProject(templateRoot, tmp);
    await generate(tmp);

    const host = createPreviewHost();
    const result = await host.run(tmp, { backend: "sdl", runOnly: true, skipGenerate: true });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes("请先执行「编译」"))).toBe(true);
  });

  it(
    "buildOnly runs cmake build without requiring launch",
    async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-buildonly-"));
      copyProject(templateRoot, tmp);
      await generate(tmp);

      const host = createPreviewHost();
      const result = await host.run(tmp, { backend: "sdl", buildOnly: true, skipGenerate: true });
      if (!result.ok && result.diagnostics.some((d) => d.message.includes("cmake"))) {
        return; // skip when toolchain missing in CI
      }
      expect(result.ok).toBe(true);
      expect(result.buildLogs?.some((l) => l.includes("--- cmake build ---"))).toBe(true);
      expect(result.session?.pid).toBeUndefined();
      const outDir = path.join(tmp, ".forge/preview-build/out");
      expect(findPreviewExe(outDir)).toBeTruthy();
    },
    180_000,
  );
});

function findPreviewExe(outDir: string): string | undefined {
  for (const rel of ["forgeui_preview.exe", "Release/forgeui_preview.exe", "Debug/forgeui_preview.exe", "forgeui_preview"]) {
    const p = path.join(outDir, rel);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
