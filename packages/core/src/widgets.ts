export type WidgetCategoryId = "layout" | "button" | "display" | "input" | "media" | "viz";

export type PropSpecType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "color"
  | "range"
  | "imageSrc";

export interface PropSpec {
  name: string;
  type: PropSpecType;
  /** Chinese label for property panel */
  label?: string;
  default?: unknown;
  enum?: string[];
  enumLabels?: Record<string, string>;
}

export const WIDGET_CATEGORY_ORDER: WidgetCategoryId[] = [
  "layout",
  "button",
  "display",
  "input",
  "media",
  "viz",
];

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategoryId, string> = {
  layout: "布局容器",
  button: "按钮",
  display: "数据展示",
  input: "表单输入",
  media: "图片媒体",
  viz: "可视化",
};

export interface WidgetSpec {
  type: string;
  category: WidgetCategoryId;
  icon?: string;
  lvgl: { create: string; major: number[] };
  label: { "zh-CN": string; en?: string };
  isContainer: boolean;
  defaultFrame: { w: number; h: number };
  props: PropSpec[];
  styleParts: string[];
  events: string[];
  codegen: { templatePartial: string };
}

export interface WidgetCategoryGroup {
  category: WidgetCategoryId;
  label: string;
  widgets: WidgetSpec[];
}

