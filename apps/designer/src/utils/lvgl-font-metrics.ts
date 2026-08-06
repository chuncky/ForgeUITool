/**
 * Align canvas text metrics with LVGL built-in montserrat (LV_FONT_DEFAULT).
 * line_height values sampled from lv_font_montserrat_*.c in LVGL 9.
 */
export const CANVAS_DEFAULT_FONT_FAMILY =
  '"Montserrat", "DejaVu Sans", "Arial", sans-serif';

/** Beken / LVGL default when style text_font_size is unset. */
export const CANVAS_DEFAULT_FONT_SIZE = 14;

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
