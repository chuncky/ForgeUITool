import { describe, expect, it } from "vitest";
import { EditorHistory } from "../packages/core/src/editor-history.js";
import { addChildNode, openProject, updateNodeProps } from "../packages/core/src/index.js";
import path from "node:path";

function serializeLoaded(loaded: ReturnType<typeof openProject>) {
  return {
    root: loaded.root,
    project: loaded.project,
    screens: Object.fromEntries(loaded.screens.entries()),
  };
}

function hydrateLoaded(payload: ReturnType<typeof serializeLoaded>) {
  const clone = JSON.parse(JSON.stringify(payload));
  return {
    root: clone.root,
    project: clone.project,
    screens: new Map(Object.entries(clone.screens)),
  };
}

describe("undo integration with core mutate (FR-010)", () => {
  it("undo removes added button", () => {
    const current = openProject(path.resolve("templates/hello-dual-screen"));
    const history = new EditorHistory<object>();
    const editor = { screenId: "home", selectedId: "home" };

    history.push({ data: serializeLoaded(current), ...editor });
    const node = addChildNode(current, "home", "home", "button");
    const snap1 = serializeLoaded(current);

    const undone = history.popUndo({ data: snap1, screenId: "home", selectedId: node.id });
    const restored = hydrateLoaded(undone!.data as ReturnType<typeof serializeLoaded>);
    const home = restored.screens.get("home")!;
    expect(home.children.some((c) => c.id === node.id)).toBe(false);
  });

  it("undo restores frame before move", () => {
    const current = openProject(path.resolve("templates/hello-dual-screen"));
    const history = new EditorHistory<object>();
    const node = addChildNode(current, "home", "home", "button");
    const beforeX = node.frame.x;

    history.push({ data: serializeLoaded(current), screenId: "home", selectedId: node.id });
    updateNodeProps(current, "home", node.id, { frame: { x: beforeX + 50 } });
    expect(node.frame.x).toBe(beforeX + 50);

    const undone = history.popUndo({
      data: serializeLoaded(current),
      screenId: "home",
      selectedId: node.id,
    });
    const restored = hydrateLoaded(undone!.data as ReturnType<typeof serializeLoaded>);
    const btn = restored.screens.get("home")!.children.find((c) => c.id === node.id);
    expect(btn?.frame.x).toBe(beforeX);
  });
});
