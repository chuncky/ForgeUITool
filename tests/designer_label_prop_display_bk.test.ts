/**
 * Label 对标 BK：对齐仅 style；long_mode 画布可见；is_text_static 走 CodeGen。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getWidgetSpec } from "../packages/core/src/widgets";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome";
import { textLongModeOverflowCss, textLongModeScrollKind } from "../apps/designer/src/utils/button-prop-display-contract";
import { styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";

const root = join(__dirname, "..");

function styleOf(defaults: Record<string, unknown>) {
  return { main: { default: defaults } };
}

function chrome(
  styleDefaults: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
) {
  return buildWidgetCanvasChrome({
    type: "label",
    frame: { x: 0, y: 0, w: 120, h: 32 },
    props: { text: "Hello", long_mode: "WRAP", ...props },
    style: styleOf(styleDefaults),
  });
}

describe("label props vs BK (A+B+C + is_text_static)", () => {
  it("PropSpec: text + is_text_static + long_mode；无 props.text_align", () => {
    const def = getWidgetSpec("label");
    expect(def?.props.map((p) => p.name).sort()).toEqual([
      "is_text_static",
      "long_mode",
      "text",
    ]);
    expect(def?.props.some((p) => p.name === "text_align")).toBe(false);
    expect(def?.lvglPropApis?.is_text_static).toContain("lv_label_set_text_static");
  });

  it("样式字体子组含 text_align；label 暴露 BK 六组", () => {
    const ids = styleSubgroupsForWidget("label").map((g) => g.id);
    expect(ids).toEqual(["background", "font", "space", "border", "padding", "shadow"]);
    const font = styleSubgroupsForWidget("label").find((g) => g.id === "font");
    expect(font?.fields.some((f) => f.key === "text_align")).toBe(true);
    const space = styleSubgroupsForWidget("label").find((g) => g.id === "space");
    expect(space?.fields.map((f) => f.key)).toEqual(["text_letter_space", "text_line_space"]);
    const border = styleSubgroupsForWidget("label").find((g) => g.id === "border");
    expect(border?.fields.some((f) => f.key === "radius")).toBe(true);
  });

  it("WidgetView：label caption + long_mode 接线", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toMatch(/node\.type === ['"]label['"]/);
    expect(src).toContain("label-caption");
    expect(src).toContain("labelCaptionStyle");
    expect(src).toContain("textLongModeOverflowCss");
  });

  it("PropIdentityHeader：显示名提示区分画布文案", () => {
    const src = readFileSync(
      join(root, "apps/designer/src/components/prop-panel/PropIdentityHeader.vue"),
      "utf8",
    );
    expect(src).toContain("显示名");
    expect(src).toContain("不等于画布文案");
    expect(src).toMatch(/widgetType === ['"]label['"]/);
  });

  it("style.text_align → textAlign + justifyContent；legacy props.text_align 仍可读", () => {
    const left = chrome({ text_align: "left" });
    const right = chrome({ text_align: "right" });
    expect(left.textAlign).toBe("left");
    expect(left.justifyContent).toBe("flex-start");
    expect(right.textAlign).toBe("right");
    expect(right.justifyContent).toBe("flex-end");

    const legacy = chrome({}, { text_align: "center" });
    expect(legacy.textAlign).toBe("center");
    expect(legacy.justifyContent).toBe("center");
  });

  it("long_mode WRAP / DOTS / SCROLL 画布可区分", () => {
    const wrap = textLongModeOverflowCss("WRAP");
    const dots = textLongModeOverflowCss("DOTS");
    expect(wrap.whiteSpace).toBe("normal");
    expect(wrap.overflow).toBe("hidden");
    expect(dots.whiteSpace).toBe("nowrap");
    expect(dots.textOverflow).toBe("ellipsis");
    expect(dots.overflow).toBe("hidden");

    const chromeWrap = chrome({}, { long_mode: "WRAP" });
    const chromeDots = chrome({}, { long_mode: "DOTS" });
    expect(chromeWrap.whiteSpace).toBe("normal");
    expect(chromeWrap.overflow).toBe("hidden");
    expect(chromeDots.whiteSpace).toBe("nowrap");
    expect(chromeDots.textOverflow).toBe("ellipsis");
    expect(chromeDots.overflow).toBe("hidden");
    // BK default font ~14px; LVGL montserrat_14 line_height=16
    expect(chromeWrap.fontSize).toBe("14px");
    expect(String(chromeWrap.fontFamily)).toMatch(/Montserrat/);
    expect(chromeWrap.lineHeight).toBe("16px");
    expect(chrome({ text_font_size: 24 }).fontSize).toBe("24px");
    expect(chrome({ text_font_size: 24 }).lineHeight).toBe("27px");
    expect(chrome({ text_font_size: 14, text_line_space: 4 }).lineHeight).toBe("20px");

    expect(textLongModeScrollKind("SCROLL")).toBe("scroll");
    expect(textLongModeScrollKind("SCROLL_CIRCULAR")).toBe("circular");
    expect(textLongModeScrollKind("CLIP")).toBe(null);
    expect(textLongModeScrollKind("DOTS")).toBe(null);

    const src = readFileSync(join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("caption-scroll");
    expect(src).toContain("forge-caption-scroll-pingpong");
    expect(src).toContain("forge-caption-scroll-circular");
    expect(src).toContain("textLongModeScrollKind");
  });

  it("codegen：button 子 label 定宽（BK PCT 100）；is_text_static", () => {
    const gen = readFileSync(join(root, "packages/codegen/src/generate.ts"), "utf8");
    expect(gen).toContain("lv_label_set_text_static");
    expect(gen).toMatch(/is_text_static === true/);
    const labelCase = gen.slice(gen.indexOf('case "label"'), gen.indexOf('case "button"'));
    expect(labelCase).not.toMatch(/lv_obj_set_style_text_align|props\.text_align|LV_TEXT_ALIGN_/);
    expect(labelCase).toContain("lv_label_set_long_mode");
    const buttonCase = gen.slice(gen.indexOf('case "button"'), gen.indexOf('case "image"'));
    expect(buttonCase).toContain("lv_obj_set_width(label, LV_PCT(100))");
    expect(buttonCase).toContain("LV_ALIGN_CENTER");
  });
});
