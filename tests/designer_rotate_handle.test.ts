import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildWidgetCanvasChrome,
  splitCanvasChrome,
} from "../apps/designer/src/utils/canvas-chrome";
import {
  angleDegFromCenter,
  applyRotationDrag,
  normalizeRotationDeg,
} from "../apps/designer/src/utils/rotate-handle";

const root = join(__dirname, "..");

describe("canvas rotate handle (BK)", () => {
  it("normalizes degrees to [0, 360)", () => {
    expect(normalizeRotationDeg(0)).toBe(0);
    expect(normalizeRotationDeg(370)).toBe(10);
    expect(normalizeRotationDeg(-10)).toBe(350);
    expect(normalizeRotationDeg(359.6)).toBe(0);
  });

  it("angleDegFromCenter uses screen Y-down (clockwise from east)", () => {
    expect(angleDegFromCenter(0, 0, 10, 0)).toBeCloseTo(0, 5);
    expect(angleDegFromCenter(0, 0, 0, 10)).toBeCloseTo(90, 5);
    expect(angleDegFromCenter(0, 0, -10, 0)).toBeCloseTo(180, 5);
    expect(angleDegFromCenter(0, 0, 0, -10)).toBeCloseTo(-90, 5);
  });

  it("applyRotationDrag adds pointer delta about center", () => {
    expect(applyRotationDrag(0, -90, 0)).toBe(90);
    expect(applyRotationDrag(45, 10, 40)).toBe(75);
  });

  it("splitCanvasChrome keeps overflow on body, geometry on shell", () => {
    const chrome = buildWidgetCanvasChrome({
      type: "label",
      frame: { x: 10, y: 20, w: 100, h: 40 },
      props: { long_mode: "WRAP", text: "hi" },
      style: {},
    });
    expect(chrome.overflow).toBe("hidden");
    const { shell, body } = splitCanvasChrome(chrome);
    expect(shell.left).toBe("10px");
    expect(shell.width).toBe("100px");
    expect(shell.overflow).toBeUndefined();
    expect(body.overflow).toBe("hidden");
    expect(body.width).toBe("100%");
  });

  it("WidgetView wires shell/body, rotate handle with arrow icon, solid squares", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("widget-body");
    expect(src).toContain("splitCanvasChrome");
    expect(src).toContain("selection-border");
    expect(src).toContain("onRotateStart");
    expect(src).toContain("handle-rotate");
    expect(src).toContain("rotate-stem");
    expect(src).toContain("rotate-handle-icon");
    expect(src).toMatch(/<svg[\s\S]*rotate-handle-icon|rotate-handle-icon[\s\S]*<svg/);
    expect(src).toMatch(/\.widget\.on\s*\{[^}]*z-index:\s*200/s);
    expect(src).toMatch(/overflow:\s*visible/);
    expect(src).toMatch(/\.handle\s*\{[^}]*border:\s*none/s);
    expect(src).not.toMatch(/\.handle\s*\{[^}]*border:\s*2px\s+solid\s+#fff/s);
  });

  it("Canvas screen allows selection chrome outside device frame", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(src).toMatch(/\.screen\s*\{[^}]*overflow:\s*visible/s);
    expect(src).toMatch(/\.stage\s*\{[^}]*overflow:\s*hidden/s);
  });
});
