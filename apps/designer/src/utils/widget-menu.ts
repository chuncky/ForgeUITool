import type { UiNode } from "../env";

export type WidgetMenuAction =
  | "lock"
  | "hide"
  | "copy"
  | "up"
  | "down"
  | "top"
  | "bottom"
  | "align-left"
  | "align-center-h"
  | "align-right"
  | "align-top"
  | "align-center-v"
  | "align-bottom"
  | "save-custom"
  | "delete";

/** Shared FR-013b/c widget menu actions (tree ⋯ and canvas context menu). */
export async function runWidgetMenuAction(
  store: {
    select: (id: string, opts?: { additive?: boolean }) => void | Promise<void>;
    isSelected: (id: string) => boolean;
    toggleNodeLocked: (id: string) => Promise<void>;
    toggleNodeHidden: (id: string) => Promise<void>;
    duplicateNodeById: (id: string) => Promise<void>;
    moveNodeOrderById: (id: string, dir: "up" | "down" | "top" | "bottom") => Promise<void>;
    removeNodeById: (id: string) => Promise<void>;
    alignSelection: (mode: string) => Promise<void>;
    saveNodeAsCustomWidget: (id: string, name: string) => Promise<void>;
  },
  node: UiNode,
  action: WidgetMenuAction | string,
): Promise<void> {
  const id = node.id;
  if (action === "lock") await store.toggleNodeLocked(id);
  else if (action === "hide") await store.toggleNodeHidden(id);
  else if (action === "copy") await store.duplicateNodeById(id);
  else if (action === "up") await store.moveNodeOrderById(id, "up");
  else if (action === "down") await store.moveNodeOrderById(id, "down");
  else if (action === "top") await store.moveNodeOrderById(id, "top");
  else if (action === "bottom") await store.moveNodeOrderById(id, "bottom");
  else if (action === "delete") await store.removeNodeById(id);
  else if (action.startsWith("align-")) {
    if (!store.isSelected(id)) await store.select(id);
    await store.alignSelection(action.slice("align-".length));
  } else if (action === "save-custom") {
    const name = window.prompt("自定义控件名称", node.name);
    if (name === null) return;
    await store.saveNodeAsCustomWidget(id, name);
  }
}
