import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE_OPACITY,
  opacityToCss01,
  wrapOpacity255,
} from "@forgeui/core/opacity";
import {
  getWidgetSpec,
  STYLE_SEED_BTN_PRIMARY,
  STYLE_SEED_LABEL,
  STYLE_SEED_LINE,
  STYLE_SEED_TRANSPARENT,
} from "@forgeui/core/widgets";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome.js";

describe("LVGL opacity 0–255 (BK parity)", () => {
  it("wrapOpacity255 cycles 0↔255", () => {
    expect(wrapOpacity255(255)).toBe(255);
    expect(wrapOpacity255(256)).toBe(0);
    expect(wrapOpacity255(-1)).toBe(255);
    expect(wrapOpacity255(0)).toBe(0);
    expect(wrapOpacity255(128.4)).toBe(128);
    expect(wrapOpacity255("")).toBe(DEFAULT_STYLE_OPACITY);
  });

  it("opacityToCss01 maps LVGL opa only (no 0–1 dual scale)", () => {
    expect(opacityToCss01(255)).toBe(1);
    expect(opacityToCss01(128)).toBeCloseTo(128 / 255, 5);
    expect(opacityToCss01(1)).toBeCloseTo(1 / 255, 5);
    expect(opacityToCss01(0)).toBe(0);
    expect(opacityToCss01(undefined)).toBeUndefined();
  });

  it("widget seeds default opacities to 255", () => {
    expect(STYLE_SEED_BTN_PRIMARY.main?.default).toMatchObject({
      bg_opacity: 255,
      bg_img_opacity: 255,
      text_opacity: 255,
      border_opacity: 255,
      shadow_opacity: 255,
      outline_opacity: 255,
    });
    expect(STYLE_SEED_LABEL.main?.default?.bg_opacity).toBe(0);
    expect(STYLE_SEED_LABEL.main?.default?.bg_color).toBe("#ffffff00");
    expect(STYLE_SEED_LINE.main?.default?.line_opacity).toBe(255);
    expect(STYLE_SEED_TRANSPARENT.main?.default?.img_opa).toBe(255);

    for (const type of ["button", "label", "container", "image", "line"]) {
      const spec = getWidgetSpec(type);
      expect(spec, type).toBeTruthy();
      const def = spec!.defaultStyle?.main?.default;
      expect(def, type).toMatchObject({
        text_opacity: 255,
        bg_img_opacity: 255,
      });
      if (type === "label") {
        expect(def!.bg_opacity, type).toBe(0);
      } else {
        expect(def!.bg_opacity, type).toBe(255);
      }
    }
  });

  it("canvas chrome treats 1 as nearly transparent, 128 as half", () => {
    const chrome = (opa: number) =>
      buildWidgetCanvasChrome({
        type: "button",
        frame: { x: 0, y: 0, w: 80, h: 32 },
        props: { text: "A" },
        style: {
          main: {
            default: {
              bg_color: "#ff0000",
              bg_opacity: opa,
              text_color: "#ffffff",
              text_opacity: opa,
            },
          },
        },
      });

    expect(String(chrome(128).background)).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.50/);
    expect(String(chrome(1).background)).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.00/);
    expect(String(chrome(255).background)).toMatch(/#ff0000|#f00|rgb\(255,\s*0,\s*0\)/i);
  });

  it("canvas chrome sets --forge-bg-img-opa from bg_img_opacity", () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const chrome = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 80, h: 32 },
      props: { text: "A" },
      style: {
        main: {
          default: {
            bg_color: "#ff0000ff",
            bg_image: tinyPng,
            bg_img_opacity: 128,
          },
        },
      },
      resolvedBgImage: tinyPng,
    });
    expect(chrome["--forge-bg-img-opa"]).toBeCloseTo(128 / 255, 5);
    expect(String(chrome.backgroundImage)).toMatch(/^url\("data:image/);
    expect(chrome.backgroundColor).toBeTruthy();
  });
});

describe("BK opacity panel helpers", () => {
  it("color AA helpers keep RGB when changing alpha / swatch", async () => {
    const { getColorAlpha255, setColorAlpha255, withRgbKeepAlpha } = await import(
      "../apps/designer/src/utils/color.js"
    );
    expect(getColorAlpha255("#11223380")).toBe(0x80);
    expect(setColorAlpha255("#112233ff", 64)).toBe("#11223340");
    expect(withRgbKeepAlpha("#aabbcc80", "#112233")).toBe("#11223380");
  });

  it("hides *_opacity and shows bg_img_opacity only with image", async () => {
    const { STYLE_SUBGROUPS, isStyleFieldPanelVisible } = await import(
      "../apps/designer/src/utils/style-fields.js"
    );
    const bg = STYLE_SUBGROUPS.find((g) => g.id === "background")!;
    const opa = bg.fields.find((f) => f.key === "bg_opacity")!;
    const imgOpa = bg.fields.find((f) => f.key === "bg_img_opacity")!;
    expect(isStyleFieldPanelVisible(opa)).toBe(false);
    expect(isStyleFieldPanelVisible(imgOpa, { hasBgImage: false })).toBe(false);
    expect(isStyleFieldPanelVisible(imgOpa, { hasBgImage: true })).toBe(true);
  });

  it("codegen emits lv_obj_set_style_bg_image_opa for bg_img_opacity", async () => {
    const { STYLE_EMITTERS } = await import("../packages/codegen/src/style-emit.js");
    const line = STYLE_EMITTERS.bg_img_opacity!("obj", "LV_PART_MAIN", 200);
    expect(line).toContain("lv_obj_set_style_bg_image_opa(obj, 200, LV_PART_MAIN)");
  });

  it("StyleGroup wrap/opa number inputs omit min so spinner can emit -1 for wrap", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "..");
    const styleGroup = readFileSync(join(root, "apps/designer/src/components/prop-panel/StyleGroup.vue"), "utf8");
    expect(styleGroup).toMatch(/isWrapNumber\(sf\)\s*\?\s*undefined\s*:\s*\(sf\.min/);
    expect(styleGroup).toMatch(/function isWrapNumber/);
    // Color AA spinner must not clamp at 0 (no min="0")
    expect(styleGroup).toMatch(/class="alpha-field"/);
    const alphaBlock = styleGroup.slice(styleGroup.indexOf('class="alpha-field"'), styleGroup.indexOf('class="alpha-field"') + 450);
    expect(alphaBlock).not.toMatch(/\bmin\s*=\s*["']0["']/);
    expect(alphaBlock).not.toMatch(/:min=/);

    const dynamic = readFileSync(join(root, "apps/designer/src/components/prop-panel/DynamicPropForm.vue"), "utf8");
    const numInput = dynamic.match(/spec\.type === ['"]number['"][\s\S]{0,280}?\/>/);
    expect(numInput?.[0]).toBeTruthy();
    expect(numInput![0]).not.toMatch(/\bmin\s*=/);
  });
});
