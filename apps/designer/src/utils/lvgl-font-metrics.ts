/**
 * Align canvas text metrics with LVGL montserrat tables for line-height.
 * Default family/size follow product builtins (SourceHanSansCN-Bold @ 16).
 */
export const CANVAS_DEFAULT_FONT_FAMILY =
  '"forgeui-font-SourceHanSansCN-Bold", "Source Han Sans CN", "Microsoft YaHei", "PingFang SC", sans-serif';

/** BK font panel default size (属性字体字号). */
export const CANVAS_DEFAULT_FONT_SIZE = 16;

const MONTSERRAT_LINE_HEIGHT: Record<number, number> = {
  8: 10,
  10: 12,
  12: 14,
  14: 16,
  16: 18,
  18: 20,
  20: 22,
  22: 25,
  24: 27,
  26: 29,
  28: 32,
  30: 34,
  32: 36,
  34: 39,
  36: 41,
  38: 43,
  40: 45,
  42: 48,
  44: 50,
  46: 52,
  48: 54,
};

/** LVGL montserrat line_height for a px size; fallback size+2. */
export function lvglMontserratLineHeight(fontSizePx: number): number {
  const s = Math.round(fontSizePx);
  if (MONTSERRAT_LINE_HEIGHT[s] != null) return MONTSERRAT_LINE_HEIGHT[s]!;
  return Math.max(1, s + 2);
}

/** Canvas CSS line-height px: montserrat line_height + text_line_space. */
export function canvasTextLineHeightPx(fontSizePx: number, textLineSpace?: number | null): number {
  const base = lvglMontserratLineHeight(fontSizePx);
  const extra = textLineSpace != null && Number.isFinite(textLineSpace) ? Number(textLineSpace) : 0;
  return Math.max(1, base + extra);
}
