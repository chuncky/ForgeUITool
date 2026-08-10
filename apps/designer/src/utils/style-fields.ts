/**
 * Style subgroup catalog — BK-aligned categories (background / font / space /
 * border / padding / shadow + Forge extensions outline / line / image).
 * Keys stay Forge JSON names; grouping matches Beken `category` + handbook §4.4.2.
 */

export type StyleFieldDef = {
  key: string;
  label: string;
  type: "color" | "number" | "imageSrc" | "fontRef" | "enum";
  enum?: string[];
  enumLabels?: Record<string, string>;
  /** LVGL opa fields: 0–255 with wrap stepper. */
  min?: number;
  max?: number;
  wrap?: boolean;
  /**
   * BK: many `*_opa` are isVisible:false — hide from StyleGroup by default.
   * `requiresImage` = only show when bg_image is set (bg_img_opacity).
   */
  panelVisible?: boolean;
  requiresImage?: boolean;
};

export type StyleSubgroupDef = {
  id: string;
  title: string;
  fields: StyleFieldDef[];
};

const GRAD_DIR: StyleFieldDef = {
  key: "bg_grad_dir",
  label: "渐变方向",
  type: "enum",
  enum: ["none", "hor", "ver"],
  enumLabels: { none: "无", hor: "水平", ver: "垂直" },
};

const TEXT_ALIGN: StyleFieldDef = {
  key: "text_align",
  label: "对齐",
  type: "enum",
  enum: ["left", "center", "right", "auto"],
  enumLabels: { left: "左", center: "中", right: "右", auto: "自动" },
};

const TEXT_DECOR: StyleFieldDef = {
  key: "text_decor",
  label: "装饰",
  type: "enum",
  enum: ["none", "underline", "strikethrough"],
  enumLabels: { none: "无", underline: "下划线", strikethrough: "删除线" },
};

/** BK-hidden style opa (still seeded / CodeGen). */
const HIDDEN_OPA = { min: 0, max: 255, wrap: true, panelVisible: false as const };

/** Flat catalog (legacy helpers / docs). Prefer STYLE_SUBGROUPS for panel. */
export const STYLE_FIELD_CATALOG: StyleFieldDef[] = [
  { key: "bg_color", label: "颜色&透明度", type: "color" },
  GRAD_DIR,
  { key: "bg_grad_color", label: "渐变色", type: "color" },
  { key: "bg_opacity", label: "背景透明度", type: "number", ...HIDDEN_OPA },
  { key: "bg_img_opacity", label: "背景图透明度", type: "number", min: 0, max: 255, wrap: true, requiresImage: true },
  { key: "img_recolor", label: "重染色", type: "color" },
  { key: "img_opa", label: "图片透明度", type: "number", min: 0, max: 255, wrap: true },
  { key: "text_color", label: "颜色&透明度", type: "color" },
  { key: "text_opacity", label: "文字透明度", type: "number", ...HIDDEN_OPA },
  { key: "text_letter_space", label: "字间距", type: "number" },
  { key: "text_line_space", label: "行间距", type: "number" },
  { key: "text_font_size", label: "字号", type: "number" },
  { key: "radius", label: "圆角", type: "number" },
  { key: "clip_corner", label: "裁剪圆角", type: "number" },
  { key: "border_width", label: "边框宽度", type: "number" },
  { key: "border_color", label: "颜色&透明度", type: "color" },
  { key: "border_opacity", label: "边框透明度", type: "number", ...HIDDEN_OPA },
  { key: "shadow_width", label: "阴影宽度", type: "number" },
  { key: "shadow_color", label: "颜色&透明度", type: "color" },
  { key: "shadow_opacity", label: "阴影透明度", type: "number", ...HIDDEN_OPA },
  { key: "shadow_ofs_x", label: "阴影 X 偏移", type: "number" },
  { key: "shadow_ofs_y", label: "阴影 Y 偏移", type: "number" },
  { key: "pad_top", label: "上内边距", type: "number" },
  { key: "pad_right", label: "右内边距", type: "number" },
  { key: "pad_bottom", label: "下内边距", type: "number" },
  { key: "pad_left", label: "左内边距", type: "number" },
  { key: "line_color", label: "颜色&透明度", type: "color" },
  { key: "line_width", label: "线条宽度", type: "number" },
  { key: "line_opacity", label: "线条透明度", type: "number", ...HIDDEN_OPA },
  { key: "outline_width", label: "外轮廓宽度", type: "number" },
  { key: "outline_color", label: "颜色&透明度", type: "color" },
  { key: "outline_opacity", label: "外轮廓透明度", type: "number", ...HIDDEN_OPA },
];

/**
 * Beken-aligned style subgroups (category ids match BK `enabledGroups`).
 * Order: 背景 → 字体 → 间距 → 边框 → 内边距 → 阴影 → 扩展。
 */
