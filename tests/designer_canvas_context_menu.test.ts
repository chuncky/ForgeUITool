import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWidgetMenuAction } from "../apps/designer/src/utils/widget-menu";

describe("FR-013c canvas widget context menu", () => {
  const root = path.resolve(import.meta.dirname, "..");

  it("WidgetView opens context menu on right-click", () => {
    const view = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    const workbench = fs.readFileSync(
      path.join(root, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    const ui = fs.readFileSync(path.join(root, "apps/designer/src/stores/ui.ts"), "utf8");
    const floating = fs.readFileSync(
      path.join(root, "apps/designer/src/components/FloatingPanelMenu.vue"),
      "utf8",
    );
    const ctx = fs.readFileSync(
      path.join(root, "apps/designer/src/components/WidgetContextMenu.vue"),
      "utf8",
    );
    const items = fs.readFileSync(
      path.join(root, "apps/designer/src/components/WidgetActionMenuItems.vue"),
      "utf8",
    );

    expect(view).toContain("@contextmenu.prevent.stop");
    expect(view).toContain("openWidgetContextMenu");
    expect(ui).toContain("openWidgetContextMenu");
    expect(ui).toContain("widgetContextMenu");
    expect(floating).toContain("point?");
    expect(workbench).toContain("WidgetContextMenu");
    expect(ctx).toContain("runWidgetMenuAction");
    expect(items).toContain("隐藏");
    expect(items).toContain("删除");
    expect(items).toContain("锁定");
  });

  it("tree and canvas share runWidgetMenuAction", async () => {
    const calls: string[] = [];
    const store = {
      select: async () => {
        calls.push("select");
      },
      isSelected: () => false,
      toggleNodeLocked: async () => {
        calls.push("lock");
      },
      toggleNodeHidden: async () => {
        calls.push("hide");
      },
      duplicateNodeById: async () => {
        calls.push("copy");
      },
      moveNodeOrderById: async (_id: string, dir: string) => {
        calls.push(`move:${dir}`);
      },
      removeNodeById: async () => {
        calls.push("delete");
      },
      alignSelection: async (mode: string) => {
        calls.push(`align:${mode}`);
      },
      saveNodeAsCustomWidget: async () => {
        calls.push("custom");
      },
    };
    const node = { id: "btn1", name: "B", type: "button", frame: { x: 0, y: 0, w: 1, h: 1 } };
    await runWidgetMenuAction(store, node as never, "delete");
    await runWidgetMenuAction(store, node as never, "hide");
    await runWidgetMenuAction(store, node as never, "align-left");
    expect(calls).toEqual(["delete", "hide", "select", "align:left"]);
  });

  it("docs declare FR-013c and Beken canvas right-click", () => {
    const req = fs.readFileSync(path.join(root, "docs/嵌入式UI工具_设计需求文档.md"), "utf8");
    const lld = fs.readFileSync(path.join(root, "docs/嵌入式UI工具_软件详细设计说明.md"), "utf8");
    expect(req).toContain("FR-013c");
    expect(req).toContain("画布控件右键");
    expect(lld).toContain("FR-013c");
    expect(lld).toContain("contextmenu");
  });
});
