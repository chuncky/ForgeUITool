import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESIZE_HANDLE_DIRS,
  RESIZE_MIN_SIZE,
  applyResizeDelta,
  resizeHandleCursor,
} from "../apps/designer/src/utils/resize-handles";

const root = join(__dirname, "..");

describe("canvas 8-direction resize (BK)", () => {
  it("exposes eight handle directions", () => {
    expect(RESIZE_HANDLE_DIRS).toHaveLength(8);
    expect([...RESIZE_HANDLE_DIRS].sort()).toEqual(
      ["bc", "bl", "br", "ml", "mr", "tc", "tl", "tr"].sort(),
    );
  });

  it("br grows w/h without moving origin", () => {
    const next = applyResizeDelta({ x: 10, y: 20, w: 100, h: 40 }, "br", 10, 5);
    expect(next).toEqual({ x: 10, y: 20, w: 110, h: 45 });
  });

  it("tl moves origin and keeps bottom-right fixed", () => {
    const next = applyResizeDelta({ x: 50, y: 50, w: 100, h: 80 }, "tl", 20, 10);
    expect(next).toEqual({ x: 70, y: 60, w: 80, h: 70 });
  });

  it("ml changes x and w; mr only w", () => {
    const left = applyResizeDelta({ x: 40, y: 0, w: 100, h: 30 }, "ml", 25, 0);
    expect(left).toEqual({ x: 65, y: 0, w: 75, h: 30 });
    const right = applyResizeDelta({ x: 40, y: 0, w: 100, h: 30 }, "mr", 25, 0);
    expect(right).toEqual({ x: 40, y: 0, w: 125, h: 30 });
  });

  it("tc/bc change height; clamp to min size", () => {
    const up = applyResizeDelta({ x: 0, y: 40, w: 50, h: 60 }, "tc", 0, 100);
    expect(up.h).toBe(RESIZE_MIN_SIZE);
    expect(up.y).toBe(40 + 60 - RESIZE_MIN_SIZE);
    const down = applyResizeDelta({ x: 0, y: 40, w: 50, h: 60 }, "bc", 0, -100);
    expect(down.h).toBe(RESIZE_MIN_SIZE);
    expect(down.y).toBe(40);
  });

  it("cursors match BK-style axes", () => {
    expect(resizeHandleCursor("br")).toBe("nwse-resize");
    expect(resizeHandleCursor("tl")).toBe("nwse-resize");
    expect(resizeHandleCursor("tr")).toBe("nesw-resize");
    expect(resizeHandleCursor("ml")).toBe("ew-resize");
    expect(resizeHandleCursor("tc")).toBe("ns-resize");
  });

  it("WidgetView wires eight handles", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("RESIZE_HANDLE_DIRS");
    expect(src).toContain("applyResizeDelta");
    expect(src).toContain("handle-tl");
    expect(src).toContain("handle-br");
    expect(src).toContain("v-for=\"dir in resizeHandleDirs\"");
    expect(src).toContain("widget-body");
    expect(src).toContain("selection-border");
  });
});
