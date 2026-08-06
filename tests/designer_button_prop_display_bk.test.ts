/**
 * 对照 Beken button 规格：逐项检查按钮每一个属性项的画布「实际可用」显示。
 * 契约清单：apps/designer/src/utils/button-prop-display-contract.ts
 *
 * 硬规则（FR-016e）：
 * - 背景图必须 data:image 可加载，禁止裸 assets/ 路径
 * - 字号/字体/对齐必须产生可区分 CSS
 * - 清单条目数须与面板 StyleGroup + 几何 + 属性 + 行为一致，禁止漏测
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getWidgetSpec } from "../packages/core/src/widgets";
import {
  ALL_BUTTON_DISPLAY_ITEMS,
  BUTTON_BK_NON_CANVAS_ITEMS,
  BUTTON_GEOMETRY_DISPLAY_ITEMS,
  BUTTON_PROPS_DISPLAY_ITEMS,
  BUTTON_BEHAVIOR_DISPLAY_ITEMS,
  BUTTON_STYLE_DISPLAY_ITEMS,
  buttonCaptionOverflowCss,
  textLongModeScrollKind,
} from "../apps/designer/src/utils/button-prop-display-contract";
import { buildWidgetCanvasChrome, type CanvasChromeStyle } from "../apps/designer/src/utils/canvas-chrome";
import { styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";
import { nodeDisplayText } from "../apps/designer/src/utils/i18n-display";
import { readProjectAssetDataUrl } from "../apps/designer/electron/asset-data-url.mjs";
import { isUsableDataUrl } from "../apps/designer/src/utils/asset-url";

const root = path.join(__dirname, "..");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function styleOf(defaults: Record<string, unknown>) {
  return { main: { default: defaults } };
}

function chrome(
  style: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
  frame = { x: 10, y: 20, w: 120, h: 40 },
  resolved?: { resolvedBgImage?: string | null; resolvedFontFamily?: string | null },
): CanvasChromeStyle {
  return buildWidgetCanvasChrome({
    type: "button",
    frame,
    props: { text: "Button", ...props },
    style: styleOf(style),
    ...resolved,
  });
}

describe("BK 对照 — 按钮属性显示契约完整性", () => {
  it("清单覆盖面板全部 style 键，无漏测", () => {
    const panelKeys = styleSubgroupsForWidget("button").flatMap((g) => g.fields.map((f) => f.key));
    const styleKeys = BUTTON_STYLE_DISPLAY_ITEMS.map((i) => i.forge.replace(/^style\./, ""));
    expect(styleKeys.sort()).toEqual([...panelKeys].sort());
    expect(ALL_BUTTON_DISPLAY_ITEMS.map((i) => i.id).length).toBe(
      new Set(ALL_BUTTON_DISPLAY_ITEMS.map((i) => i.id)).size,
    );
  });

  it("BK 核心显示字段均有 Forge 映射（is_text_static 除外）", () => {
    const bkCore = [
      "x",
      "y",
      "width",
      "height",
      "text",
      "long_mode",
      "flags.CLICKABLE",
      "bg_color",
      "bg_opa",
      "bg_grad_dir",
      "bg_grad_color",
      "bg_img_src",
      "text_color",
      "text_opa",
      "text_font",
      "border_width",
      "border_color",
      "radius",
      "shadow_width",
      "shadow_color",
    ];
    for (const bk of bkCore) {
      const hit = ALL_BUTTON_DISPLAY_ITEMS.some((i) => i.bk === bk || i.bk.includes(bk));
      expect(hit, `missing BK display mapping for ${bk}`).toBe(true);
    }
    expect(BUTTON_BK_NON_CANVAS_ITEMS.some((i) => i.bk === "is_text_static")).toBe(true);
  });

  it("按钮 PropSpec 含 text + long_mode（对标 BK）", () => {
    const def = getWidgetSpec("button");
    expect(def?.props.map((p) => p.name).sort()).toEqual(["long_mode", "text"]);
  });

  it("WidgetView 接线：文案 / 资源解析 / long_mode 满宽", () => {
    const src = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("displayText");
    expect(src).toContain("resolveProjectAssetDataUrl");
    expect(src).toContain("resolvedBgImage");
    expect(src).toContain("buttonCaptionOverflowCss");
    expect(src).toMatch(/btn-label[\s\S]*width:\s*100%/);
  });
});

describe("逐项 — 几何 geometry", () => {
  it.each(BUTTON_GEOMETRY_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    const base = { x: 10, y: 20, w: 100, h: 40 };
    if (item.forge === "frame.x") {
      expect(chrome({}, {}, { ...base, x: 55 }).left).toBe("55px");
      expect(chrome({}, {}, { ...base, x: 55 }).left).not.toBe(chrome({}, {}, base).left);
    } else if (item.forge === "frame.y") {
      expect(chrome({}, {}, { ...base, y: 66 }).top).toBe("66px");
    } else if (item.forge === "frame.w") {
      expect(chrome({}, {}, { ...base, w: 180 }).width).toBe("180px");
    } else if (item.forge === "frame.h") {
      expect(chrome({}, {}, { ...base, h: 48 }).height).toBe("48px");
    } else {
      expect.fail(`unhandled ${item.id}`);
    }
  });
});

describe("逐项 — 专用属性 props", () => {
  it.each(BUTTON_PROPS_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.forge === "props.text") {
      const a = nodeDisplayText({ text: "确定" }, undefined);
      const b = nodeDisplayText({ text: "取消" }, undefined);
      expect(a).toBe("确定");
      expect(b).toBe("取消");
      expect(a).not.toBe(b);
    } else if (item.forge === "props.long_mode") {
      const wrap = buttonCaptionOverflowCss("WRAP");
      const dots = buttonCaptionOverflowCss("DOTS");
      const clip = buttonCaptionOverflowCss("CLIP");
      expect(wrap.whiteSpace).toBe("normal");
      expect(dots.whiteSpace).toBe("nowrap");
      expect(dots.textOverflow).toBe("ellipsis");
      expect(clip.whiteSpace).toBe("nowrap");
      const chromeWrap = chrome({}, { long_mode: "WRAP" });
      const chromeDots = chrome({}, { long_mode: "DOTS" });
      expect(chromeWrap.whiteSpace).toBe("normal");
      expect(chromeDots.whiteSpace).toBe("nowrap");
      expect(chromeDots.textOverflow).toBe("ellipsis");
      expect(chromeWrap.whiteSpace).not.toBe(chromeDots.whiteSpace);
      expect(textLongModeScrollKind("SCROLL")).toBe("scroll");
      expect(textLongModeScrollKind("SCROLL_CIRCULAR")).toBe("circular");
      const src = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
      expect(src).toContain("forge-caption-scroll-pingpong");
      expect(src).toContain("forge-caption-scroll-circular");
    } else {
      expect.fail(`unhandled ${item.id}`);
    }
  });
});

describe("逐项 — 行为 behavior", () => {
  it.each(BUTTON_BEHAVIOR_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.id === "beh.preview_state") {
      const pressed = chrome({}, { preview_state: "pressed" });
      const focused = chrome({}, { preview_state: "focused" });
      const disabled = chrome({}, { preview_state: "disabled" });
      const checked = chrome({}, { preview_state: "checked" });
      expect(pressed.filter).toMatch(/brightness/);
      expect(focused.outline).toBeTruthy();
      expect(disabled.filter).toMatch(/grayscale/);
      expect(Number(disabled.opacity)).toBeLessThan(1);
      expect(checked.outline).toBeTruthy();
      expect(JSON.stringify(pressed)).not.toBe(JSON.stringify(focused));
    } else if (item.id === "beh.lvgl_flags.CLICKABLE") {
      expect(chrome({}, { lvgl_flags: ["CLICKABLE"] }).cursor).toBe("pointer");
      expect(chrome({}, { lvgl_flags: [] }).cursor).toBe("not-allowed");
    } else {
      expect.fail(`unhandled ${item.id}`);
    }
  });
});

describe("逐项 — 样式 style（实际可用）", () => {
  it.each(BUTTON_STYLE_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    const key = item.forge.replace(/^style\./, "");

    if (key === "bg_color") {
      const s = chrome({ bg_color: "#2d75b9" });
      expect(String(s.background)).toMatch(/#2d75b9|rgb\(45,\s*117,\s*185\)/i);
      return;
    }
    if (key === "bg_opacity") {
      const s = chrome({ bg_color: "#ffffff", bg_opacity: 128 });
      expect(String(s.background)).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5/);
      return;
    }
    if (key === "bg_grad_dir") {
      const hor = chrome({ bg_color: "#111111", bg_grad_color: "#eeeeee", bg_grad_dir: "hor" });
      const ver = chrome({ bg_color: "#111111", bg_grad_color: "#eeeeee", bg_grad_dir: "ver" });
      expect(String(hor.background)).toMatch(/to right/);
      expect(String(ver.background)).toMatch(/to bottom/);
      expect(hor.background).not.toBe(ver.background);
      return;
    }
    if (key === "bg_grad_color") {
      const s = chrome({ bg_color: "#ff0000", bg_grad_color: "#00ff00", bg_grad_dir: "ver" });
      expect(String(s.background)).toMatch(/linear-gradient/);
      expect(String(s.background)).toMatch(/#00ff00|rgb\(0,\s*255,\s*0\)/i);
      return;
    }
    if (key === "bg_image") {
      // 真文件 → data URL（不是文件名字符串）
      const proj = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-btn-bg-"));
      const rel = "assets/images/btn.png";
      fs.mkdirSync(path.dirname(path.join(proj, rel)), { recursive: true });
      fs.writeFileSync(path.join(proj, rel), PNG_1X1);
      const loaded = readProjectAssetDataUrl(proj, rel);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(isUsableDataUrl(loaded.dataUrl)).toBe(true);

      const fake = chrome({ bg_image: rel });
      expect(fake.backgroundImage, "裸路径不得冒充可用").toBeUndefined();

      const real = chrome({ bg_image: rel }, {}, { x: 10, y: 20, w: 120, h: 40 }, {
        resolvedBgImage: loaded.dataUrl,
      });
      expect(String(real.backgroundImage)).toMatch(/^url\("data:image\/png;base64,/);
      return;
    }
    if (key === "radius") {
      expect(chrome({ radius: 5 }).borderRadius).toBe("5px");
      return;
    }
    if (key === "clip_corner") {
      expect(chrome({ clip_corner: 1 }).overflow).toBe("hidden");
      return;
    }
    if (key === "text_color") {
      expect(String(chrome({ text_color: "#ffffffff" }).color)).toMatch(/#ffffff|rgba?\(255/i);
      return;
    }
    if (key === "text_opacity") {
      expect(String(chrome({ text_color: "#ffffff", text_opacity: 128 }).color)).toMatch(/rgba\(255/);
      return;
    }
    if (key === "text_font") {
      const s = chrome({ text_font: "@montserrat" }, {}, { x: 10, y: 20, w: 120, h: 40 }, {
        resolvedFontFamily: "forgeui-font-montserrat",
      });
      expect(s.fontFamily).toBe("forgeui-font-montserrat");
      // 未解析项目字体时用 LVGL 默认族 Montserrat，不得把 @id 当 CSS 字体名
      const fallback = chrome({ text_font: "@montserrat" });
      expect(String(fallback.fontFamily)).toMatch(/Montserrat/);
      expect(String(fallback.fontFamily)).not.toContain("@montserrat");
      return;
    }
    if (key === "text_font_size") {
      expect(chrome({ text_font_size: 16 }).fontSize).toBe("16px");
      expect(chrome({ text_font_size: 24 }).fontSize).toBe("24px");
      expect(chrome({ text_font_size: 16 }).fontSize).not.toBe(chrome({ text_font_size: 24 }).fontSize);
      return;
    }
    if (key === "text_align") {
      const left = chrome({ text_align: "left" });
      const right = chrome({ text_align: "right" });
      expect(left.textAlign).toBe("left");
      expect(left.justifyContent).toBe("flex-start");
      expect(right.justifyContent).toBe("flex-end");
      return;
    }
    if (key === "text_letter_space") {
      expect(chrome({ text_letter_space: 4 }).letterSpacing).toBe("4px");
      return;
    }
    if (key === "text_line_space") {
      // LVGL montserrat_14 line_height=16 + text_line_space
      expect(chrome({ text_line_space: 6 }).lineHeight).toBe("22px");
      expect(chrome({ text_font_size: 20, text_line_space: 4 }).lineHeight).toBe("26px");
      return;
    }
    if (key === "text_decor") {
      expect(chrome({ text_decor: "underline" }).textDecoration).toBe("underline");
      return;
    }
    if (key === "border_width") {
      expect(String(chrome({ border_width: 3, border_color: "#fff" }).border)).toMatch(/^3px solid/);
      return;
    }
    if (key === "border_color") {
      expect(String(chrome({ border_width: 2, border_color: "#112233" }).border)).toMatch(
        /#112233|rgb\(17,\s*34,\s*51\)/i,
      );
      return;
    }
    if (key === "border_opacity") {
      expect(
        String(chrome({ border_width: 2, border_color: "#ffffff", border_opacity: 128 }).border),
      ).toMatch(/rgba\(255/);
      return;
    }
    if (key === "shadow_width") {
      expect(String(chrome({ shadow_width: 8, shadow_color: "#000" }).boxShadow)).toContain("8px");
      return;
    }
    if (key === "shadow_color") {
      expect(String(chrome({ shadow_width: 4, shadow_color: "#0000ff" }).boxShadow)).toMatch(
        /#0000ff|rgba?\(0,\s*0,\s*255/i,
      );
      return;
    }
    if (key === "shadow_opacity") {
      expect(
        String(chrome({ shadow_width: 4, shadow_color: "#000000", shadow_opacity: 128 }).boxShadow),
      ).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.5/);
      return;
    }
    if (key === "shadow_ofs_x") {
      expect(String(chrome({ shadow_width: 4, shadow_ofs_x: 5 }).boxShadow)).toMatch(/^5px/);
      return;
    }
    if (key === "shadow_ofs_y") {
      expect(String(chrome({ shadow_width: 4, shadow_ofs_y: 7 }).boxShadow)).toMatch(/^\d+px 7px/);
      return;
    }
    if (key === "pad_top") {
      expect(String(chrome({ pad_top: 8 }).padding)).toMatch(/^8px /);
      return;
    }
    if (key === "pad_right") {
      expect(String(chrome({ pad_right: 6 }).padding)?.split(/\s+/)).toEqual(
        expect.arrayContaining(["6px"]),
      );
      return;
    }
    if (key === "pad_bottom") {
      expect(String(chrome({ pad_bottom: 5 }).padding)).toContain("5px");
      return;
    }
    if (key === "pad_left") {
      expect(String(chrome({ pad_left: 3 }).padding)).toMatch(/3px$/);
      return;
    }
    if (key === "outline_width") {
      expect(String(chrome({ outline_width: 2, outline_color: "#abc" }).outline)).toMatch(/^2px solid/);
      return;
    }
    if (key === "outline_color") {
      expect(String(chrome({ outline_width: 2, outline_color: "#abcdef" }).outline)).toMatch(
        /#abcdef|rgb\(171/i,
      );
      return;
    }
    if (key === "outline_opacity") {
      expect(
        String(chrome({ outline_width: 2, outline_color: "#ffffff", outline_opacity: 128 }).outline),
      ).toMatch(/rgba\(255/);
      return;
    }

    expect.fail(`未实现断言的样式项: ${item.id} — 不允许跳过`);
  });
});

describe("汇总 — 条目计数门禁", () => {
  it(`共 ${ALL_BUTTON_DISPLAY_ITEMS.length} 项均已列入逐项套件`, () => {
    expect(BUTTON_GEOMETRY_DISPLAY_ITEMS.length).toBe(4);
    expect(BUTTON_PROPS_DISPLAY_ITEMS.length).toBe(2);
    expect(BUTTON_BEHAVIOR_DISPLAY_ITEMS.length).toBe(2);
    expect(BUTTON_STYLE_DISPLAY_ITEMS.length).toBe(styleSubgroupsForWidget("button").flatMap((g) => g.fields).length);
    expect(ALL_BUTTON_DISPLAY_ITEMS.length).toBe(
      4 + 2 + 2 + BUTTON_STYLE_DISPLAY_ITEMS.length,
    );
  });
});
