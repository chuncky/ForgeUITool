import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("settings page V1.32 (BK-aligned)", () => {
  it("SettingsView has four nav categories", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/views/SettingsView.vue"),
      "utf8",
    );
    expect(src).toContain("通用设置");
    expect(src).toContain("工作台设置");
    expect(src).toContain("快捷键设置");
    expect(src).toContain("AI 设置");
    expect(src).toContain("settingsTab === 'general'");
    expect(src).toContain("settingsTab === 'workbench'");
    expect(src).toContain("settingsTab === 'shortcuts'");
    expect(src).toContain("SettingsAiPanel");
    expect(src).toContain("hideGrid");
    expect(src).toContain("UI_THEMES");
    expect(src).not.toContain("aiDesignEnabled");
  });

  it("settings store has theme and workbench prefs without enable switch", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/stores/settings.ts"),
      "utf8",
    );
    expect(src).toContain("uiTheme");
    expect(src).toContain("hideGrid");
    expect(src).toContain("alignSnapPx");
    expect(src).toContain("uiTheme");
    // legacy key only stripped on load, not an active setting
    expect(src).toContain("aiDesignEnabled?: boolean");
    expect(src).not.toMatch(/aiDesignEnabled:\s*(true|false)/);
  });

  it("ProjectSettingsDialog has base|export tabs and i18n toggle", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ProjectSettingsDialog.vue"),
      "utf8",
    );
    expect(src).toContain("基础设置");
    expect(src).toContain("导出 / 交付");
    expect(src).toContain("i18nEnabled");
    expect(src).toContain("platform");
  });

  it("shortcuts catalog exists", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/utils/shortcuts-catalog.ts"),
      "utf8",
    );
    expect(src).toContain("SHORTCUT_GROUPS");
    expect(src).toContain("Ctrl+S");
  });

  it("mapping doc documents auto-detect AI", () => {
    const doc = fs.readFileSync(
      path.join(repoRoot, "docs/beken界面/设置/设置-本产品映射.md"),
      "utf8",
    );
    expect(doc).toContain("自动检测");
    expect(doc).toContain("无「启用 AI」开关");
  });
});