const MVP: WidgetSpec[] = [
  {
    type: "screen",
    category: "layout",
    lvgl: { create: "lv_obj_create", major: [9] },
    label: { "zh-CN": "屏幕", en: "Screen" },
    isContainer: true,
    defaultFrame: { w: 480, h: 320 },
    props: [],
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/screen" },
  },
  {
    type: "container",
    category: "layout",
    icon: "container",
    lvgl: { create: "lv_obj_create", major: [9] },
    label: { "zh-CN": "容器", en: "Container" },
    isContainer: true,
    defaultFrame: { w: 100, h: 100 },
    props: [],
    styleParts: ["main"],
    events: ["CLICKED"],
    codegen: { templatePartial: "widgets/container" },
  },
  {
    type: "label",
    category: "display",
    icon: "label",
    lvgl: { create: "lv_label_create", major: [9] },
    label: { "zh-CN": "标签", en: "Label" },
    isContainer: false,
    defaultFrame: { w: 120, h: 32 },
    props: [
      { name: "text", type: "text", label: "文本", default: "Label" },
      {
        name: "align",
        type: "enum",
        label: "对齐",
        default: "left",
        enum: ["left", "center", "right"],
        enumLabels: { left: "左", center: "中", right: "右" },
      },
    ],
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/label" },
  },
  {
    type: "button",
    category: "button",
    icon: "button",
    lvgl: { create: "lv_button_create", major: [9] },
    label: { "zh-CN": "按钮", en: "Button" },
    isContainer: true,
    defaultFrame: { w: 100, h: 40 },
    props: [{ name: "text", type: "text", label: "文本", default: "Button" }],
    styleParts: ["main"],
    events: ["CLICKED", "PRESSED", "RELEASED", "LONG_PRESSED"],
    codegen: { templatePartial: "widgets/button" },
  },
  {
    type: "image",
    category: "media",
    icon: "image",
    lvgl: { create: "lv_image_create", major: [9] },
    label: { "zh-CN": "图片", en: "Image" },
    isContainer: false,
    defaultFrame: { w: 64, h: 64 },
    props: [{ name: "src", type: "imageSrc", label: "图片路径", default: "" }],
    styleParts: ["main"],
    events: ["CLICKED"],
    codegen: { templatePartial: "widgets/image" },
  },
  {
    type: "slider",
    category: "input",
    icon: "slider",
    lvgl: { create: "lv_slider_create", major: [9] },
    label: { "zh-CN": "滑条", en: "Slider" },
    isContainer: false,
    defaultFrame: { w: 160, h: 20 },
    props: [
      { name: "range", type: "range", label: "范围", default: { min: 0, max: 100 } },
      { name: "value", type: "number", label: "当前值", default: 50 },
    ],
    styleParts: ["main", "indicator", "knob"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/slider" },
  },
  {
    type: "switch",
    category: "input",
    icon: "switch",
    lvgl: { create: "lv_switch_create", major: [9] },
    label: { "zh-CN": "开关", en: "Switch" },
    isContainer: false,
    defaultFrame: { w: 50, h: 25 },
    props: [{ name: "checked", type: "boolean", label: "选中", default: false }],
    styleParts: ["main", "indicator", "knob"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/switch" },
  },
  {
    type: "checkbox",
    category: "input",
    icon: "checkbox",
    lvgl: { create: "lv_checkbox_create", major: [9] },
    label: { "zh-CN": "复选框", en: "Checkbox" },
    isContainer: false,
    defaultFrame: { w: 120, h: 32 },
    props: [
      { name: "text", type: "text", label: "文本", default: "Checkbox" },
      { name: "checked", type: "boolean", label: "选中", default: false },
    ],
    styleParts: ["main", "indicator"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/checkbox" },
  },
  {
    type: "bar",
    category: "viz",
    icon: "bar",
    lvgl: { create: "lv_bar_create", major: [9] },
    label: { "zh-CN": "进度条", en: "Bar" },
    isContainer: false,
    defaultFrame: { w: 160, h: 16 },
    props: [
      { name: "range", type: "range", label: "范围", default: { min: 0, max: 100 } },
      { name: "value", type: "number", label: "当前值", default: 40 },
    ],
    styleParts: ["main", "indicator"],
    events: [],
    codegen: { templatePartial: "widgets/bar" },
  },
  {
    type: "arc",
    category: "viz",
    icon: "arc",
    lvgl: { create: "lv_arc_create", major: [9] },
    label: { "zh-CN": "圆弧", en: "Arc" },
    isContainer: false,
    defaultFrame: { w: 100, h: 100 },
    props: [
      { name: "range", type: "range", label: "范围", default: { min: 0, max: 100 } },
      { name: "value", type: "number", label: "当前值", default: 30 },
    ],
    styleParts: ["main", "indicator", "knob"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/arc" },
  },
  {
    type: "dropdown",
    category: "input",
    icon: "dropdown",
    lvgl: { create: "lv_dropdown_create", major: [9] },
    label: { "zh-CN": "下拉框", en: "Dropdown" },
    isContainer: false,
    defaultFrame: { w: 140, h: 36 },
    props: [{ name: "options", type: "text", label: "选项（每行一项）", default: "One\nTwo\nThree" }],
    styleParts: ["main"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/dropdown" },
  },
  {
    type: "textarea",
    category: "input",
    icon: "textarea",
    lvgl: { create: "lv_textarea_create", major: [9] },
    label: { "zh-CN": "文本域", en: "Textarea" },
    isContainer: false,
    defaultFrame: { w: 200, h: 80 },
    props: [
      { name: "text", type: "text", label: "文本", default: "" },
      { name: "placeholder", type: "text", label: "占位符", default: "" },
    ],
    styleParts: ["main", "scrollbar"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/textarea" },
  },
  {
    type: "list",
    category: "display",
    icon: "list",
    lvgl: { create: "lv_list_create", major: [9] },
    label: { "zh-CN": "列表", en: "List" },
    isContainer: false,
    defaultFrame: { w: 160, h: 120 },
    props: [],
    styleParts: ["main", "main_button", "main_item", "scrollbar"],
    events: ["CLICKED"],
    codegen: { templatePartial: "widgets/list" },
  },
  {
    type: "roller",
    category: "input",
    icon: "roller",
    lvgl: { create: "lv_roller_create", major: [9] },
    label: { "zh-CN": "滚轮", en: "Roller" },
    isContainer: false,
    defaultFrame: { w: 100, h: 120 },
    props: [
      { name: "visible_row_count", type: "number", label: "可见行数", default: 3 },
      {
        name: "mode",
        type: "enum",
        label: "模式",
        default: "NORMAL",
        enum: ["NORMAL", "INFINITE"],
        enumLabels: { NORMAL: "普通", INFINITE: "无限" },
      },
    ],
    styleParts: ["main", "selected"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/roller" },
  },
  {
    type: "imagebutton",
    category: "button",
    icon: "imagebutton",
    lvgl: { create: "lv_imagebutton_create", major: [9] },
    label: { "zh-CN": "图片按钮", en: "Image button" },
    isContainer: false,
    defaultFrame: { w: 64, h: 64 },
    props: [
      { name: "text", type: "text", label: "文本", default: "" },
      { name: "src_released", type: "imageSrc", label: "释放态图片", default: "" },
      { name: "src_pressed", type: "imageSrc", label: "按下态图片", default: "" },
    ],
    styleParts: ["main"],
    events: ["CLICKED"],
    codegen: { templatePartial: "widgets/imagebutton" },
  },
  {
    type: "spinner",
    category: "viz",
    icon: "spinner",
    lvgl: { create: "lv_spinner_create", major: [9] },
    label: { "zh-CN": "加载动画", en: "Spinner" },
    isContainer: false,
    defaultFrame: { w: 48, h: 48 },
    props: [
      { name: "arc_length", type: "number", label: "弧长", default: 60 },
      { name: "anim_time", type: "number", label: "动画时长(ms)", default: 1000 },
    ],
    styleParts: ["main", "indicator"],
    events: [],
    codegen: { templatePartial: "widgets/spinner" },
  },
];

const byType = new Map(MVP.map((w) => [w.type, w]));

export function listWidgetSpecs(): WidgetSpec[] {
  return [...MVP];
}

/** Widgets shown in the control library (excludes screen). */
export function listPaletteWidgetSpecs(): WidgetSpec[] {
  return MVP.filter((w) => w.type !== "screen");
}

export function groupPaletteWidgetsByCategory(widgets: WidgetSpec[]): WidgetCategoryGroup[] {
  const buckets = new Map<WidgetCategoryId, WidgetSpec[]>();
  for (const w of widgets) {
    if (w.type === "screen") continue;
    const list = buckets.get(w.category) ?? [];
    list.push(w);
    buckets.set(w.category, list);
  }
  return WIDGET_CATEGORY_ORDER.filter((id) => buckets.has(id)).map((category) => ({
    category,
    label: WIDGET_CATEGORY_LABELS[category],
    widgets: buckets.get(category) ?? [],
  }));
}

export function filterPaletteWidgets(widgets: WidgetSpec[], query: string): WidgetSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return widgets;
  return widgets.filter((w) => {
    const zh = w.label["zh-CN"]?.toLowerCase() ?? "";
    const en = w.label.en?.toLowerCase() ?? "";
    return w.type.includes(q) || zh.includes(q) || en.includes(q);
  });
}

export function getWidgetSpec(type: string): WidgetSpec | undefined {
  return byType.get(type);
}

export function isKnownWidgetType(type: string): boolean {
  return byType.has(type);
}
