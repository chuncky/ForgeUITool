import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer workbench files (FR-010b)", () => {
  it("uses embedded LogPanel instead of overlay LogDrawer", () => {
    const workbench = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    expect(workbench).toContain("LogPanel");
    expect(workbench).not.toContain("LogDrawer");
    expect(workbench).toContain("InspectorPanel");
    expect(workbench).not.toMatch(/<PropPanel\s*\/>/);
    expect(workbench).not.toMatch(/<EventPanel\s*\/>/);
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/LogPanel.vue"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/LogDrawer.vue"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/InspectorPanel.vue"))).toBe(true);
  });

  it("InspectorPanel uses Beken-style props/events tabs (uiStore.rightTab)", () => {
    const inspector = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/InspectorPanel.vue"),
      "utf8",
    );
    const uiStore = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/ui.ts"), "utf8");
    expect(inspector).toContain("ui.rightTab === 'props'");
    expect(inspector).toContain("ui.rightTab === 'events'");
    expect(inspector).toContain("PropPanel");
    expect(inspector).toContain("EventPanel");
    expect(uiStore).toContain('ref<"props" | "events">("props")');
  });

  it("main process maximizes window on startup", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("win.maximize()");
    expect(main).toContain("ready-to-show");
  });

  it("code editor covers workbench fullscreen (Beken 工作区10)", () => {
    const editor = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/CodeEditorDrawer.vue"),
      "utf8",
    );
    expect(editor).toContain("Teleport");
    expect(editor).not.toMatch(/min\(960px/);
    expect(editor).toMatch(/top:\s*48px/);
  });

  it("uses single forgeui_generated codegen root (D-07)", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("resolveCodegenPaths");
    expect(main).not.toMatch(/walkCodeFiles\(path\.join\(root, "user"\)/);
    const cmake = fs.readFileSync(path.join(repoRoot, "templates/sdl-sim/CMakeLists.txt"), "utf8");
    expect(cmake).toContain("forgeui_generated.cmake");
  });
});
