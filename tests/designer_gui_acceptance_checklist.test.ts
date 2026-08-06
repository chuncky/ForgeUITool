import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("GUI acceptance checklist UI-01～09 (Loop#40)", () => {
  it("checklist doc exists with nine UI cases", () => {
    const md = fs.readFileSync(path.join(repoRoot, "docs/MVP_GUI_ACCEPTANCE_UI-01-08.md"), "utf8");
    for (const id of ["UI-01", "UI-02", "UI-03", "UI-04", "UI-04b", "UI-05", "UI-06", "UI-07", "UI-08", "UI-09"]) {
      expect(md).toContain(id);
    }
    expect(md).toContain("AC-001");
    expect(md).toContain("AC-010");
  });

  it("hello dual-screen template supports UI-01", () => {
    const tpl = path.join(repoRoot, "templates/hello-dual-screen");
    expect(fs.existsSync(path.join(tpl, "screens/home.json"))).toBe(true);
    expect(fs.existsSync(path.join(tpl, "screens/settings.json"))).toBe(true);
    const project = JSON.parse(fs.readFileSync(path.join(tpl, "project.json"), "utf8"));
    expect(project.screens.length).toBeGreaterThanOrEqual(2);
  });

  it("designer exposes docs + preview + events + delivery for UI-02～08", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const docs = fs.readFileSync(path.join(repoRoot, "apps/designer/src/views/DocsView.vue"), "utf8");
    const toolbar = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"), "utf8");
    const gate = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/WorkspaceGate.vue"), "utf8");
    const canvas = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(main).toContain("mvp-gui-acceptance");
    expect(docs).toContain("UI-01～09");
    expect(main).toContain("tool:preview");
    expect(main).toContain("tool:exportSdk");
    expect(main).toContain("tool:pack");
    expect(toolbar).toMatch(/simulate|模拟/);
    expect(toolbar).toMatch(/导出到 SDK|打包 UI 包/);
    expect(gate).toMatch(/尚未打开工程/);
    expect(canvas).toContain("preview.busy");
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/EventPanel.vue"))).toBe(true);
  });

  it("settings expose wasm preview backend for UI-09", () => {
    const settings = fs.readFileSync(path.join(repoRoot, "apps/designer/src/views/SettingsView.vue"), "utf8");
    const cli = fs.readFileSync(path.join(repoRoot, "apps/cli/src/cli.ts"), "utf8");
    expect(settings).toContain('value="wasm"');
    expect(cli).toContain("--backend");
  });
});
