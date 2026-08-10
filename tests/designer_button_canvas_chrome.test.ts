/**
 * FR-016e：按钮属性变更必须在画布预览上可观测。
 * 覆盖按钮 PropSpec + Behavior + StyleGroup 中每个画布可见字段。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getWidgetSpec } from "../packages/core/src/widgets";
import {
  BUTTON_CANVAS_PROP_KEYS,
  BUTTON_CANVAS_STYLE_KEYS,
  bodyStyleWithoutBgImage,
  buildFillBackground,
  buildWidgetCanvasChrome,
  forgeColorToCss,
  withAlpha,
  type CanvasChromeStyle,
} from "../apps/designer/src/utils/canvas-chrome";
import { styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";

const root = join(__dirname, "..");

/** Match StylePanel storage: parts.main.<state>.<key> */
function styleOf(defaults: Record<string, unknown>, stateOverlay?: Record<string, Record<string, unknown>>) {
  return {
    main: {
      default: defaults,
      ...(stateOverlay ?? {}),
    },
  };
}

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function baseButton(
  defaults: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
  stateOverlay?: Record<string, Record<string, unknown>>,
  resolved?: { resolvedBgImage?: string | null; resolvedFontFamily?: string | null },
) {
  return buildWidgetCanvasChrome({
    type: "button",
    frame: { x: 10, y: 20, w: 120, h: 40 },
    props: { text: "OK", ...props },
    style: styleOf(defaults, stateOverlay),
    ...resolved,
  });
}

function fingerprint(s: CanvasChromeStyle): string {
  return JSON.stringify(s);
}

