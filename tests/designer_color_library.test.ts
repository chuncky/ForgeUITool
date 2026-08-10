import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("color library FR-018 (BK colors + palette themes)", () => {
  it("ColorLibraryDialog has colors|themes tabs and four color sub-tabs", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ColorLibraryDialog.vue"),
      "utf8",
    );
    expect(src).toContain("颜色库");
    expect(src).toContain("mainTab");
    expect(src).toContain("mainTab === 'colors'");
    expect(src).toContain("mainTab === 'themes'");
    expect(src).toMatch(/^\s*颜色\s*$/m);
    expect(src).toMatch(/^\s*主题\s*$/m);
    expect(src).toContain("我的颜色库");
    expect(src).toContain("最近使用");
    expect(src).toContain("预设颜色");
    expect(src).toContain("LVGL 常用");
    expect(src).toContain("创建主题");
    expect(src).toContain("导入主题");
    expect(src).toContain("setColorThemes");
    expect(src).not.toContain("样式主题");
    expect(src).not.toContain("SaveStyleDialog");
  });

  it("exposes color-presets and recentColors", () => {
    const presets = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/utils/color-presets.ts"),
      "utf8",
    );
    expect(presets).toContain("PRESET_COLORS");
    expect(presets).toContain("LVGL_COMMON_COLORS");
    const ui = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/ui.ts"), "utf8");
    expect(ui).toContain("recentColors");
    expect(ui).toContain("pushRecentColor");
  });

  it("WorkspaceToolbar enables color library when project loaded", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("colorLibrary");
    expect(toolbar).toContain("showColorLibrary");
  });

  it("StyleGroup keeps style library separate and uses allNamedColors", () => {
    const style = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    expect(style).toContain("saveTheme");
    expect(style).toContain("applyTheme");
    expect(style).toContain("openColorsForPick");
    expect(style).toContain("allNamedColors");
  });

  it("project store exposes colorThemes and schema has colorThemes", () => {
    const store = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/stores/project.ts"),
      "utf8",
    );
    expect(store).toContain("colorLibrary");
    expect(store).toContain("colorThemes");
    expect(store).toContain("setColorThemes");
    expect(store).toContain("allNamedColors");
    const schema = fs.readFileSync(path.join(repoRoot, "schemas/project.schema.json"), "utf8");
    expect(schema).toContain('"colorThemes"');
  });

  it("StyleLibraryDialog remains independent", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/StyleLibraryDialog.vue"),
      "utf8",
    );
    expect(src).toContain("样式库");
    expect(src).toContain("applyStyleTheme");
  });
});
