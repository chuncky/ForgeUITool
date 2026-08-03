import { describe, expect, it } from "vitest";
import { EditorHistory } from "./editor-history.js";

describe("EditorHistory (FR-010 undo)", () => {
  it("restores prior snapshot on undo after add/move", () => {
    const h = new EditorHistory<{ n: number }>();
    const s0 = { data: { n: 0 }, screenId: "home", selectedId: "home" };
    const s1 = { data: { n: 1 }, screenId: "home", selectedId: "btn_1" };

    h.push(s0);
    const undone = h.popUndo(s1);
    expect(undone?.data.n).toBe(0);
    expect(h.canRedo).toBe(true);

    const redone = h.popRedo(s0);
    expect(redone?.data.n).toBe(1);
  });

  it("clears redo when a new edit is recorded", () => {
    const h = new EditorHistory<{ n: number }>();
    h.push({ data: { n: 0 }, screenId: "home", selectedId: "home" });
    h.popUndo({ data: { n: 1 }, screenId: "home", selectedId: "btn_1" });
    expect(h.canRedo).toBe(true);
    h.push({ data: { n: 2 }, screenId: "home", selectedId: "btn_2" });
    expect(h.canRedo).toBe(false);
  });
});
