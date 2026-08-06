/** Shared widget type → icon glyph (控件库 + 属性面板). */

export const WIDGET_ICON_CHARS: Record<string, string> = {
  screen: "▭",
  container: "▢",
  label: "T",
  button: "⬚",
  image: "🖼",
  slider: "─",
  switch: "◑",
  checkbox: "☑",
  bar: "▬",
  arc: "◔",
  dropdown: "▾",
  textarea: "¶",
  list: "☰",
  roller: "◎",
  imagebutton: "🖼",
  spinner: "◌",
  tabview: "▤",
  keyboard: "⌨",
  msgbox: "💬",
  line: "─",
  led: "●",
  animimg: "🎞",
  spinbox: "#",
  canvas: "▣",
  qrcode: "▦",
  barcode: "|||",
  digitalclock: "🕐",
  tileview: "▦",
  win: "🗔",
  menu: "☰",
  spangroup: "T+",
  table: "⊞",
  buttonmatrix: "⊟",
  scale: "📏",
  calendar: "📅",
  linechart: "📈",
  barchart: "📊",
  scatterchart: "∙∙",
  chart: "📉",
};

export function widgetIconChar(typeOrIcon: string | undefined): string {
  if (!typeOrIcon) return "?";
  return WIDGET_ICON_CHARS[typeOrIcon] ?? typeOrIcon.slice(0, 1).toUpperCase();
}
