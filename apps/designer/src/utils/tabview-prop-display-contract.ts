/**
 * FR-016e / BK 对照：标签视图（tabview）属性项 → 画布「实际可用」契约清单。
 * 权威：ref/beken/.../component-specs/tabview/tabview.md + 属性面板截图。
 * 测试：tests/designer_tabview_prop_display_bk.test.ts
 */

import { styleSubgroupsForWidget } from "./style-fields.js";

export type TabviewPropGroup = "geometry" | "props" | "extraData" | "behavior" | "style";

export type TabviewPropDisplayItem = {
  id: string;
  bk: string;
  forge: string;
  group: TabviewPropGroup;
  usableEffect: string;
};

export const TABVIEW_GEOMETRY_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  { id: "geo.x", bk: "x", forge: "frame.x", group: "geometry", usableEffect: "rootStyle.left 变化" },
  { id: "geo.y", bk: "y", forge: "frame.y", group: "geometry", usableEffect: "rootStyle.top 变化" },
  { id: "geo.w", bk: "width", forge: "frame.w", group: "geometry", usableEffect: "rootStyle.width 变化" },
  { id: "geo.h", bk: "height", forge: "frame.h", group: "geometry", usableEffect: "rootStyle.height 变化" },
];

export const TABVIEW_PROPS_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  {
    id: "prop.tab_bar_position",
    bk: "tab_bar_position",
    forge: "props.tab_bar_position",
    group: "props",
    usableEffect: "TOP/BOTTOM/LEFT/RIGHT → flexDirection 可区分",
  },
  {
    id: "prop.tab_bar_size",
    bk: "tab_bar_size",
    forge: "props.tab_bar_size",
    group: "props",
    usableEffect: "标签栏 height/width = barSize px",
  },
];

export const TABVIEW_EXTRADATA_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  {
    id: "extra.tabs.name",
    bk: "extraData.tabs[].name",
    forge: "extraData.tabs",
    group: "extraData",
    usableEffect: "标签栏文案列表变化",
  },
  {
    id: "extra.selectedTabIndex",
    bk: "selectedTabIndex",
    forge: "extraData.selectedTabIndex",
    group: "extraData",
    usableEffect: "选中项 selectedIndex + 标签栏高亮 + 仅显示该页子控件",
  },
];

export const TABVIEW_BEHAVIOR_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  {
    id: "beh.preview_state",
    bk: "state(preview)",
    forge: "props.preview_state",
    group: "behavior",
    usableEffect: "main 样式按 preview_state 合并（如 pressed 叠色）",
  },
  {
    id: "beh.lvgl_flags.CLICKABLE",
    bk: "flags.CLICKABLE",
    forge: "props.lvgl_flags",
    group: "behavior",
    usableEffect: "面板可写；画布 cursor 与通用 chrome 一致时可观测",
  },
];

/** StyleGroup 全量子组（main 默认）——与 styleSubgroupsForWidget('tabview') 同步 */
export const TABVIEW_STYLE_MAIN_DISPLAY_ITEMS: TabviewPropDisplayItem[] = styleSubgroupsForWidget(
  "tabview",
).flatMap((g) =>
  g.fields.map(
    (f): TabviewPropDisplayItem => ({
      id: `style.main.${f.key}`,
      bk:
        f.key === "bg_image"
          ? "bg_img_src"
          : f.key === "bg_img_opacity"
            ? "bg_img_opa"
            : f.key === "bg_opacity"
              ? "bg_opa"
              : f.key === "text_opacity"
                ? "text_opa"
                : f.key,
      forge: `style.parts.main.default.${f.key}`,
      group: "style",
      usableEffect: `main.${f.key} → rootStyle 可区分`,
    }),
  ),
);

/** BK Part TABBAR / TABBAR ITEM 核心可视键 */
export const TABVIEW_STYLE_PART_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  {
    id: "style.tabbar.bg_color",
    bk: "main_tabbar.bg_color",
    forge: "style.parts.main_tabbar.default.bg_color",
    group: "style",
    usableEffect: "barStyle.background 色变化",
  },
  {
    id: "style.tabbaritem.text_color",
    bk: "main_tabbaritem.text_color",
    forge: "style.parts.main_tabbaritem.default.text_color",
    group: "style",
    usableEffect: "itemStyle.color 变化",
  },
  {
    id: "style.tabbaritem.checked.bg_color",
    bk: "main_tabbaritem.checked.bg_color",
    forge: "style.parts.main_tabbaritem.checked.bg_color",
    group: "style",
    usableEffect: "选中项 background 与未选中可区分",
  },
];

export const ALL_TABVIEW_DISPLAY_ITEMS: TabviewPropDisplayItem[] = [
  ...TABVIEW_GEOMETRY_DISPLAY_ITEMS,
  ...TABVIEW_PROPS_DISPLAY_ITEMS,
  ...TABVIEW_EXTRADATA_DISPLAY_ITEMS,
  ...TABVIEW_BEHAVIOR_DISPLAY_ITEMS,
  ...TABVIEW_STYLE_MAIN_DISPLAY_ITEMS,
  ...TABVIEW_STYLE_PART_DISPLAY_ITEMS,
];

export const TABVIEW_BK_NON_CANVAS_ITEMS = [
  { bk: "initialTabIndex", reason: "运行时初始页（属性「起始标签页」）；画布预览跟 selectedTabIndex" },
  { bk: "tabs[].is_name_static", reason: "CodeGen 静态字符串语义" },
  { bk: "tabs[].name_i18nEnabled", reason: "i18n 开关，画布文案仍看 name" },
] as const;
