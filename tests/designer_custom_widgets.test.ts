import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer custom widgets FR-019", () => {
  it("IPC saveAsCustomWidget and addCustomWidget are wired", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"project:saveAsCustomWidget"');
    expect(main).toContain('"project:addCustomWidget"');
    expect(preload).toContain("saveAsCustomWidget");
    expect(preload).toContain("addCustomWidget");
  });

  it("WidgetLibraryPanel lists custom widgets from project store", () => {
    const lib = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/WidgetLibraryPanel.vue"), "utf8");
    expect(lib).toContain("store.customWidgets");
    expect(lib).toContain("application/x-forgeui-custom-widget");
    expect(lib).toContain("addCustomWidget");
  });

  it("PageTreePanel offers save-as-custom menu item", () => {
    const tree = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/PageTreePanel.vue"), "utf8");
    expect(tree).toContain("创建自定义控件");
    expect(tree).toContain("save-custom");
    expect(tree).toContain("saveNodeAsCustomWidget");
  });
});
