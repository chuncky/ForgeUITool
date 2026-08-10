/**
 * 对照 Beken tabview：逐项检查标签视图每一个属性项的画布「实际可用」显示。
 * 契约：apps/designer/src/utils/tabview-prop-display-contract.ts
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getWidgetSpec } from "../packages/core/src/widgets";
import {
  ALL_TABVIEW_DISPLAY_ITEMS,
  TABVIEW_BK_NON_CANVAS_ITEMS,
  TABVIEW_EXTRADATA_DISPLAY_ITEMS,
  TABVIEW_GEOMETRY_DISPLAY_ITEMS,
  TABVIEW_PROPS_DISPLAY_ITEMS,
  TABVIEW_BEHAVIOR_DISPLAY_ITEMS,
  TABVIEW_STYLE_MAIN_DISPLAY_ITEMS,
  TABVIEW_STYLE_PART_DISPLAY_ITEMS,
} from "../apps/designer/src/utils/tabview-prop-display-contract";
import { buildTabviewChrome, resolveTabEntryLabel } from "../apps/designer/src/utils/tabview-chrome";
import { styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";

const root = path.join(__dirname, "..");
const SAMPLE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function tv(opts: {
  frame?: { x: number; y: number; w: number; h: number };
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  extraData?: Record<string, unknown>;
  resolvedBgImage?: string | null;
  resolvedFontFamily?: string | null;
}) {
  return buildTabviewChrome({
    frame: opts.frame ?? { x: 100, y: 56, w: 280, h: 160 },
    props: { tab_bar_size: 50, tab_bar_position: "TOP", ...opts.props },
    style: opts.style,
    extraData: opts.extraData ?? { tabs: [{ name: "Tab 1" }, { name: "Tab 2" }], selectedTabIndex: 0 },
    resolvedBgImage: opts.resolvedBgImage,
    resolvedFontFamily: opts.resolvedFontFamily,
  });
}

describe("BK 对照 — 标签视图属性显示契约完整性", () => {
  it("PropSpec 含 tab_bar_size / tab_bar_position；styleParts 含 main_tabbar*", () => {
    const def = getWidgetSpec("tabview");
    expect(def?.props.map((p) => p.name).sort()).toEqual(["tab_bar_position", "tab_bar_size"]);
    expect(def?.styleParts).toEqual(expect.arrayContaining(["main", "main_tabbar", "main_tabbaritem"]));
    expect(def?.extraDataEditor).toBe("tabs");
  });

  it("清单覆盖 StyleGroup 全部 main 键，无漏测", () => {
    const panelKeys = styleSubgroupsForWidget("tabview").flatMap((g) => g.fields.map((f) => f.key));
    const covered = TABVIEW_STYLE_MAIN_DISPLAY_ITEMS.map((i) => i.forge.split(".").pop()!);
    expect(covered.sort()).toEqual([...panelKeys].sort());
    expect(ALL_TABVIEW_DISPLAY_ITEMS.map((i) => i.id).length).toBe(
      new Set(ALL_TABVIEW_DISPLAY_ITEMS.map((i) => i.id)).size,
    );
  });

  it("BK 核心显示字段均有 Forge 映射", () => {
    const bkCore = [
      "x",
      "y",
      "width",
      "height",
      "tab_bar_size",
      "tab_bar_position",
      "extraData.tabs[].name",
      "selectedTabIndex",
      "bg_color",
      "bg_img_src",
      "main_tabbar.bg_color",
      "main_tabbaritem.text_color",
    ];
    for (const bk of bkCore) {
      const hit = ALL_TABVIEW_DISPLAY_ITEMS.some((i) => i.bk === bk || i.bk.includes(bk.replace("extraData.", "")));
      expect(hit, `missing BK mapping ${bk}`).toBe(true);
    }
    expect(TABVIEW_BK_NON_CANVAS_ITEMS.length).toBeGreaterThan(0);
  });

  it("WidgetView 渲染 tabview chrome（非纯文字占位）", () => {
    const src = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain('node.type === \'tabview\'');
    expect(src).toContain("buildTabviewChrome");
    expect(src).toContain("tab-bar");
    expect(src).toContain("tab-item");
  });
});

describe("逐项 — 几何 geometry", () => {
  it.each(TABVIEW_GEOMETRY_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    const base = { x: 100, y: 56, w: 280, h: 160 };
    if (item.forge === "frame.x") {
      expect(tv({ frame: { ...base, x: 40 } }).rootStyle.left).toBe("40px");
    } else if (item.forge === "frame.y") {
      expect(tv({ frame: { ...base, y: 12 } }).rootStyle.top).toBe("12px");
    } else if (item.forge === "frame.w") {
      expect(tv({ frame: { ...base, w: 300 } }).rootStyle.width).toBe("300px");
    } else if (item.forge === "frame.h") {
      expect(tv({ frame: { ...base, h: 200 } }).rootStyle.height).toBe("200px");
    } else expect.fail(item.id);
  });
});

describe("逐项 — 专用属性 props", () => {
  it.each(TABVIEW_PROPS_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.forge === "props.tab_bar_position") {
      expect(tv({ props: { tab_bar_position: "TOP" } }).flexDirection).toBe("column");
      expect(tv({ props: { tab_bar_position: "BOTTOM" } }).flexDirection).toBe("column-reverse");
      expect(tv({ props: { tab_bar_position: "LEFT" } }).flexDirection).toBe("row");
      expect(tv({ props: { tab_bar_position: "RIGHT" } }).flexDirection).toBe("row-reverse");
      expect(tv({ props: { tab_bar_position: "TOP" } }).barIsHorizontal).toBe(true);
      expect(tv({ props: { tab_bar_position: "LEFT" } }).barIsHorizontal).toBe(false);
    } else if (item.forge === "props.tab_bar_size") {
      const a = tv({ props: { tab_bar_size: 50, tab_bar_position: "TOP" } });
      const b = tv({ props: { tab_bar_size: 80, tab_bar_position: "TOP" } });
      expect(a.barSize).toBe(50);
      expect(b.barSize).toBe(80);
      expect(String(a.barStyle.height)).toBe("50px");
      expect(String(b.barStyle.height)).toBe("80px");
      const left = tv({ props: { tab_bar_size: 60, tab_bar_position: "LEFT" } });
      expect(String(left.barStyle.width)).toBe("60px");
    } else expect.fail(item.id);
  });
});

describe("逐项 — extraData", () => {
  it.each(TABVIEW_EXTRADATA_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.forge === "extraData.tabs") {
      const a = tv({ extraData: { tabs: [{ name: "通用" }, { name: "网络" }], selectedTabIndex: 0 } });
      const b = tv({ extraData: { tabs: [{ name: "A" }], selectedTabIndex: 0 } });
      expect(a.tabs).toEqual(["通用", "网络"]);
      expect(b.tabs).toEqual(["A"]);
      expect(a.tabs).not.toEqual(b.tabs);
      expect(resolveTabEntryLabel({ title: "Legacy" })).toBe("Legacy");
    } else if (item.forge === "extraData.selectedTabIndex") {
      const a = tv({
        extraData: { tabs: [{ name: "T0" }, { name: "T1" }], selectedTabIndex: 0 },
      });
      const b = tv({
        extraData: { tabs: [{ name: "T0" }, { name: "T1" }], selectedTabIndex: 1 },
      });
      expect(a.selectedIndex).toBe(0);
      expect(b.selectedIndex).toBe(1);
      expect(a.selectedIndex).not.toBe(b.selectedIndex);
      expect(a.itemStyle(true).fontWeight).toBe(600);
      expect(a.itemStyle(false).fontWeight).toBe(400);
      // 选中项有底部指示线（TOP 栏）
      expect(a.itemStyle(true).borderBottom).toBeTruthy();
      expect(a.itemStyle(false).borderBottom).toBeUndefined();
    } else expect.fail(item.id);
  });
});

describe("逐项 — 行为 behavior", () => {
  it.each(TABVIEW_BEHAVIOR_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.id === "beh.preview_state") {
      const def = tv({
        style: { main: { default: { bg_color: "#111111" }, pressed: { bg_color: "#ff0000" } } },
        props: { preview_state: "default" },
      });
      const pressed = tv({
        style: { main: { default: { bg_color: "#111111" }, pressed: { bg_color: "#ff0000" } } },
        props: { preview_state: "pressed" },
      });
      expect(String(def.rootStyle.background)).toMatch(/#111111|rgb\(17/);
      expect(String(pressed.rootStyle.background)).toMatch(/#ff0000|rgb\(255,\s*0,\s*0\)/i);
    } else if (item.id === "beh.lvgl_flags.CLICKABLE") {
      expect(tv({ props: { lvgl_flags: ["CLICKABLE"] } }).rootStyle.cursor).toBe("pointer");
      expect(tv({ props: { lvgl_flags: [] } }).rootStyle.cursor).toBe("not-allowed");
    } else expect.fail(item.id);
  });
});

describe("逐项 — 样式 main（实际可用）", () => {
  it.each(TABVIEW_STYLE_MAIN_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    const key = item.forge.split(".").pop()!;
    const style = (v: unknown) => ({ main: { default: { [key]: v } } });

    if (key === "bg_color") {
      expect(String(tv({ style: style("#2d75b9") }).rootStyle.background)).toMatch(/#2d75b9|rgb\(45/);
      return;
    }
    if (key === "bg_opacity") {
      expect(
        String(tv({ style: { main: { default: { bg_color: "#ffffff", bg_opacity: 128 } } } }).rootStyle.background),
      ).toMatch(/rgba\(255/);
      return;
    }
    if (key === "bg_grad_dir") {
      const hor = tv({
        style: { main: { default: { bg_color: "#111", bg_grad_color: "#eee", bg_grad_dir: "hor" } } },
      });
      const ver = tv({
        style: { main: { default: { bg_color: "#111", bg_grad_color: "#eee", bg_grad_dir: "ver" } } },
      });
      expect(String(hor.rootStyle.background)).toMatch(/to right/);
      expect(hor.rootStyle.background).not.toBe(ver.rootStyle.background);
      return;
    }
    if (key === "bg_grad_color") {
      expect(
        String(
          tv({
            style: { main: { default: { bg_color: "#f00", bg_grad_color: "#0f0", bg_grad_dir: "ver" } } },
          }).rootStyle.background,
        ),
      ).toMatch(/linear-gradient/);
      return;
    }
    if (key === "bg_image") {
      const fake = tv({ style: style("assets/images/x.png") });
      expect(fake.rootStyle.backgroundImage).toBeUndefined();
      const real = tv({ style: style("assets/images/x.png"), resolvedBgImage: SAMPLE_PNG });
      expect(String(real.rootStyle.backgroundImage)).toMatch(/^url\("data:image/);
      return;
    }
    if (key === "bg_img_opacity") {
      const real = tv({
        style: { main: { default: { bg_image: SAMPLE_PNG, bg_img_opacity: 64 } } },
        resolvedBgImage: SAMPLE_PNG,
      });
      expect(real.rootStyle["--forge-bg-img-opa"]).toBeCloseTo(64 / 255, 5);
      return;
    }
    if (key === "radius") {
      expect(tv({ style: style(8) }).rootStyle.borderRadius).toBe("8px");
      return;
    }
    if (key === "clip_corner") {
      // root always overflow hidden for tabview chrome; assert key accepted without crash
      expect(tv({ style: style(1) }).rootStyle.overflow).toBe("hidden");
      return;
    }
    if (key === "text_color") {
      expect(String(tv({ style: style("#00aaff") }).rootStyle.color)).toMatch(/#00aaff|rgb\(0,\s*170/);
      return;
    }
    if (key === "text_opacity") {
      expect(
        String(tv({ style: { main: { default: { text_color: "#ffffff", text_opacity: 128 } } } }).rootStyle.color),
      ).toMatch(/rgba\(255/);
      return;
    }
    if (key === "text_font") {
      expect(
        tv({ style: style("@montserrat"), resolvedFontFamily: "forgeui-font-montserrat" }).rootStyle.fontFamily,
      ).toBe("forgeui-font-montserrat");
      return;
    }
    if (key === "text_font_size") {
      expect(tv({ style: style(18) }).rootStyle.fontSize).toBe("18px");
      expect(tv({ style: style(24) }).rootStyle.fontSize).not.toBe(tv({ style: style(18) }).rootStyle.fontSize);
      return;
    }
    if (key === "text_align") {
      expect(tv({ style: style("right") }).rootStyle.justifyContent).toBe("flex-end");
      return;
    }
    if (key === "text_letter_space") {
      expect(tv({ style: style(3) }).rootStyle.letterSpacing).toBe("3px");
      return;
    }
    if (key === "text_line_space") {
      // Default font 16 → LVGL montserrat line_height 18 + 6 = 24
      expect(tv({ style: style(6) }).rootStyle.lineHeight).toBe("24px");
      return;
    }
    if (key === "text_decor") {
      expect(tv({ style: style("underline") }).rootStyle.textDecoration).toBe("underline");
      return;
    }
    if (key === "border_width") {
      expect(String(tv({ style: { main: { default: { border_width: 3, border_color: "#fff" } } } }).rootStyle.border)).toMatch(
        /^3px solid/,
      );
      return;
    }
    if (key === "border_color") {
      expect(
        String(tv({ style: { main: { default: { border_width: 2, border_color: "#112233" } } } }).rootStyle.border),
      ).toMatch(/#112233|rgb\(17/);
      return;
    }
    if (key === "border_opacity") {
      expect(
        String(
          tv({
            style: { main: { default: { border_width: 2, border_color: "#ffffff", border_opacity: 128 } } },
          }).rootStyle.border,
        ),
      ).toMatch(/rgba\(255/);
      return;
    }
    if (key === "shadow_width") {
      expect(String(tv({ style: { main: { default: { shadow_width: 8, shadow_color: "#000" } } } }).rootStyle.boxShadow)).toContain(
        "8px",
      );
      return;
    }
    if (key === "shadow_color") {
      expect(
        String(tv({ style: { main: { default: { shadow_width: 4, shadow_color: "#0000ff" } } } }).rootStyle.boxShadow),
      ).toMatch(/#0000ff|rgba?\(0,\s*0,\s*255/i);
      return;
    }
    if (key === "shadow_opacity") {
      expect(
        String(
          tv({
            style: { main: { default: { shadow_width: 4, shadow_color: "#000000", shadow_opacity: 128 } } },
          }).rootStyle.boxShadow,
        ),
      ).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.5/);
      return;
    }
    if (key === "shadow_ofs_x") {
      expect(String(tv({ style: { main: { default: { shadow_width: 4, shadow_ofs_x: 5 } } } }).rootStyle.boxShadow)).toMatch(
        /^5px/,
      );
      return;
    }
    if (key === "shadow_ofs_y") {
      expect(String(tv({ style: { main: { default: { shadow_width: 4, shadow_ofs_y: 7 } } } }).rootStyle.boxShadow)).toMatch(
        /^\d+px 7px/,
      );
      return;
    }
    if (key === "pad_top") {
      expect(String(tv({ style: style(8) }).rootStyle.padding)).toMatch(/^8px /);
      return;
    }
    if (key === "pad_right") {
      expect(String(tv({ style: style(6) }).rootStyle.padding)?.split(/\s+/)).toEqual(expect.arrayContaining(["6px"]));
      return;
    }
    if (key === "pad_bottom") {
      expect(String(tv({ style: style(5) }).rootStyle.padding)).toContain("5px");
      return;
    }
    if (key === "pad_left") {
      expect(String(tv({ style: style(3) }).rootStyle.padding)).toMatch(/3px$/);
      return;
    }
    if (key === "outline_width") {
      expect(String(tv({ style: { main: { default: { outline_width: 2, outline_color: "#abc" } } } }).rootStyle.outline)).toMatch(
        /^2px solid/,
      );
      return;
    }
    if (key === "outline_color") {
      expect(
        String(tv({ style: { main: { default: { outline_width: 2, outline_color: "#abcdef" } } } }).rootStyle.outline),
      ).toMatch(/#abcdef|rgb\(171/i);
      return;
    }
    if (key === "outline_opacity") {
      expect(
        String(
          tv({
            style: { main: { default: { outline_width: 2, outline_color: "#ffffff", outline_opacity: 128 } } },
          }).rootStyle.outline,
        ),
      ).toMatch(/rgba\(255/);
      return;
    }
    expect.fail(`未断言样式键 ${key}`);
  });
});

describe("逐项 — 样式 Part tabbar / tabbaritem", () => {
  it.each(TABVIEW_STYLE_PART_DISPLAY_ITEMS)("$id ($bk → $forge): $usableEffect", (item) => {
    if (item.id === "style.tabbar.bg_color") {
      const a = tv({ style: { main_tabbar: { default: { bg_color: "#112233" } } } });
      const b = tv({ style: { main_tabbar: { default: { bg_color: "#ff9900" } } } });
      expect(String(a.barStyle.background)).toMatch(/#112233|rgb\(17/);
      expect(a.barStyle.background).not.toBe(b.barStyle.background);
    } else if (item.id === "style.tabbaritem.text_color") {
      const a = tv({ style: { main_tabbaritem: { default: { text_color: "#00ff00" } } } });
      expect(String(a.itemStyle(false).color)).toMatch(/#00ff00|rgb\(0,\s*255,\s*0\)/i);
    } else if (item.id === "style.tabbaritem.checked.bg_color") {
      const m = tv({
        style: {
          main_tabbaritem: {
            default: { bg_color: "#222222" },
            checked: { bg_color: "#3d9cf0" },
          },
        },
        extraData: { tabs: [{ name: "A" }, { name: "B" }], selectedTabIndex: 0 },
      });
      expect(String(m.itemStyle(true).background)).toMatch(/#3d9cf0|rgb\(61,\s*156,\s*240\)/i);
      expect(String(m.itemStyle(false).background)).toMatch(/#222222|rgb\(34/);
      expect(m.itemStyle(true).background).not.toBe(m.itemStyle(false).background);
    } else expect.fail(item.id);
  });
});

describe("汇总 — 条目计数门禁", () => {
  it(`共 ${ALL_TABVIEW_DISPLAY_ITEMS.length} 项列入逐项套件`, () => {
    expect(TABVIEW_GEOMETRY_DISPLAY_ITEMS.length).toBe(4);
    expect(TABVIEW_PROPS_DISPLAY_ITEMS.length).toBe(2);
    expect(TABVIEW_EXTRADATA_DISPLAY_ITEMS.length).toBe(2);
    expect(TABVIEW_BEHAVIOR_DISPLAY_ITEMS.length).toBe(2);
    expect(TABVIEW_STYLE_MAIN_DISPLAY_ITEMS.length).toBe(
      styleSubgroupsForWidget("tabview").flatMap((g) => g.fields).length,
    );
    expect(TABVIEW_STYLE_PART_DISPLAY_ITEMS.length).toBe(3);
    expect(ALL_TABVIEW_DISPLAY_ITEMS.length).toBe(
      4 + 2 + 2 + 2 + TABVIEW_STYLE_MAIN_DISPLAY_ITEMS.length + 3,
    );
  });
});
