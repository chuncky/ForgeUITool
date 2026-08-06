import { describe, expect, it } from "vitest";
import { alignFrameToParent, anchorPoint, reanchorFrame } from "./frame-anchor.js";

describe("frame anchor (V1-C)", () => {
  it("anchorPoint maps 3×3 cells", () => {
    expect(anchorPoint(100, 40, 0, 0)).toEqual({ px: 0, py: 0 });
    expect(anchorPoint(100, 40, 1, 1)).toEqual({ px: 50, py: 20 });
    expect(anchorPoint(100, 40, 2, 2)).toEqual({ px: 100, py: 40 });
  });

  it("reanchorFrame preserves anchor world position", () => {
    const frame = { x: 10, y: 20, w: 100, h: 40, anchorX: 0 as const, anchorY: 0 as const };
    const next = reanchorFrame(frame, 1, 1);
    expect(next.anchorX).toBe(1);
    expect(next.anchorY).toBe(1);
    expect(next.x).toBe(-40);
    expect(next.y).toBe(0);
    expect(next.x! + 50).toBe(10);
    expect(next.y! + 20).toBe(20);
  });
});

describe("alignFrameToParent (Beken 3×3 → parent)", () => {
  const frame = { x: 50, y: 30, w: 40, h: 20 };

  it("snaps to parent corners and edges", () => {
    expect(alignFrameToParent(frame, 200, 100, 0, 0)).toEqual({
      x: 0,
      y: 0,
      anchorX: 0,
      anchorY: 0,
    });
    expect(alignFrameToParent(frame, 200, 100, 2, 2)).toEqual({
      x: 160,
      y: 80,
      anchorX: 2,
      anchorY: 2,
    });
    expect(alignFrameToParent(frame, 200, 100, 1, 1)).toEqual({
      x: 80,
      y: 40,
      anchorX: 1,
      anchorY: 1,
    });
    expect(alignFrameToParent(frame, 200, 100, 1, 0)).toEqual({
      x: 80,
      y: 0,
      anchorX: 1,
      anchorY: 0,
    });
    expect(alignFrameToParent(frame, 200, 100, 0, 2)).toEqual({
      x: 0,
      y: 80,
      anchorX: 0,
      anchorY: 2,
    });
  });

  it("allows negative offset when widget larger than parent", () => {
    const big = { x: 0, y: 0, w: 300, h: 150 };
    expect(alignFrameToParent(big, 200, 100, 2, 2)).toEqual({
      x: -100,
      y: -50,
      anchorX: 2,
      anchorY: 2,
    });
  });
});
