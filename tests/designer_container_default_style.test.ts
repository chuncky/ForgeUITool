/**
 * Canvas ↔ sim default style parity (container/button empty style → LVGL theme_default Light).
 */
import { describe, expect, it } from "vitest";
import { getWidgetSpec, LVGL_THEME_LIGHT } from "../packages/core/src/widgets";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome";

describe("canvas default style parity with LVGL theme_default Light", () => {
  it("container registry seeds white card style", () => {
    const seed = getWidgetSpec("container")?.defaultStyle?.main?.default;
    expect(seed?.bg_color).toBe(LVGL_THEME_LIGHT.cardBg);
    expect(seed?.radius).toBe(LVGL_THEME_LIGHT.cardRadius);
  });

  it("empty-style container paints white + radius (not transparent)", () => {
    const s = buildWidgetCanvasChrome({
      type: "container",
      frame: { x: 0, y: 0, w: 100, h: 80 },
      props: {},
      style: {},
    });
    expect(String(s.background)).toMatch(/255,\s*255,\s*255|#fff/i);
    expect(s.borderRadius).toBe("8px");
    expect(String(s.background)).not.toBe("transparent");
  });

  it("empty-style button paints primary blue (not muted gray)", () => {
    const s = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "Button" },
      style: {},
    });
    expect(String(s.background)).toMatch(/33,\s*150,\s*243|#2196[fF]3/i);
    expect(s.borderRadius).toBe("8px");
  });
});