export const STYLE_SUBGROUPS: StyleSubgroupDef[] = [
  {
    id: "background",
    title: "背景",
    fields: [
      { key: "bg_color", label: "颜色&透明度", type: "color" },
      GRAD_DIR,
      { key: "bg_grad_color", label: "渐变色", type: "color" },
      { key: "bg_image", label: "背景图片", type: "imageSrc" },
      {
        key: "bg_img_opacity",
        label: "背景图透明度",
        type: "number",
        min: 0,
        max: 255,
        wrap: true,
        requiresImage: true,
      },
      { key: "bg_opacity", label: "背景透明度", type: "number", ...HIDDEN_OPA },
    ],
  },
  {
    id: "font",
    title: "字体",
    fields: [
      { key: "text_font", label: "字体", type: "fontRef" },
      { key: "text_font_size", label: "字号", type: "number" },
      { key: "text_color", label: "颜色&透明度", type: "color" },
      { key: "text_opacity", label: "文字透明度", type: "number", ...HIDDEN_OPA },
      TEXT_ALIGN,
      TEXT_DECOR,
    ],
  },
  {
    id: "space",
    title: "间距",
    fields: [
      { key: "text_letter_space", label: "字间距", type: "number" },
      { key: "text_line_space", label: "行间距", type: "number" },
    ],
  },
  {
    id: "border",
    title: "边框",
    fields: [
      { key: "border_width", label: "边框宽度", type: "number" },
      { key: "border_color", label: "颜色&透明度", type: "color" },
      { key: "border_opacity", label: "边框透明度", type: "number", ...HIDDEN_OPA },
      { key: "radius", label: "圆角", type: "number" },
      { key: "clip_corner", label: "裁剪圆角", type: "number" },
    ],
  },
  {
    id: "padding",
    title: "内边距",
    fields: [
      { key: "pad_top", label: "上", type: "number" },
      { key: "pad_right", label: "右", type: "number" },
      { key: "pad_bottom", label: "下", type: "number" },
      { key: "pad_left", label: "左", type: "number" },
    ],
  },
  {
    id: "shadow",
    title: "阴影",
    fields: [
      { key: "shadow_width", label: "阴影宽度", type: "number" },
      { key: "shadow_color", label: "颜色&透明度", type: "color" },
      { key: "shadow_opacity", label: "阴影透明度", type: "number", ...HIDDEN_OPA },
      { key: "shadow_ofs_x", label: "阴影 X 偏移", type: "number" },
      { key: "shadow_ofs_y", label: "阴影 Y 偏移", type: "number" },
    ],
  },
  {
    id: "outline",
    title: "外轮廓",
    fields: [
      { key: "outline_width", label: "宽度", type: "number" },
      { key: "outline_color", label: "颜色&透明度", type: "color" },
      { key: "outline_opacity", label: "透明度", type: "number", ...HIDDEN_OPA },
    ],
  },
  {
    id: "line",
    title: "线条",
    fields: [
      { key: "line_color", label: "颜色&透明度", type: "color" },
      { key: "line_width", label: "线条宽度", type: "number" },
      { key: "line_opacity", label: "线条透明度", type: "number", ...HIDDEN_OPA },
    ],
  },
  {
    id: "image",
    title: "图片",
    fields: [
      { key: "img_recolor", label: "重染色", type: "color" },
      { key: "img_opa", label: "图片透明度", type: "number", min: 0, max: 255, wrap: true },
    ],
  },
];

/** Common BK groups for typical widgets (excl. line / image extensions). */
const COMMON_GROUP_IDS = [
  "background",
  "font",
  "space",
  "border",
  "padding",
  "shadow",
  "outline",
] as const;

const LABEL_GROUP_IDS = ["background", "font", "space", "border", "padding", "shadow"] as const;

function pickGroups(ids: readonly string[]): StyleSubgroupDef[] {
  const set = new Set(ids);
  return STYLE_SUBGROUPS.filter((g) => set.has(g.id));
}

/** Flat field list helper (legacy); panel uses styleSubgroupsForWidget. */
export function styleFieldsForWidget(type: string): StyleFieldDef[] {
  return styleSubgroupsForWidget(type).flatMap((g) => g.fields);
}

/**
 * Visible style subgroups per widget (BK `enabledGroups` parity).
 */
export function styleSubgroupsForWidget(type: string): StyleSubgroupDef[] {
  if (type === "label") {
    return pickGroups(LABEL_GROUP_IDS);
  }
  if (type === "image" || type === "animimg" || type === "imagebutton") {
    return pickGroups(["background", "border", "image"]);
  }
  if (type === "line") {
    return pickGroups(["line"]);
  }
  if (type === "led") {
    return pickGroups(["shadow"]);
  }
  return pickGroups(COMMON_GROUP_IDS);
}

/** Narrow fields inside a subgroup for specialized widgets; null = show all subgroup fields. */
export function visibleStyleFieldKeysForWidget(type: string): string[] | null {
  if (type === "image" || type === "animimg" || type === "imagebutton") {
    return ["bg_color", "radius", "clip_corner", "img_recolor", "img_opa"];
  }
  if (type === "line") {
    return ["line_color", "line_width", "line_opacity"];
  }
  if (type === "led") {
    return ["shadow_width", "shadow_color"];
  }
  return null;
}

/** Whether a style field should appear in StyleGroup given current values. */
export function isStyleFieldPanelVisible(
  sf: StyleFieldDef,
  opts?: { hasBgImage?: boolean },
): boolean {
  if (sf.panelVisible === false) return false;
  if (sf.requiresImage && !opts?.hasBgImage) return false;
  return true;
}
