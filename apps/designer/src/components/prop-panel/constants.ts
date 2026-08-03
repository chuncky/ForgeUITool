/** LVGL 9.x object flags for behavior group (stored in props.lvgl_flags). */
export const LVGL_OBJECT_FLAGS = [
  { id: "CLICKABLE", label: "可点击 CLICKABLE" },
  { id: "SCROLLABLE", label: "可滚动 SCROLLABLE" },
  { id: "SCROLL_CHAIN_HOR", label: "水平滚动链 SCROLL_CHAIN_HOR" },
  { id: "SCROLL_CHAIN_VER", label: "垂直滚动链 SCROLL_CHAIN_VER" },
  { id: "SCROLL_ELASTIC", label: "弹性滚动 SCROLL_ELASTIC" },
  { id: "SCROLL_MOMENTUM", label: "惯性滚动 SCROLL_MOMENTUM" },
  { id: "SNAPPABLE", label: "可对齐 SNAPPABLE" },
  { id: "PRESS_LOCK", label: "按下锁定 PRESS_LOCK" },
] as const;

export const PREVIEW_STATES = [
  { id: "default", label: "Default（默认）" },
  { id: "pressed", label: "Pressed（按下）" },
  { id: "focused", label: "Focused（聚焦）" },
  { id: "disabled", label: "Disabled（禁用）" },
  { id: "checked", label: "Checked（选中）" },
] as const;

export const STYLE_STATES = [
  "default",
  "pressed",
  "focused",
  "disabled",
  "checked",
] as const;

export function partLabel(part: string): string {
  return part.replace(/_/g, " ").toUpperCase();
}
