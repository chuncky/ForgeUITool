import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clampFrameToParent } from "../apps/designer/src/utils/frame-clamp";

describe("canvas coordinate contract (V1.32)", () => {
  it("does not force position:relative on screen widget children", () => {
    const src = readFileSync(resolve("apps/designer/src/components/Canvas.vue"), "utf8");
    expect(src).toContain("screen-clip");
    expect(src).toContain("overflow: hidden");
    expect(src).not.toMatch(/\.screen\s*>\s*:not\(\.screen-bg-img\)\s*\{[^}]*position:\s*relative/);
  });

  it("WidgetView live drag clamps to parent box", () => {
    const src = readFileSync(resolve("apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("clampFrameToParent");
    expect(src).toContain("parentContentSize");
  });

  it("clampFrameToParent keeps frame inside parent", () => {
    const out = clampFrameToParent({ x: 900, y: -20, w: 100, h: 40 }, 480, 320);
    expect(out.x).toBe(380);
    expect(out.y).toBe(0);
    expect(out.x + out.w).toBeLessThanOrEqual(480);
    expect(out.y + out.h).toBeLessThanOrEqual(320);
  });
});