describe("FR-016e button canvas chrome — prop visibility", () => {
  it("button registry exposes text prop and full style subgroups used by property panel", () => {
    const def = getWidgetSpec("button");
    expect(def?.props.some((p) => p.name === "text")).toBe(true);
    const groups = styleSubgroupsForWidget("button").map((g) => g.id);
    expect(groups).toEqual(
      expect.arrayContaining(["background", "font", "space", "border", "shadow", "padding", "outline"]),
    );
    expect(BUTTON_CANVAS_STYLE_KEYS).toEqual(
      styleSubgroupsForWidget("button").flatMap((g) => g.fields.map((f) => f.key)),
    );
  });

  it("WidgetView paints button text and wires buildWidgetCanvasChrome", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toMatch(/node\.type === ['"]button['"]/);
    expect(src).toMatch(/displayText/);
    expect(src).toMatch(/buildWidgetCanvasChrome/);
    expect(src).toMatch(/preview_state|animPreview/);
  });

  it("frame geometry always maps to left/top/width/height", () => {
    const s = baseButton();
    expect(s.left).toBe("10px");
    expect(s.top).toBe("20px");
    expect(s.width).toBe("120px");
    expect(s.height).toBe("40px");
  });

  it("props.text / preview_state / lvgl_flags are canvas-visible (BUTTON_CANVAS_PROP_KEYS)", () => {
    expect([...BUTTON_CANVAS_PROP_KEYS]).toEqual(["text", "preview_state", "lvgl_flags"]);

    // text: WidgetView template contract (already asserted above) + chrome does not hide it
    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("displayText");

    const pressed = baseButton({}, { preview_state: "pressed" });
    const focused = baseButton({}, { preview_state: "focused" });
    const disabled = baseButton({}, { preview_state: "disabled" });
    const checked = baseButton({}, { preview_state: "checked" });
    expect(pressed.filter).toMatch(/brightness/);
    expect(pressed.outline).toMatch(/solid/);
    expect(focused.outline).toMatch(/#60a5fa/);
    expect(disabled.filter).toMatch(/grayscale/);
    expect(Number(disabled.opacity)).toBeLessThan(1);
    expect(checked.outline).toMatch(/#34d399/);

    const clickable = baseButton({}, { lvgl_flags: ["CLICKABLE"] });
    const frozen = baseButton({}, { lvgl_flags: [] });
    expect(clickable.cursor).toBe("pointer");
    expect(frozen.cursor).toBe("not-allowed");
  });

  it("each BUTTON_CANVAS_STYLE_KEYS entry produces a distinguishable canvas effect", () => {
    const baseline = fingerprint(baseButton({}));

    type Case = {
      key: string;
      value: unknown;
      assert: (s: CanvasChromeStyle) => void;
      /** Extra defaults needed so this key can paint (e.g. border needs width). */
      extras?: Record<string, unknown>;
    };

    const cases: Case[] = [
      {
        key: "bg_color",
        value: "#ff0000",
        assert: (s) => expect(String(s.background)).toMatch(/#ff0000|rgb\(255,\s*0,\s*0\)/i),
      },
      {
        key: "bg_grad_color",
        value: "#00ff00",
        extras: { bg_color: "#ff0000", bg_grad_dir: "ver" },
        assert: (s) => {
          expect(String(s.background)).toMatch(/linear-gradient/);
          expect(String(s.background)).toMatch(/#00ff00|rgb\(0,\s*255,\s*0\)/i);
        },
      },
      {
        key: "bg_grad_dir",
        value: "hor",
        extras: { bg_color: "#111111", bg_grad_color: "#eeeeee" },
        assert: (s) => {
          const ver = baseButton({ bg_color: "#111111", bg_grad_color: "#eeeeee", bg_grad_dir: "ver" });
          expect(s.background).not.toBe(ver.background);
          expect(String(s.background)).toMatch(/to right/);
        },
      },
      {
        key: "bg_opacity",
        value: 128,
        extras: { bg_color: "#ffffff" },
        assert: (s) => expect(String(s.background)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/),
      },
      {
        key: "bg_image",
        value: "assets/images/btn_bg.png",
        assert: (s) => {
          // Must be loadable data URL — raw path alone is NOT enough (FR-016e-a/c)
          expect(String(s.backgroundImage)).toMatch(/^url\("data:image\/png;base64,/);
        },
      },
      {
        key: "bg_img_opacity",
        value: 128,
        extras: { bg_image: "assets/images/btn_bg.png" },
        assert: (s) => expect(s["--forge-bg-img-opa"]).toBeCloseTo(128 / 255, 5),
      },
      {
        key: "radius",
        value: 12,
        assert: (s) => expect(s.borderRadius).toBe("12px"),
      },
      {
        key: "clip_corner",
        value: 1,
        assert: (s) => expect(s.overflow).toBe("hidden"),
      },
      {
        key: "text_color",
        value: "#00aaff",
        assert: (s) => expect(String(s.color)).toMatch(/#00aaff|rgb\(0,\s*170,\s*255\)/i),
      },
      {
        key: "text_opacity",
        value: 128,
        extras: { text_color: "#ffffff" },
        assert: (s) => expect(String(s.color)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/),
      },
      {
        key: "text_letter_space",
        value: 3,
        assert: (s) => expect(s.letterSpacing).toBe("3px"),
      },
      {
        key: "text_line_space",
        value: 6,
        // Default font 16 → LVGL montserrat line_height 18 + 6 = 24
        assert: (s) => expect(s.lineHeight).toBe("24px"),
      },
      {
        key: "text_align",
        value: "right",
        assert: (s) => {
          expect(s.textAlign).toBe("right");
          expect(s.justifyContent).toBe("flex-end");
        },
      },
      {
        key: "text_font",
        value: "@montserrat",
        assert: (s) => expect(s.fontFamily).toBe("forgeui-font-montserrat"),
      },
      {
        key: "text_font_size",
        value: 24,
        assert: (s) => expect(s.fontSize).toBe("24px"),
      },
      {
        key: "text_decor",
        value: "underline",
        assert: (s) => expect(s.textDecoration).toBe("underline"),
      },
      {
        key: "border_width",
        value: 4,
        extras: { border_color: "#112233" },
        assert: (s) => expect(String(s.border)).toMatch(/^4px solid/),
      },
      {
        key: "border_color",
        value: "#112233",
        extras: { border_width: 2 },
        assert: (s) => expect(String(s.border)).toMatch(/#112233|rgb\(17,\s*34,\s*51\)/i),
      },
      {
        key: "border_opacity",
        value: 128,
        extras: { border_width: 2, border_color: "#ffffff" },
        assert: (s) => expect(String(s.border)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/),
      },
      {
        key: "shadow_width",
        value: 10,
        extras: { shadow_color: "#000000" },
        assert: (s) => expect(String(s.boxShadow)).toContain("10px"),
      },
      {
        key: "shadow_color",
        value: "#0000ff",
        extras: { shadow_width: 8 },
        assert: (s) => expect(String(s.boxShadow)).toMatch(/#0000ff|rgba?\(0,\s*0,\s*255/i),
      },
      {
        key: "shadow_opacity",
        value: 128,
        extras: { shadow_width: 4, shadow_color: "#000000" },
        assert: (s) => expect(String(s.boxShadow)).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.5/),
      },
      {
        key: "shadow_ofs_x",
        value: 5,
        extras: { shadow_width: 4 },
        assert: (s) => expect(String(s.boxShadow)).toMatch(/^5px/),
      },
      {
        key: "shadow_ofs_y",
        value: 7,
        extras: { shadow_width: 4 },
        assert: (s) => expect(String(s.boxShadow)).toMatch(/^\d+px 7px/),
      },
      {
        key: "pad_top",
        value: 8,
        assert: (s) => expect(String(s.padding)).toMatch(/^8px /),
      },
      {
        key: "pad_right",
        value: 6,
        assert: (s) => expect(String(s.padding)?.split(/\s+/)).toEqual(expect.arrayContaining(["6px"])),
      },
      {
        key: "pad_bottom",
        value: 5,
        assert: (s) => expect(String(s.padding)).toContain("5px"),
      },
      {
        key: "pad_left",
        value: 3,
        assert: (s) => expect(String(s.padding)).toMatch(/3px$/),
      },
      {
        key: "outline_width",
        value: 3,
        extras: { outline_color: "#abcdef" },
        assert: (s) => expect(String(s.outline)).toMatch(/^3px solid/),
      },
      {
        key: "outline_color",
        value: "#abcdef",
        extras: { outline_width: 2 },
        assert: (s) => expect(String(s.outline)).toMatch(/#abcdef|rgb\(171,\s*205,\s*239\)/i),
      },
      {
        key: "outline_opacity",
        value: 128,
        extras: { outline_width: 2, outline_color: "#ffffff" },
        assert: (s) => expect(String(s.outline)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/),
      },
    ];

    const covered = new Set(cases.map((c) => c.key));
    for (const key of BUTTON_CANVAS_STYLE_KEYS) {
      expect(covered.has(key), `missing test case for style key: ${key}`).toBe(true);
    }
    expect(cases.length).toBe(BUTTON_CANVAS_STYLE_KEYS.length);

    for (const c of cases) {
      const resolved =
        c.key === "bg_image" || c.key === "bg_img_opacity"
          ? { resolvedBgImage: SAMPLE_PNG_DATA_URL }
          : c.key === "text_font"
            ? { resolvedFontFamily: "forgeui-font-montserrat" }
            : undefined;
      const styled = baseButton({ ...(c.extras ?? {}), [c.key]: c.value }, {}, undefined, resolved);
      // clip_corner only sets overflow:hidden; button long_mode already does — fingerprint may match.
      if (c.key !== "clip_corner") {
        expect(fingerprint(styled), `key ${c.key} should differ from baseline`).not.toBe(baseline);
      }
      c.assert(styled);
    }
  });

  it("preview_state overlays style parts onto canvas chrome", () => {
    const s = baseButton(
      { bg_color: "#111111", text_color: "#eeeeee" },
      { preview_state: "pressed" },
      { pressed: { bg_color: "#ff0000" } },
    );
    expect(String(s.background)).toMatch(/#ff0000|rgb\(255,\s*0,\s*0\)/i);
    expect(String(s.color)).toMatch(/#eeeeee|rgb\(238,\s*238,\s*238\)/i);
  });

  it("withAlpha / forgeColorToCss support LVGL opacity mapping", () => {
    expect(forgeColorToCss("#ffffff")).toBe("#ffffff");
    expect(forgeColorToCss("#00000080")).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.502\)/);
    expect(withAlpha("#ffffff", 0.5)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/);
  });

  it("anim preview remaps frame and opacity on canvas", () => {
    const s = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 80, h: 32 },
      props: { text: "A" },
      style: styleOf({}),
      animPreview: { x: 5, y: -3, opacity: 40, rotation: 15 },
    });
    expect(s.left).toBe("5px");
    expect(s.top).toBe("-3px");
    expect(s.transform).toContain("rotate(15deg)");
    expect(s.opacity).toBeCloseTo(40 / 255, 5);
  });

  it("buildFillBackground emits hor/ver linear-gradient for screen/widget fill", () => {
    const hor = buildFillBackground(
      { bg_color: "#ff0000", bg_grad_color: "#0000ff", bg_grad_dir: "hor" },
      { colorFallback: "var(--screen)" },
    );
    expect(hor.isGradient).toBe(true);
    expect(hor.fill).toMatch(/linear-gradient\(to right/);
    expect(hor.fill).toMatch(/#ff0000|#f00|rgb\(255,\s*0,\s*0\)/i);
    expect(hor.fill).toMatch(/#0000ff|#00f|rgb\(0,\s*0,\s*255\)/i);

    const ver = buildFillBackground(
      { bg_color: "#111111", bg_grad_color: "#eeeeee", bg_grad_dir: "ver" },
      { colorFallback: "var(--screen)" },
    );
    expect(ver.isGradient).toBe(true);
    expect(ver.fill).toMatch(/linear-gradient\(to bottom/);

    const solid = buildFillBackground({ bg_color: "#abcdef" }, { colorFallback: "var(--screen)" });
    expect(solid.isGradient).toBe(false);
    expect(solid.fill).toMatch(/#abcdef/i);
  });

  it("gradient fill survives alongside bg image; bodyStyleWithoutBgImage strips url keys", () => {
    const styled = baseButton(
      {
        bg_color: "#ff0000",
        bg_grad_color: "#00ff00",
        bg_grad_dir: "hor",
        bg_image: "assets/images/btn_bg.png",
      },
      {},
      undefined,
      { resolvedBgImage: SAMPLE_PNG_DATA_URL },
    );
    expect(String(styled.background)).toMatch(/linear-gradient\(to right/);
    expect(String(styled.backgroundImage)).toMatch(/^url\("data:image\/png;base64,/);
    // Must not put solid-only backgroundColor when gradient is active
    expect(styled.backgroundColor).toBeUndefined();

    const body = bodyStyleWithoutBgImage(styled);
    expect(body.backgroundImage).toBeUndefined();
    expect(body.backgroundSize).toBeUndefined();
    expect(String(body.background)).toMatch(/linear-gradient/);
  });

  it("Canvas screen fill and HistoryScreenNode use shared fill / strip bg-image layer", () => {
    const canvasSrc = readFileSync(join(root, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(canvasSrc).toMatch(/buildFillBackground/);
    expect(canvasSrc).toMatch(/bg_grad_dir/);

    const histSrc = readFileSync(join(root, "apps/designer/src/components/HistoryScreenNode.vue"), "utf8");
    expect(histSrc).toMatch(/bodyStyleWithoutBgImage/);
    expect(histSrc).toMatch(/splitCanvasChrome|buildWidgetCanvasChrome/);
  });
});
