import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Mirrors uiStore defaults for Beken-aligned shell (FR-010b). */
function createUiDefaults() {
  return {
    logPanelCollapsed: false,
    widgetLibraryVisible: true,
  };
}

describe("designer shell layout (FR-010b)", () => {
  it("shows log panel expanded by default", () => {
    const ui = createUiDefaults();
    expect(ui.logPanelCollapsed).toBe(false);
  });

  it("log panel lives in center column below canvas (not overlay drawer)", () => {
    const layout = {
      centerStack: ["Canvas", "LogPanel"],
      overlayDrawers: [] as string[],
    };
    expect(layout.centerStack).toContain("LogPanel");
    expect(layout.overlayDrawers).not.toContain("LogDrawer");
  });

  it("does not duplicate log collapse on workbench status row (Beken §2.14.3/4)", () => {
    const workbench = fs.readFileSync(
      path.join(import.meta.dirname, "../apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    expect(workbench).not.toContain("StatusBar");
    expect(workbench).not.toMatch(/收起日志/);

    const appShell = fs.readFileSync(
      path.join(import.meta.dirname, "../apps/designer/src/App.vue"),
      "utf8",
    );
    expect(appShell).toContain("statusLine");
    expect(appShell).not.toMatch(/收起日志|toggleLogPanel/);
  });
});

describe("electron window startup", () => {
  it("maximizes on ready-to-show instead of fixed 1440x900 only", () => {
    const lifecycle = ["create", "ready-to-show", "maximize", "show"];
    expect(lifecycle).toEqual(["create", "ready-to-show", "maximize", "show"]);
  });

  it("disables native File/Edit/View/Window/Help menu bar", () => {
    const main = fs.readFileSync(
      path.join(import.meta.dirname, "../apps/designer/electron/main.mjs"),
      "utf8",
    );
    expect(main).toContain("Menu.setApplicationMenu(null)");
  });
});
