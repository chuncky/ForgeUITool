/**
 * Map Forge `long_mode` prop → LVGL 9 enum identifier for product LVGL (xos-package).
 * Beken templates historically used `LV_LABEL_LONG_MODE_*` / `DOTS`; upstream LVGL uses
 * `LV_LABEL_LONG_*` / `DOT` (see xos-package/lvgl/src/widgets/label/lv_label.h).
 */
export function lvLabelLongModeExpr(longMode: unknown): string {
  const raw = String(longMode ?? "WRAP").toUpperCase();
  const key =
    raw === "DOT" || raw === "DOTS"
      ? "DOT"
      : raw === "SCROLL_CIRCULAR" || raw === "SCROLL" || raw === "CLIP" || raw === "WRAP"
        ? raw
        : "WRAP";
  return `LV_LABEL_LONG_${key}`;
}
