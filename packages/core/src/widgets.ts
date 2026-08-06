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
  /** When type is text/string: use textarea (e.g. dropdown options, one per line). */
  multiline?: boolean;
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

export type ExtraDataEditorKind = "items" | "tabs" | "buttons" | "series" | "cells" | "keymap" | "frames";

export interface WidgetSpec {
  type: string;
  category: WidgetCategoryId;
  icon?: string;
  lvgl: { create: string; major: number[] };
  label: { "zh-CN": string; en?: string };
  isContainer: boolean;
  defaultFrame: { w: number; h: number };
  props: PropSpec[];
  /**
   * Contract: each props[].name that affects create-time LVGL APIs must list the
   * C identifiers CodeGen will emit (FR-016d). Empty-prop widgets use extraData only.
   */
  lvglPropApis?: Record<string, string[]>;
  styleParts: string[];
  events: string[];
  codegen: { templatePartial: string };
  /** V1-B inline extraData editor kind (FR-016b) */
  extraDataEditor?: ExtraDataEditorKind;
  defaultExtraData?: Record<string, unknown>;
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
        name: "is_text_static",
        type: "boolean",
        label: "静态文本",
        default: false,
      },
      {
        name: "long_mode",
        type: "enum",
        label: "长文本模式",
        default: "WRAP",
        enum: ["WRAP", "DOTS", "SCROLL", "SCROLL_CIRCULAR", "CLIP"],
        enumLabels: {
          WRAP: "换行",
          DOTS: "省略号",
          SCROLL: "滚动",
          SCROLL_CIRCULAR: "循环滚动",
          CLIP: "裁剪",
        },
      },
    ],
    lvglPropApis: {
      text: ["lv_label_set_text", "lv_label_set_text_static"],
      is_text_static: ["lv_label_set_text_static"],
      long_mode: ["lv_label_set_long_mode"],
    },
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
    props: [
      { name: "text", type: "text", label: "文本", default: "Button" },
      {
        name: "long_mode",
        type: "enum",
        label: "长文本模式",
        default: "WRAP",
        enum: ["WRAP", "DOTS", "SCROLL", "SCROLL_CIRCULAR", "CLIP"],
        enumLabels: {
          WRAP: "换行",
          DOTS: "省略号",
          SCROLL: "滚动",
          SCROLL_CIRCULAR: "循环滚动",
          CLIP: "裁剪",
        },
      },
    ],
    lvglPropApis: {
      text: ["lv_label_set_text"],
      long_mode: ["lv_label_set_long_mode"],
    },
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
    lvglPropApis: { src: ["lv_image_set_src"] },
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
      {
        name: "mode",
        type: "enum",
        label: "滑条模式",
        default: "NORMAL",
        enum: ["NORMAL", "SYMMETRICAL", "RANGE"],
        enumLabels: { NORMAL: "普通", SYMMETRICAL: "对称", RANGE: "区间" },
      },
    ],
    lvglPropApis: {
      range: ["lv_slider_set_range"],
      value: ["lv_slider_set_value"],
      mode: ["lv_slider_set_mode"],
    },
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
    lvglPropApis: { checked: ["LV_STATE_CHECKED"] },
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
    lvglPropApis: {
      text: ["lv_checkbox_set_text"],
      checked: ["LV_STATE_CHECKED"],
    },
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
      {
        name: "mode",
        type: "enum",
        label: "进度条模式",
        default: "NORMAL",
        enum: ["NORMAL", "SYMMETRICAL", "RANGE"],
        enumLabels: { NORMAL: "普通", SYMMETRICAL: "对称", RANGE: "区间" },
      },
    ],
    lvglPropApis: {
      range: ["lv_bar_set_range"],
      value: ["lv_bar_set_value"],
      mode: ["lv_bar_set_mode"],
    },
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
      { name: "bg_start_angle", type: "number", label: "背景起始角", default: 135 },
      { name: "bg_end_angle", type: "number", label: "背景结束角", default: 45 },
      { name: "rotation", type: "number", label: "旋转(°)", default: 0 },
    ],
    lvglPropApis: {
      range: ["lv_arc_set_range"],
      value: ["lv_arc_set_value"],
      bg_start_angle: ["lv_arc_set_bg_angles"],
      bg_end_angle: ["lv_arc_set_bg_angles"],
      rotation: ["lv_arc_set_rotation"],
    },
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
    props: [
      {
        name: "options",
        type: "text",
        label: "选项（每行一项）",
        default: "One\nTwo\nThree",
        multiline: true,
      },
    ],
    lvglPropApis: { options: ["lv_dropdown_set_options"] },
    styleParts: ["main", "main_list", "selected_list", "scrollbar_list"],
    events: ["VALUE_CHANGED"],
    extraDataEditor: "items",
    defaultExtraData: { items: [{ text: "One" }, { text: "Two" }, { text: "Three" }] },
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
      { name: "one_line", type: "boolean", label: "单行", default: false },
      { name: "password_mode", type: "boolean", label: "密码模式", default: false },
      { name: "max_length", type: "number", label: "最大长度", default: 0 },
    ],
    lvglPropApis: {
      text: ["lv_textarea_set_text"],
      placeholder: ["lv_textarea_set_placeholder_text"],
      one_line: ["lv_textarea_set_one_line"],
      password_mode: ["lv_textarea_set_password_mode"],
      max_length: ["lv_textarea_set_max_length"],
    },
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
    extraDataEditor: "items",
    defaultExtraData: { items: [{ text: "Item 1" }, { text: "Item 2" }] },
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
        label: "滚轮模式",
        default: "NORMAL",
        enum: ["NORMAL", "INFINITE"],
        enumLabels: { NORMAL: "普通", INFINITE: "无限" },
      },
      { name: "selected", type: "number", label: "选中索引", default: 0 },
    ],
    lvglPropApis: {
      visible_row_count: ["lv_roller_set_visible_row_count"],
      mode: ["lv_roller_set_options"],
      selected: ["lv_roller_set_selected"],
    },
    styleParts: ["main", "selected"],
    events: ["VALUE_CHANGED"],
    extraDataEditor: "items",
    defaultExtraData: { items: [{ text: "A" }, { text: "B" }, { text: "C" }] },
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
      { name: "src_released", type: "imageSrc", label: "释放态图片", default: "" },
      { name: "src_pressed", type: "imageSrc", label: "按下态图片", default: "" },
      { name: "src_checked", type: "imageSrc", label: "选中态图片", default: "" },
    ],
    lvglPropApis: {
      src_released: ["lv_imagebutton_set_src"],
      src_pressed: ["lv_imagebutton_set_src"],
      src_checked: ["lv_imagebutton_set_src"],
    },
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
      { name: "anim_time", type: "number", label: "动画时长(ms)", default: 1000 },
      { name: "arc_length", type: "number", label: "弧长(°)", default: 60 },
    ],
    lvglPropApis: {
      anim_time: ["lv_spinner_set_anim_params"],
      arc_length: ["lv_spinner_set_anim_params"],
    },
    styleParts: ["main", "indicator"],
    events: [],
    codegen: { templatePartial: "widgets/spinner" },
  },
  {
    type: "tabview",
    category: "layout",
    icon: "tabview",
    lvgl: { create: "lv_tabview_create", major: [9] },
    label: { "zh-CN": "标签视图", en: "Tabview" },
    isContainer: true,
    defaultFrame: { w: 280, h: 160 },
    props: [
      { name: "tab_bar_size", type: "number", label: "标签栏尺寸", default: 50 },
      {
        name: "tab_bar_position",
        type: "enum",
        label: "标签栏位置",
        default: "TOP",
        enum: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        enumLabels: { TOP: "上", BOTTOM: "下", LEFT: "左", RIGHT: "右" },
      },
    ],
    lvglPropApis: {
      tab_bar_size: ["lv_tabview_set_tab_bar_size"],
      tab_bar_position: ["lv_tabview_set_tab_bar_position"],
    },
    styleParts: ["main", "main_tabbar", "main_tabbaritem"],
    events: ["VALUE_CHANGED"],
    extraDataEditor: "tabs",
    defaultExtraData: { tabs: [{ name: "Tab 1" }, { name: "Tab 2" }], selectedTabIndex: 0 },
    codegen: { templatePartial: "widgets/tabview" },
  },
  {
    type: "keyboard",
    category: "input",
    icon: "keyboard",
    lvgl: { create: "lv_keyboard_create", major: [9] },
    label: { "zh-CN": "键盘", en: "Keyboard" },
    isContainer: false,
    defaultFrame: { w: 320, h: 120 },
    props: [
      {
        name: "mode",
        type: "enum",
        label: "键盘模式",
        default: "TEXT_LOWER",
        enum: ["TEXT_LOWER", "TEXT_UPPER", "SPECIAL", "NUMBER"],
        enumLabels: {
          TEXT_LOWER: "小写",
          TEXT_UPPER: "大写",
          SPECIAL: "符号",
          NUMBER: "数字",
        },
      },
    ],
    lvglPropApis: { mode: ["lv_keyboard_set_mode"] },
    styleParts: ["main", "items"],
    events: ["VALUE_CHANGED"],
    extraDataEditor: "keymap",
    defaultExtraData: {
      rows: [
        "1 2 3 4 5 6 7 8 9 0",
        "q w e r t y u i o p",
        "a s d f g h j k l",
        "LV_SYMBOL_OK LV_SYMBOL_CLOSE",
      ],
    },
    codegen: { templatePartial: "widgets/keyboard" },
  },
  {
    type: "msgbox",
    category: "display",
    icon: "msgbox",
    lvgl: { create: "lv_msgbox_create", major: [9] },
    label: { "zh-CN": "消息框", en: "Message box" },
    isContainer: false,
    defaultFrame: { w: 240, h: 120 },
    props: [
      { name: "title", type: "string", label: "标题", default: "Title" },
      { name: "text", type: "text", label: "内容", default: "Message" },
    ],
    lvglPropApis: {
      title: ["lv_msgbox_add_title"],
      text: ["lv_msgbox_add_text"],
    },
    styleParts: ["main", "main_header", "main_content", "main_footer"],
    events: ["CLICKED"],
    extraDataEditor: "buttons",
    defaultExtraData: { buttons: [{ text: "OK" }, { text: "Cancel" }] },
    codegen: { templatePartial: "widgets/msgbox" },
  },
  {
    type: "line",
    category: "viz",
    icon: "line",
    lvgl: { create: "lv_line_create", major: [9] },
    label: { "zh-CN": "线条", en: "Line" },
    isContainer: false,
    defaultFrame: { w: 120, h: 4 },
    props: [
      { name: "y_invert", type: "boolean", label: "Y 轴反转", default: false },
      { name: "points", type: "string", label: "点集 x,y;…", default: "0,0;100,0" },
    ],
    lvglPropApis: {
      y_invert: ["lv_line_set_y_invert"],
      points: ["lv_line_set_points"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/line" },
  },
  {
    type: "led",
    category: "viz",
    icon: "led",
    lvgl: { create: "lv_led_create", major: [9] },
    label: { "zh-CN": "LED", en: "LED" },
    isContainer: false,
    defaultFrame: { w: 24, h: 24 },
    props: [
      { name: "bright", type: "number", label: "亮度", default: 255 },
      { name: "color", type: "color", label: "颜色", default: "#00ff00ff" },
    ],
    lvglPropApis: {
      bright: ["lv_led_set_brightness"],
      color: ["lv_led_set_color"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/led" },
  },
  {
    type: "animimg",
    category: "media",
    icon: "animimg",
    lvgl: { create: "lv_animimg_create", major: [9] },
    label: { "zh-CN": "动画图片", en: "Anim image" },
    isContainer: false,
    defaultFrame: { w: 64, h: 64 },
    props: [
      { name: "duration", type: "number", label: "帧间隔(ms)", default: 200 },
      { name: "repeat", type: "boolean", label: "循环", default: true },
    ],
    lvglPropApis: {
      duration: ["lv_animimg_set_duration"],
      repeat: ["lv_animimg_set_repeat_count"],
    },
    styleParts: ["main"],
    events: [],
    extraDataEditor: "frames",
    defaultExtraData: {
      frames: [{ src: "assets/images/frame1.png" }, { src: "assets/images/frame2.png" }, { src: "assets/images/frame3.png" }],
    },
    codegen: { templatePartial: "widgets/animimg" },
  },
  {
    type: "spinbox",
    category: "input",
    icon: "spinbox",
    lvgl: { create: "lv_spinbox_create", major: [9] },
    label: { "zh-CN": "数字输入框", en: "Spinbox" },
    isContainer: false,
    defaultFrame: { w: 100, h: 36 },
    props: [
      { name: "value", type: "number", label: "值", default: 0 },
      { name: "range_min", type: "number", label: "最小值", default: 0 },
      { name: "range_max", type: "number", label: "最大值", default: 999 },
      { name: "digit_count", type: "number", label: "总位数", default: 3 },
      { name: "separator_position", type: "number", label: "小数点位置", default: 0 },
      { name: "step", type: "number", label: "步进", default: 1 },
    ],
    lvglPropApis: {
      value: ["lv_spinbox_set_value"],
      range_min: ["lv_spinbox_set_range"],
      range_max: ["lv_spinbox_set_range"],
      digit_count: ["lv_spinbox_set_digit_format"],
      separator_position: ["lv_spinbox_set_digit_format"],
      step: ["lv_spinbox_set_step"],
    },
    styleParts: ["main", "cursor"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/spinbox" },
  },
  {
    type: "canvas",
    category: "media",
    icon: "canvas",
    lvgl: { create: "lv_canvas_create", major: [9] },
    label: { "zh-CN": "画布", en: "Canvas" },
    isContainer: false,
    defaultFrame: { w: 120, h: 80 },
    props: [
      { name: "bg_color", type: "color", label: "背景色", default: "#ffffff00" },
    ],
    lvglPropApis: {
      bg_color: ["lv_obj_set_style_bg_color", "lv_obj_set_style_bg_opa"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/canvas" },
  },
  {
    type: "qrcode",
    category: "viz",
    icon: "qrcode",
    lvgl: { create: "lv_qrcode_create", major: [9] },
    label: { "zh-CN": "二维码", en: "QR code" },
    isContainer: false,
    defaultFrame: { w: 80, h: 80 },
    props: [
      { name: "qr_size", type: "number", label: "尺寸", default: 80 },
      { name: "qr_data", type: "string", label: "内容", default: "https://forgeui.local" },
      { name: "dark_color", type: "color", label: "深色", default: "#000000ff" },
      { name: "light_color", type: "color", label: "浅色", default: "#ffffffff" },
    ],
    lvglPropApis: {
      qr_size: ["lv_qrcode_set_size"],
      qr_data: ["lv_qrcode_update"],
      dark_color: ["lv_qrcode_set_dark_color"],
      light_color: ["lv_qrcode_set_light_color"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/qrcode" },
  },
  {
    type: "barcode",
    category: "viz",
    icon: "barcode",
    lvgl: { create: "lv_barcode_create", major: [9] },
    label: { "zh-CN": "条形码", en: "Barcode" },
    isContainer: false,
    defaultFrame: { w: 160, h: 48 },
    props: [
      { name: "barcode_data", type: "string", label: "数据", default: "1234567890" },
      { name: "scale", type: "number", label: "缩放", default: 1 },
    ],
    lvglPropApis: {
      barcode_data: ["lv_barcode_update"],
      scale: ["lv_barcode_set_scale"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/barcode" },
  },
  {
    type: "digitalclock",
    category: "display",
    icon: "digitalclock",
    lvgl: { create: "lv_label_create", major: [9] },
    label: { "zh-CN": "数字时钟", en: "Digital clock" },
    isContainer: false,
    defaultFrame: { w: 120, h: 32 },
    props: [
      { name: "initial_time", type: "string", label: "初始时间", default: "12:00:00" },
      { name: "show_second", type: "boolean", label: "显示秒", default: true },
      {
        name: "format",
        type: "enum",
        label: "格式",
        default: "HMS",
        enum: ["HM", "HMS"],
        enumLabels: { HM: "时:分", HMS: "时:分:秒" },
      },
    ],
    lvglPropApis: {
      initial_time: ["lv_label_set_text"],
      show_second: ["lv_label_set_text"],
      format: ["lv_label_set_text"],
    },
    styleParts: ["main"],
    events: [],
    codegen: { templatePartial: "widgets/digitalclock" },
  },
  {
    type: "tileview",
    category: "layout",
    icon: "tileview",
    lvgl: { create: "lv_tileview_create", major: [9] },
    label: { "zh-CN": "平铺视图", en: "Tileview" },
    isContainer: true,
    defaultFrame: { w: 240, h: 160 },
    props: [],
    styleParts: ["main", "scrollbar"],
    events: ["VALUE_CHANGED"],
    extraDataEditor: "tabs",
    defaultExtraData: { tabs: [{ name: "Tile 1" }, { name: "Tile 2" }] },
    codegen: { templatePartial: "widgets/tileview" },
  },
  {
    type: "win",
    category: "layout",
    icon: "win",
    lvgl: { create: "lv_win_create", major: [9] },
    label: { "zh-CN": "窗口", en: "Window" },
    isContainer: true,
    defaultFrame: { w: 200, h: 140 },
    props: [
      { name: "title", type: "string", label: "标题", default: "Window" },
      { name: "header_height", type: "number", label: "标题栏高度", default: 32 },
    ],
    lvglPropApis: {
      title: ["lv_win_add_title"],
      header_height: ["lv_win_get_header", "lv_obj_set_height"],
    },
    styleParts: ["main", "main_header", "main_content", "main_button"],
    events: ["CLICKED"],
    codegen: { templatePartial: "widgets/win" },
  },
  {
    type: "menu",
    category: "layout",
    icon: "menu",
    lvgl: { create: "lv_menu_create", major: [9] },
    label: { "zh-CN": "菜单", en: "Menu" },
    isContainer: true,
    defaultFrame: { w: 200, h: 180 },
    props: [],
    styleParts: ["main", "main_sidebar", "main_item"],
    events: ["CLICKED"],
    extraDataEditor: "items",
    defaultExtraData: { items: [{ text: "Home" }, { text: "Settings" }] },
    codegen: { templatePartial: "widgets/menu" },
  },
  {
    type: "spangroup",
    category: "display",
    icon: "spangroup",
    lvgl: { create: "lv_spangroup_create", major: [9] },
    label: { "zh-CN": "文本组", en: "Span group" },
    isContainer: false,
    defaultFrame: { w: 160, h: 48 },
    props: [],
    styleParts: ["main"],
    events: [],
    extraDataEditor: "items",
    defaultExtraData: { items: [{ text: "Span 1" }, { text: "Span 2" }] },
    codegen: { templatePartial: "widgets/spangroup" },
  },
  {
    type: "table",
    category: "display",
    icon: "table",
    lvgl: { create: "lv_table_create", major: [9] },
    label: { "zh-CN": "表格", en: "Table" },
    isContainer: false,
    defaultFrame: { w: 200, h: 120 },
    props: [
      { name: "row_cnt", type: "number", label: "行数", default: 3 },
      { name: "col_cnt", type: "number", label: "列数", default: 2 },
    ],
    lvglPropApis: {
      row_cnt: ["lv_table_set_row_count"],
      col_cnt: ["lv_table_set_column_count"],
    },
    styleParts: ["main", "items"],
    events: ["CLICKED"],
    extraDataEditor: "cells",
    defaultExtraData: {
      cells: [
        ["Header 1", "Header 2"],
        ["Cell 1", "Cell 2"],
        ["Cell 3", "Cell 4"],
      ],
    },
    codegen: { templatePartial: "widgets/table" },
  },
  {
    type: "buttonmatrix",
    category: "button",
    icon: "buttonmatrix",
    lvgl: { create: "lv_buttonmatrix_create", major: [9] },
    label: { "zh-CN": "按钮矩阵", en: "Button matrix" },
    isContainer: false,
    defaultFrame: { w: 200, h: 80 },
    props: [
      { name: "col_cnt", type: "number", label: "每行列数", default: 3 },
    ],
    lvglPropApis: { col_cnt: ["lv_buttonmatrix_set_map"] },
    styleParts: ["main", "items"],
    events: ["CLICKED", "VALUE_CHANGED"],
    extraDataEditor: "items",
    defaultExtraData: {
      items: [{ text: "1" }, { text: "2" }, { text: "3" }, { text: "4" }, { text: "5" }, { text: "6" }],
    },
    codegen: { templatePartial: "widgets/buttonmatrix" },
  },
  {
    type: "scale",
    category: "viz",
    icon: "scale",
    lvgl: { create: "lv_scale_create", major: [9] },
    label: { "zh-CN": "刻度", en: "Scale" },
    isContainer: false,
    defaultFrame: { w: 160, h: 48 },
    props: [
      { name: "tick_cnt", type: "number", label: "刻度数", default: 10 },
      { name: "major_tick_every", type: "number", label: "主刻度间隔", default: 5 },
      { name: "angle_range", type: "number", label: "角度范围", default: 270 },
      { name: "range_min", type: "number", label: "最小值", default: 0 },
      { name: "range_max", type: "number", label: "最大值", default: 100 },
      {
        name: "mode",
        type: "enum",
        label: "刻度模式",
        default: "HORIZONTAL_BOTTOM",
        enum: ["HORIZONTAL_TOP", "HORIZONTAL_BOTTOM", "VERTICAL_LEFT", "VERTICAL_RIGHT", "ROUND_INNER", "ROUND_OUTER"],
        enumLabels: {
          HORIZONTAL_TOP: "水平上",
          HORIZONTAL_BOTTOM: "水平下",
          VERTICAL_LEFT: "垂直左",
          VERTICAL_RIGHT: "垂直右",
          ROUND_INNER: "圆内",
          ROUND_OUTER: "圆外",
        },
      },
    ],
    lvglPropApis: {
      tick_cnt: ["lv_scale_set_total_tick_count"],
      major_tick_every: ["lv_scale_set_major_tick_every"],
      angle_range: ["lv_scale_set_angle_range"],
      range_min: ["lv_scale_set_range"],
      range_max: ["lv_scale_set_range"],
      mode: ["lv_scale_set_mode"],
    },
    styleParts: ["main", "items", "indicator"],
    events: [],
    codegen: { templatePartial: "widgets/scale" },
  },
  {
    type: "calendar",
    category: "display",
    icon: "calendar",
    lvgl: { create: "lv_calendar_create", major: [9] },
    label: { "zh-CN": "日历", en: "Calendar" },
    isContainer: false,
    defaultFrame: { w: 200, h: 180 },
    props: [
      { name: "today_year", type: "number", label: "年", default: 2026 },
      { name: "today_month", type: "number", label: "月", default: 8 },
      { name: "today_day", type: "number", label: "日", default: 1 },
    ],
    lvglPropApis: {
      today_year: ["lv_calendar_set_today_date"],
      today_month: ["lv_calendar_set_today_date"],
      today_day: ["lv_calendar_set_today_date"],
    },
    styleParts: ["main", "main_header", "main_buttonmatrix", "items_buttonmatrix"],
    events: ["VALUE_CHANGED"],
    codegen: { templatePartial: "widgets/calendar" },
  },
  {
    type: "linechart",
    category: "viz",
    icon: "linechart",
    lvgl: { create: "lv_chart_create", major: [9] },
    label: { "zh-CN": "线图", en: "Line chart" },
    isContainer: false,
    defaultFrame: { w: 200, h: 120 },
    props: [
      { name: "point_count", type: "number", label: "点数", default: 10 },
      { name: "enable_secondary_y", type: "boolean", label: "次 Y 轴", default: false },
      {
        name: "chart_type",
        type: "enum",
        label: "图表类型",
        default: "LINE",
        enum: ["LINE"],
        enumLabels: { LINE: "折线" },
      },
    ],
    lvglPropApis: {
      point_count: ["lv_chart_set_point_count"],
      chart_type: ["lv_chart_set_type"],
      enable_secondary_y: ["lv_chart_add_series"],
    },
    styleParts: ["main"],
    events: [],
    extraDataEditor: "series",
    defaultExtraData: {
      series: [{ name: "Series 1", color: "#4a90e2", values: [10, 20, 30, 40, 50, 10, 30, 50, 30, 10] }],
    },
    codegen: { templatePartial: "widgets/linechart" },
  },
  {
    type: "barchart",
    category: "viz",
    icon: "barchart",
    lvgl: { create: "lv_chart_create", major: [9] },
    label: { "zh-CN": "柱状图", en: "Bar chart" },
    isContainer: false,
    defaultFrame: { w: 200, h: 120 },
    props: [
      { name: "point_count", type: "number", label: "点数", default: 10 },
      { name: "enable_secondary_y", type: "boolean", label: "次 Y 轴", default: false },
      {
        name: "chart_type",
        type: "enum",
        label: "图表类型",
        default: "BAR",
        enum: ["BAR"],
        enumLabels: { BAR: "柱状" },
      },
    ],
    lvglPropApis: {
      point_count: ["lv_chart_set_point_count"],
      chart_type: ["lv_chart_set_type"],
      enable_secondary_y: ["lv_chart_add_series"],
    },
    styleParts: ["main"],
    events: [],
    extraDataEditor: "series",
    defaultExtraData: {
      series: [{ name: "Series 1", color: "#50c878", values: [10, 20, 30, 40, 50, 10, 30, 50, 30, 10] }],
    },
    codegen: { templatePartial: "widgets/barchart" },
  },
  {
    type: "scatterchart",
    category: "viz",
    icon: "scatterchart",
    lvgl: { create: "lv_chart_create", major: [9] },
    label: { "zh-CN": "散点图", en: "Scatter chart" },
    isContainer: false,
    defaultFrame: { w: 200, h: 120 },
    props: [
      { name: "point_count", type: "number", label: "点数", default: 10 },
      { name: "enable_secondary_y", type: "boolean", label: "次 Y 轴", default: false },
      {
        name: "chart_type",
        type: "enum",
        label: "图表类型",
        default: "SCATTER",
        enum: ["SCATTER"],
        enumLabels: { SCATTER: "散点" },
      },
    ],
    lvglPropApis: {
      point_count: ["lv_chart_set_point_count"],
      chart_type: ["lv_chart_set_type"],
      enable_secondary_y: ["lv_chart_add_series"],
    },
    styleParts: ["main", "items"],
    events: [],
    extraDataEditor: "series",
    defaultExtraData: {
      series: [{ name: "Series 1", color: "#e94e77", values: [10, 20, 30, 40, 50, 10, 30, 50, 30, 10] }],
    },
    codegen: { templatePartial: "widgets/scatterchart" },
  },
  {
    type: "chart",
    category: "viz",
    icon: "chart",
    lvgl: { create: "lv_chart_create", major: [9] },
    label: { "zh-CN": "图表", en: "Chart" },
    isContainer: false,
    defaultFrame: { w: 200, h: 120 },
    props: [
      { name: "point_count", type: "number", label: "点数", default: 10 },
      { name: "div_line_count_h", type: "number", label: "水平分割线", default: 5 },
      { name: "div_line_count_v", type: "number", label: "垂直分割线", default: 5 },
      {
        name: "chart_type",
        type: "enum",
        label: "图表类型",
        default: "LINE",
        enum: ["LINE", "BAR", "SCATTER"],
        enumLabels: { LINE: "折线", BAR: "柱状", SCATTER: "散点" },
      },
    ],
    lvglPropApis: {
      point_count: ["lv_chart_set_point_count"],
      div_line_count_h: ["lv_chart_set_div_line_count"],
      div_line_count_v: ["lv_chart_set_div_line_count"],
      chart_type: ["lv_chart_set_type"],
    },
    styleParts: ["main", "series"],
    events: [],
    extraDataEditor: "series",
    defaultExtraData: {
      series: [
        { name: "Series 1", color: "#4a90e2", values: [10, 20, 30, 40, 50, 10, 30, 50, 30, 10] },
        { name: "Series 2", color: "#bd93f9", values: [5, 15, 25, 35, 45, 15, 25, 35, 25, 15] },
      ],
    },
    codegen: { templatePartial: "widgets/chart" },
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
