/**
 * Canvas ↔ sim default style parity for all palette widgets.
 */
import { describe, expect, it } from "vitest";
import {
  getWidgetSpec,
  listPaletteWidgetSpecs,
  LVGL_THEME_LIGHT,
  createProject,
  openProject,
  addChildNode,
} from "@forgeui/core";
import fs from "node:fs";
import os from "node:os";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome";

/** Widgets whose theme_default main fill is opaque (not transparent). */
const OPAQUE_MAIN = new Set([
  "container",
  "button",
  "imagebutton",
  "dropdown",
  "textarea",
  "list",
  "roller",
  "tabview",
  "keyboard",
  "msgbox",
  "spinbox",
  "qrcode",
  "barcode",
  "tileview",
  "win",
  "menu",
  "table",
  "buttonmatrix",
  "calendar",
  "linechart",
  "barchart",
  "scatterchart",
  "chart",
  "slider",
  "bar",
  "switch",
  "led",
]);

describe("all widgets defaultStyle ↔ canvas parity", () => {
  it("every palette widget declares defaultStyle.main.default", () => {
    const missing = listPaletteWidgetSpecs()
      .filter((w) => w.type !== "screen")
      .filter((w) => !w.defaultStyle?.main?.default)
      .map((w) => w.type);
    expect(missing).toEqual([]);
  });

  it("addChildNode seeds defaultStyle for opaque-theme widgets", () => {
    const root = fs.mkdtempSync(pathJoin());
    try {
      createProject({ root, name: "seed-all", platform: "qm10xd" });
      const loaded = openProject(root);
      const sid = loaded.project.defaultScreen;
      for (const type of ["textarea", "list", "slider", "switch", "tabview", "table"]) {
        const node = addChildNode(loaded, sid, sid, type);
        expect(node.style?.main?.default, type).toBeTruthy();
        expect(node.style.main!.default!.bg_color, type).toBeTruthy();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("empty-style canvas is non-transparent for opaque-theme widgets", () => {
    for (const type of OPAQUE_MAIN) {
      const s = buildWidgetCanvasChrome({
        type,
        frame: { x: 0, y: 0, w: 120, h: 40 },
        props: {},
        style: {},
      });
      expect(String(s.background), type).not.toBe("transparent");
      expect(String(s.background), type).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/);
    }
  });

  it("card-like widgets fall back to white", () => {
    for (const type of ["container", "textarea", "dropdown", "list", "table"]) {
      const s = buildWidgetCanvasChrome({
        type,
        frame: { x: 0, y: 0, w: 100, h: 60 },
        props: {},
        style: {},
      });
      expect(String(s.background), type).toMatch(/255,\s*255,\s*255|#fff/i);
      expect(s.borderRadius, type).toBe(`${LVGL_THEME_LIGHT.cardRadius}px`);
    }
  });

  it("registry card seed matches LVGL_THEME_LIGHT", () => {
    const seed = getWidgetSpec("textarea")!.defaultStyle!.main!.default!;
    expect(seed.bg_color).toBe(LVGL_THEME_LIGHT.cardBg);
  });
});

function pathJoin() {
  return fs.mkdtempSync(`${os.tmpdir()}/forgeui-seed-`);
}
