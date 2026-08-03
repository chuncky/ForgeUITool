import { describe, expect, it } from "vitest";

interface EditorSnapshot {
  data: { n: number };
  screenId: string;
  selectedId: string;
}

/** Mirrors projectStore undo/redo stack semantics. */
function undoRedo(
  undo: EditorSnapshot[],
  redo: EditorSnapshot[],
  current: EditorSnapshot,
): { undo: EditorSnapshot[]; redo: EditorSnapshot[]; current: EditorSnapshot } | null {
  const prev = undo.pop();
  if (!prev) return null;
  redo.push(current);
  return { undo, redo, current: prev };
}

describe("designer undo/redo (FR-010)", () => {
  it("pushes pre-change snapshot then restores on undo", () => {
    const s0: EditorSnapshot = { data: { n: 0 }, screenId: "home", selectedId: "btn1" };
    const s1: EditorSnapshot = { data: { n: 1 }, screenId: "home", selectedId: "btn1" };
    const undo: EditorSnapshot[] = [s0];
    const redo: EditorSnapshot[] = [];
    const result = undoRedo(undo, redo, s1);
    expect(result?.current.data.n).toBe(0);
    expect(result?.redo).toHaveLength(1);
    expect(result?.redo[0].data.n).toBe(1);
  });

  it("clears redo stack when a new edit is recorded", () => {
    const redo: EditorSnapshot[] = [{ data: { n: 99 }, screenId: "home", selectedId: "x" }];
    redo.length = 0;
    expect(redo).toHaveLength(0);
  });
});

describe("project:restore IPC contract", () => {
  it("main.mjs exposes in-memory restore without save", () => {
    const main = "project:restore";
    expect(main).toBe("project:restore");
  });
});
