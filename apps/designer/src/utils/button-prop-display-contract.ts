/**
 * FR-016e / BK 对照：按钮属性项 → 画布「实际可用」契约清单。
 * 权威对照：ref/beken/.../component-specs/button/button.md + 属性面板截图。
 *
 * 每条须有可执行断言（见 tests/designer_button_prop_display_bk.test.ts）。
 * 禁止只写路径/逻辑 id 冒充完成。
 */

export type ButtonPropGroup = "geometry" | "props" | "behavior" | "style";

export type ButtonPropDisplayItem = {
  /** 稳定用例 ID */
  id: string;
  /** Beken 字段名（无则 —） */
  bk: string;
  /** ForgeUI 字段路径 */
  forge: string;
  group: ButtonPropGroup;
  /** 人眼/自动化可观测的画布效果 */
  usableEffect: string;
};

/** 位置信息（GeometryGroup → frame → chrome left/top/width/height） */
export const BUTTON_GEOMETRY_DISPLAY_ITEMS: ButtonPropDisplayItem[] = [
  { id: "geo.x", bk: "x", forge: "frame.x", group: "geometry", usableEffect: "left px 变化" },
  { id: "geo.y", bk: "y", forge: "frame.y", group: "geometry", usableEffect: "top px 变化" },
  { id: "geo.w", bk: "width", forge: "frame.w", group: "geometry", usableEffect: "width px 变化" },
  { id: "geo.h", bk: "height", forge: "frame.h", group: "geometry", usableEffect: "height px 变化" },
];

/** 专用属性（DynamicPropForm） */
export const BUTTON_PROPS_DISPLAY_ITEMS: ButtonPropDisplayItem[] = [
  { id: "prop.text", bk: "text", forge: "props.text", group: "props", usableEffect: "画布按钮文案字符串变化" },
  {
    id: "prop.long_mode",
    bk: "long_mode",
    forge: "props.long_mode",
    group: "props",
    usableEffect: "WRAP 换行 / DOTS 省略 / SCROLL 来回滚 / SCROLL_CIRCULAR 循环滚 / CLIP 裁剪",
  },
];

/** 行为（BehaviorGroup）——影响画布预览的项 */
export const BUTTON_BEHAVIOR_DISPLAY_ITEMS: ButtonPropDisplayItem[] = [
  {
    id: "beh.preview_state",
    bk: "state(preview)",
    forge: "props.preview_state",
    group: "behavior",
    usableEffect: "pressed/focused/disabled/checked 轮廓或滤镜可区分",
  },
  {
    id: "beh.lvgl_flags.CLICKABLE",
    bk: "flags.CLICKABLE",
    forge: "props.lvgl_flags",
    group: "behavior",
    usableEffect: "含 CLICKABLE→cursor:pointer；显式清空→not-allowed",
  },
];

