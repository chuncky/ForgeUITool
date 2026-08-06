/**
 * End-to-end pipeline guardrail: validate → generate → preview prepare
 * (and cmake build when toolchain is available).
 *
 * Catches regressions like E_SCHEMA_001 where designer-persisted fields
 * break validation/codegen before anyone notices at compile time.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  addChildNode,
  createProject,
  openProject,
  saveProject,
  updateNodeProps,
  updateProjectMeta,
  validateProjectDir,
} from "@forgeui/core";
import { createPreviewHost } from "@forgeui/preview-host";

const tmpRoots: string[] = [];

afterEach(() => {
  for (const r of tmpRoots) {
    fs.rmSync(r, { recursive: true, force: true });
  }
  tmpRoots.length = 0;
});

function freshProject(name: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `forgeui-pipe-${name}-`));
  tmpRoots.push(root);
  createProject({ root, name, fromTemplate: "blank" });
  return openProject(root);
}

function findPreviewExe(outDir: string): string | undefined {
  for (const rel of [
    "forgeui_preview.exe",
    "Release/forgeui_preview.exe",
    "Debug/forgeui_preview.exe",
    "forgeui_preview",
  ]) {
    const p = path.join(outDir, rel);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

describe("pipeline: validate → generate → preview", () => {
  it("style-library project validates and generates runnable C", async () => {
    const loaded = freshProject("style");
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");

    updateProjectMeta(loaded, {
      themes: [
        {
          id: "pipe_theme",
          name: "Pipe",
          description: "pipeline guard",
          createdAt: "2026-08-05T00:00:00.000Z",
          widgetType: "button",
          part: "main",
          state: "default",
          props: { bg_color: "#c0ffeeff", radius: 4 },
        },
      ],
    });
    updateNodeProps(loaded, sid, btn.id, {
      props: { text: "PipeOk" },
      styleKeys: {
        part: "main",
        state: "default",
        props: { bg_color: "#c0ffeeff", radius: 4 },
      },
      styleRef: "pipe_theme",
    });
    saveProject(loaded);

    const validation = validateProjectDir(loaded.root);
    expect(validation.ok, validation.diagnostics.map((d) => `${d.code}:${d.message}`).join("; ")).toBe(
      true,
    );

    const gen = await generate(loaded.root);
    expect(gen.ok, (gen as { error?: string }).error ?? "generate failed").toBe(true);

    const screenC = fs.readFileSync(
      path.join(loaded.root, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("PipeOk");
    expect(screenC).toContain("0xC0FFEE");
    expect(fs.existsSync(path.join(loaded.root, "forgeui_generated/ui.c"))).toBe(true);
    expect(fs.existsSync(path.join(loaded.root, "forgeui_generated/forgeui_generated.cmake"))).toBe(
      true,
    );
  });

  it("preview prepareOnly materializes sdl build tree after generate", async () => {
    const loaded = freshProject("prep");
    const sid = loaded.project.defaultScreen;
    addChildNode(loaded, sid, sid, "label");
    saveProject(loaded);

    const host = createPreviewHost();
    const result = await host.run(loaded.root, { backend: "sdl", prepareOnly: true });
    expect(result.ok, result.diagnostics.map((d) => d.message).join("; ")).toBe(true);
    expect(result.session?.buildDir).toBeTruthy();
    expect(fs.existsSync(path.join(result.session!.buildDir, "CMakeLists.txt"))).toBe(true);
    expect(fs.existsSync(path.join(result.session!.buildDir, "main.c"))).toBe(true);
    expect(fs.existsSync(path.join(loaded.root, "forgeui_generated/ui.c"))).toBe(true);
  });

  it(
    "buildOnly compiles when cmake/LVGL toolchain is present",
    async () => {
      const loaded = freshProject("build");
      const sid = loaded.project.defaultScreen;
      const lbl = addChildNode(loaded, sid, sid, "label");
      updateNodeProps(loaded, sid, lbl.id, { props: { text: "BuildSmoke" } });
      saveProject(loaded);
      await generate(loaded.root);

      const host = createPreviewHost();
      const result = await host.run(loaded.root, {
        backend: "sdl",
        buildOnly: true,
        skipGenerate: true,
      });
      if (!result.ok) {
        const msg = result.diagnostics.map((d) => d.message).join("\n");
        // Soft-skip: CI / machines without cmake or FORGEUI_LVGL_ROOT
        if (/cmake|LVGL|FORGEUI_LVGL|not found|找不到/i.test(msg)) {
          return;
        }
        expect.fail(`unexpected build failure:\n${msg}`);
      }
      expect(result.buildLogs?.some((l) => l.includes("--- cmake build ---"))).toBe(true);
      expect(findPreviewExe(path.join(loaded.root, ".forge/preview-build/out"))).toBeTruthy();
    },
    180_000,
  );
});
