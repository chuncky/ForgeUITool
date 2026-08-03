import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("PageTreePanel (FR-011a/b, FR-013a/b)", () => {
  it("PageTreePanel replaces Outline in workbench", () => {
    const wb = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    expect(wb).toContain("PageTreePanel");
    expect(wb).not.toContain("Outline");
  });

  it("PageTreePanel uses 控件树 label and FloatingPanelMenu", () => {
    const panel = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/PageTreePanel.vue"),
      "utf8",
    );
    expect(panel).toContain("页面 [");
    expect(panel).toContain("控件树 [");
    expect(panel).not.toContain("组件树 [");
    expect(panel).toContain("FloatingPanelMenu");
    expect(panel).not.toMatch(/class="menu"/);
  });

  it("FloatingPanelMenu teleports to body with fixed position", () => {
    const menu = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/FloatingPanelMenu.vue"),
      "utf8",
    );
    expect(menu).toContain('Teleport to="body"');
    expect(menu).toContain("position: fixed");
    expect(menu).toContain("z-index: 3000");
  });

  it("ComponentTreeNode emits menu to parent instead of inline menu", () => {
    const node = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ComponentTreeNode.vue"),
      "utf8",
    );
    expect(node).toContain('emit("menu"');
    expect(node).not.toContain('class="menu"');
    expect(node).toContain("toggleNodeHidden");
  });

  it("Main IPC wires page tree mutations", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain('"project:duplicateScreen"');
    expect(main).toContain('"project:reorderScreen"');
    expect(main).toContain('"project:setDefaultScreen"');
    expect(main).toContain('"project:duplicateNode"');
    expect(main).toContain('"project:moveNodeOrder"');
    expect(main).toContain('"project:setNodeFlags"');
  });
});