/** 样式子组（StyleGroup for button）——与 styleSubgroupsForWidget('button') 同步 */
export const BUTTON_STYLE_DISPLAY_ITEMS: ButtonPropDisplayItem[] = [
  { id: "style.bg_color", bk: "bg_color", forge: "style.bg_color", group: "style", usableEffect: "background 色值变化" },
  { id: "style.bg_opa", bk: "bg_opa", forge: "style.bg_opacity", group: "style", usableEffect: "background 含 rgba 透明度" },
  { id: "style.bg_grad_dir", bk: "bg_grad_dir", forge: "style.bg_grad_dir", group: "style", usableEffect: "linear-gradient 方向变化" },
  { id: "style.bg_grad_color", bk: "bg_grad_color", forge: "style.bg_grad_color", group: "style", usableEffect: "渐变色出现在 background" },
  {
    id: "style.bg_image",
    bk: "bg_img_src",
    forge: "style.bg_image",
    group: "style",
    usableEffect: "backgroundImage 必须为 data:image/…;base64（真可加载）",
  },
  {
    id: "style.bg_img_opacity",
    bk: "bg_img_opa",
    forge: "style.bg_img_opacity",
    group: "style",
    usableEffect: "有 bg_image 时独立图层 opacity；chrome --forge-bg-img-opa",
  },
  { id: "style.radius", bk: "radius", forge: "style.radius", group: "style", usableEffect: "borderRadius px" },
  { id: "style.clip_corner", bk: "—", forge: "style.clip_corner", group: "style", usableEffect: "overflow:hidden" },
  { id: "style.text_color", bk: "text_color", forge: "style.text_color", group: "style", usableEffect: "color 变化" },
  { id: "style.text_opa", bk: "text_opa", forge: "style.text_opacity", group: "style", usableEffect: "color 含 rgba" },
  { id: "style.text_font", bk: "text_font", forge: "style.text_font", group: "style", usableEffect: "fontFamily=forgeui-font-*（已注册 face）" },
  { id: "style.text_font_size", bk: "字号", forge: "style.text_font_size", group: "style", usableEffect: "fontSize px 变化（如 16≠24）" },
  { id: "style.text_align", bk: "对齐", forge: "style.text_align", group: "style", usableEffect: "textAlign + justifyContent" },
  { id: "style.text_letter_space", bk: "字符间距", forge: "style.text_letter_space", group: "style", usableEffect: "letterSpacing px" },
  { id: "style.text_line_space", bk: "—", forge: "style.text_line_space", group: "style", usableEffect: "lineHeight 变化" },
  { id: "style.text_decor", bk: "—", forge: "style.text_decor", group: "style", usableEffect: "textDecoration" },
  { id: "style.border_width", bk: "border_width", forge: "style.border_width", group: "style", usableEffect: "border 宽度" },
  { id: "style.border_color", bk: "border_color", forge: "style.border_color", group: "style", usableEffect: "border 颜色" },
  { id: "style.border_opacity", bk: "—", forge: "style.border_opacity", group: "style", usableEffect: "border rgba" },
  { id: "style.shadow_width", bk: "shadow_width", forge: "style.shadow_width", group: "style", usableEffect: "boxShadow 模糊半径" },
  { id: "style.shadow_color", bk: "shadow_color", forge: "style.shadow_color", group: "style", usableEffect: "boxShadow 颜色" },
  { id: "style.shadow_opacity", bk: "—", forge: "style.shadow_opacity", group: "style", usableEffect: "boxShadow rgba" },
  { id: "style.shadow_ofs_x", bk: "—", forge: "style.shadow_ofs_x", group: "style", usableEffect: "boxShadow X 偏移" },
  { id: "style.shadow_ofs_y", bk: "—", forge: "style.shadow_ofs_y", group: "style", usableEffect: "boxShadow Y 偏移" },
  { id: "style.pad_top", bk: "—", forge: "style.pad_top", group: "style", usableEffect: "padding-top" },
  { id: "style.pad_right", bk: "—", forge: "style.pad_right", group: "style", usableEffect: "padding-right" },
  { id: "style.pad_bottom", bk: "—", forge: "style.pad_bottom", group: "style", usableEffect: "padding-bottom" },
  { id: "style.pad_left", bk: "—", forge: "style.pad_left", group: "style", usableEffect: "padding-left" },
  { id: "style.outline_width", bk: "—", forge: "style.outline_width", group: "style", usableEffect: "outline 宽度" },
  { id: "style.outline_color", bk: "—", forge: "style.outline_color", group: "style", usableEffect: "outline 颜色" },
  { id: "style.outline_opacity", bk: "—", forge: "style.outline_opacity", group: "style", usableEffect: "outline rgba" },
];

/** BK 有、画布不要求显示的项（生成/数据语义，不列入显示失败） */
export const BUTTON_BK_NON_CANVAS_ITEMS = [
  { bk: "is_text_static", reason: "CodeGen 静态字符串语义，画布文案仍由 text 显示" },
] as const;

export const ALL_BUTTON_DISPLAY_ITEMS: ButtonPropDisplayItem[] = [
  ...BUTTON_GEOMETRY_DISPLAY_ITEMS,
  ...BUTTON_PROPS_DISPLAY_ITEMS,
  ...BUTTON_BEHAVIOR_DISPLAY_ITEMS,
  ...BUTTON_STYLE_DISPLAY_ITEMS,
];

/** Canvas white-space / overflow for label/button long_mode (BK parity). */
export type TextLongModeScrollKind = "scroll" | "circular" | null;

export function textLongModeScrollKind(longMode: unknown): TextLongModeScrollKind {
  const m = String(longMode ?? "WRAP").toUpperCase();
  if (m === "SCROLL") return "scroll";
  if (m === "SCROLL_CIRCULAR") return "circular";
  return null;
}

export function textLongModeOverflowCss(longMode: unknown): {
  whiteSpace: string;
  textOverflow: string;
  overflow: string;
} {
  const m = String(longMode ?? "WRAP").toUpperCase();
  if (m === "WRAP") {
    // BK: WRAP + fixed height clips later lines (not paint outside the box)
    return { whiteSpace: "normal", textOverflow: "clip", overflow: "hidden" };
  }
  if (m === "DOTS") {
    return { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" };
  }
  // CLIP / SCROLL / SCROLL_CIRCULAR — single line + clip; scroll modes animate in WidgetView
  return { whiteSpace: "nowrap", textOverflow: "clip", overflow: "hidden" };
}

/** @deprecated use textLongModeOverflowCss */
export function buttonCaptionOverflowCss(longMode: unknown) {
  return textLongModeOverflowCss(longMode);
}
