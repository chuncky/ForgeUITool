/** LVGL-aligned opacity (0–255). Browser-safe — no node:fs. */

export const DEFAULT_STYLE_OPACITY = 255;

/** Style keys that use LVGL opa integers (Forge JSON names). */
export const OPACITY_STYLE_KEYS = [
  "bg_opacity",
  "text_opacity",
  "border_opacity",
  "shadow_opacity",
  "outline_opacity",
  "line_opacity",
  "img_opa",
  "image_opa",
  "bg_img_opacity",
] as const;

export type OpacityStyleKey = (typeof OPACITY_STYLE_KEYS)[number];

const OPACITY_KEY_SET = new Set<string>(OPACITY_STYLE_KEYS);

export function isOpacityStyleKey(key: string): boolean {
  return OPACITY_KEY_SET.has(key);
}

/**
 * Panel-hidden by default (BK `isVisible: false`).
 * Color transparency uses #RRGGBBAA; bg image uses `bg_img_opacity` when image set.
 */
export const PANEL_HIDDEN_OPACITY_KEYS = new Set([
  "bg_opacity",
  "text_opacity",
  "border_opacity",
  "shadow_opacity",
  "outline_opacity",
  "line_opacity",
]);

/** Seeded into WidgetSpec.defaultStyle — BK `*_opa` default 255. */
export const DEFAULT_OPACITY_STYLE_PROPS: Record<string, unknown> = {
  bg_opacity: DEFAULT_STYLE_OPACITY,
  text_opacity: DEFAULT_STYLE_OPACITY,
  border_opacity: DEFAULT_STYLE_OPACITY,
  shadow_opacity: DEFAULT_STYLE_OPACITY,
  outline_opacity: DEFAULT_STYLE_OPACITY,
  bg_img_opacity: DEFAULT_STYLE_OPACITY,
};

/** Spinner wrap: 256→0, -1→255. Empty/invalid → default 255. */
export function wrapOpacity255(value: unknown): number {
  if (value == null || value === "") return DEFAULT_STYLE_OPACITY;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_STYLE_OPACITY;
  return ((n % 256) + 256) % 256;
}

/**
 * Convert LVGL opa (0–255) to CSS alpha (0–1).
 * Missing/invalid → undefined (do not override color).
 */
export function opacityToCss01(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(255, n)) / 255;
}
