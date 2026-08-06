import { isUsableDataUrl } from "./asset-url.js";
import { buttonCaptionOverflowCss, textLongModeOverflowCss } from "./button-prop-display-contract.js";
import {
  CANVAS_DEFAULT_FONT_FAMILY,
  CANVAS_DEFAULT_FONT_SIZE,
  canvasTextLineHeightPx,
} from "./lvgl-font-metrics.js";
import { resolveCanvasStyleProps } from "./style.js";
import { styleSubgroupsForWidget } from "./style-fields.js";

export type CanvasChromeStyle = Record<string, string | number | undefined>;

export type CanvasChromeInput = {
  type: string;
  frame: { x: number; y: number; w: number; h: number; rotation?: number };
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  /** Live drag/resize override */
  liveFrame?: { x: number; y: number; w: number; h: number; rotation?: number } | null;
  animPreview?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
    opacity?: number;
  } | null;
  /**
   * FR-016e-a: already-resolved data URL for bg_image (required for visible bg).
   * Raw `assets/…` paths must NOT be passed here — they will be ignored.
   */
  resolvedBgImage?: string | null;
  /** Registered CSS font-family (forgeui-font-*) for text_font */
  resolvedFontFamily?: string | null;
};

/** Convert Forge #RRGGBB / #RRGGBBAA to CSS color. */
export function forgeColorToCss(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const raw = value.trim();
  if (raw.startsWith("rgba") || raw.startsWith("rgb") || raw.startsWith("hsl")) return raw;
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const a = Number.parseInt(hex.slice(6, 8), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
  }
  return raw.startsWith("#") ? raw : fallback;
}

function opa01(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n > 1 ? n / 255 : n));
}

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Apply LVGL 0–255 (or 0–1) opacity onto a CSS color. */
export function withAlpha(cssColor: string | undefined, opa: number | undefined): string | undefined {
  if (!cssColor) return undefined;
  if (opa == null || opa >= 1) return cssColor;
  const m = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${opa})`;
  if (cssColor.startsWith("#") && cssColor.length === 7) {
    const r = Number.parseInt(cssColor.slice(1, 3), 16);
    const g = Number.parseInt(cssColor.slice(3, 5), 16);
    const b = Number.parseInt(cssColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opa})`;
  }
  return cssColor;
}

function textAlignCss(value: unknown): string | undefined {
  const v = String(value ?? "").toLowerCase();
  if (v === "left" || v === "center" || v === "right") return v;
  if (v === "auto") return "start";
  return undefined;
}

function textDecorCss(value: unknown): string | undefined {
  const v = String(value ?? "").toLowerCase();
  if (v === "underline") return "underline";
  if (v === "strikethrough") return "line-through";
  if (v === "none") return "none";
  return undefined;
}

function flexJustify(align: string | undefined): string {
  if (align === "left" || align === "start") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/**
 * Map node frame + style + preview_state → CSS for approximate canvas chrome.
 * Used by WidgetView; unit-tested for button property coverage (FR-016e).
 */
export function buildWidgetCanvasChrome(input: CanvasChromeInput): CanvasChromeStyle {
  const f = input.liveFrame ?? input.frame;
  const preview = input.animPreview;
  const x = preview?.x ?? f.x;
  const y = preview?.y ?? f.y;
  const w = preview?.w ?? f.w;
  const h = preview?.h ?? f.h;
  const rot = preview?.rotation ?? f.rotation;
  const previewState = String(input.props?.preview_state ?? "default").toLowerCase();
  const def = resolveCanvasStyleProps(input.style, previewState);
  const isButton = input.type === "button";

  const bgOpa = opa01(def.bg_opacity);
  const textOpa = opa01(def.text_opacity);
  const borderOpa = opa01(def.border_opacity);
  const shadowOpa = opa01(def.shadow_opacity);
  const outlineOpa = opa01(def.outline_opacity);

  const bgColor = forgeColorToCss(def.bg_color, isButton ? "#334e68" : undefined);
  const gradColor = forgeColorToCss(def.bg_grad_color);
  const gradDir = String(def.bg_grad_dir ?? "none").toLowerCase();
  let background: string | undefined = withAlpha(bgColor, bgOpa) ?? (isButton ? "#334e68" : "transparent");
  if (gradDir === "hor" && bgColor && gradColor) {
    background = `linear-gradient(to right, ${withAlpha(bgColor, bgOpa)}, ${withAlpha(gradColor, bgOpa)})`;
  } else if (gradDir === "ver" && bgColor && gradColor) {
    background = `linear-gradient(to bottom, ${withAlpha(bgColor, bgOpa)}, ${withAlpha(gradColor, bgOpa)})`;
  }

  // FR-016e-a: only usable data URLs — never raw assets/ paths (Vite origin 404).
  const resolved =
    (isUsableDataUrl(input.resolvedBgImage) && input.resolvedBgImage) ||
    (isUsableDataUrl(def.bg_image) && String(def.bg_image)) ||
    "";
  const backgroundImage = resolved ? `url("${resolved}")` : undefined;

  const radius = num(def.radius);
  const borderW = num(def.border_width);
  const borderColor = withAlpha(forgeColorToCss(def.border_color, "#94a3b8"), borderOpa);
  const shadowW = num(def.shadow_width);
  const shadowColor = withAlpha(forgeColorToCss(def.shadow_color, "#000000"), shadowOpa ?? 0.35);
  const shadowX = num(def.shadow_ofs_x) ?? 0;
  const shadowY = num(def.shadow_ofs_y) ?? 0;
  const outlineW = num(def.outline_width);
  const outlineColor = withAlpha(forgeColorToCss(def.outline_color, "#60a5fa"), outlineOpa);

  const padT = num(def.pad_top);
  const padR = num(def.pad_right);
  const padB = num(def.pad_bottom);
  const padL = num(def.pad_left);
  const hasPad = [padT, padR, padB, padL].some((v) => v != null);

  const align =
    textAlignCss(def.text_align) ??
    // legacy projects may still have props.text_align (removed from registry)
    textAlignCss(input.props?.text_align);
  const letter = num(def.text_letter_space);
  const lineSpace = num(def.text_line_space);
  const decor = textDecorCss(def.text_decor);
  // BK / LV_FONT_DEFAULT: 14px Montserrat when unset
  const fontSize = num(def.text_font_size) ?? CANVAS_DEFAULT_FONT_SIZE;
  const fontFamily =
    (typeof input.resolvedFontFamily === "string" && input.resolvedFontFamily.trim()) ||
    CANVAS_DEFAULT_FONT_FAMILY;

  const flags = Array.isArray(input.props?.lvgl_flags)
    ? (input.props!.lvgl_flags as unknown[]).map((flag) => String(flag).toUpperCase())
    : null;
  const clickable = flags == null ? true : flags.includes("CLICKABLE");

  let outline: string | undefined;
  if (outlineW != null && outlineW > 0 && outlineColor) {
    outline = `${outlineW}px solid ${outlineColor}`;
  } else if (previewState === "focused") {
    outline = "2px solid #60a5fa";
  } else if (previewState === "disabled") {
    outline = "1px dashed #64748b";
  } else if (previewState === "pressed") {
    outline = "2px solid #f59e0b";
  } else if (previewState === "checked") {
    outline = "2px solid #34d399";
  }

  let filter: string | undefined;
  if (previewState === "disabled") filter = "grayscale(0.35)";
  else if (previewState === "pressed") filter = "brightness(0.88)";

  let opacity: number | undefined;
  if (preview?.opacity != null) {
    opacity = Math.max(0, Math.min(1, preview.opacity / 255));
  } else if (previewState === "disabled") {
    opacity = 0.55;
  } else if (previewState === "pressed") {
    opacity = 0.92;
  }

  // Match LVGL montserrat line_height (e.g. 14→16), not CSS size×1.3
  const lineHeightPx = canvasTextLineHeightPx(fontSize, lineSpace);

  const style: CanvasChromeStyle = {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
    transform: rot ? `rotate(${rot}deg)` : undefined,
    transformOrigin: "center center",
    color: withAlpha(forgeColorToCss(def.text_color, "#F0F4F8"), textOpa) ?? "#F0F4F8",
    background,
    backgroundImage,
    backgroundSize: backgroundImage ? "cover" : undefined,
    backgroundPosition: backgroundImage ? "center" : undefined,
    backgroundRepeat: backgroundImage ? "no-repeat" : undefined,
    borderRadius: radius != null ? `${radius}px` : isButton ? "6px" : undefined,
    overflow: num(def.clip_corner) ? "hidden" : undefined,
    border:
      borderW != null && borderW > 0
        ? `${borderW}px solid ${borderColor ?? "#94a3b8"}`
        : undefined,
    boxShadow:
      shadowW != null && shadowW > 0
        ? `${shadowX}px ${shadowY}px ${shadowW}px ${shadowColor ?? "rgba(0,0,0,0.35)"}`
        : undefined,
    outline,
    filter,
    opacity,
    letterSpacing: letter != null ? `${letter}px` : undefined,
    lineHeight: `${lineHeightPx}px`,
    textAlign: align,
    textDecoration: decor,
    fontFamily,
    fontSize: `${fontSize}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: flexJustify(align),
    padding: hasPad
      ? `${padT ?? 0}px ${padR ?? 0}px ${padB ?? 0}px ${padL ?? 0}px`
      : undefined,
    cursor: flags == null ? undefined : clickable ? "pointer" : "not-allowed",
    boxSizing: "border-box",
  };

  if (isButton) {
    const overflowCss = buttonCaptionOverflowCss(input.props?.long_mode);
    style.whiteSpace = overflowCss.whiteSpace;
    style.textOverflow = overflowCss.textOverflow;
    if (overflowCss.overflow && !style.overflow) {
      style.overflow = overflowCss.overflow;
    }
  } else if (input.type === "label") {
    const overflowCss = textLongModeOverflowCss(input.props?.long_mode);
    style.whiteSpace = overflowCss.whiteSpace;
    style.textOverflow = overflowCss.textOverflow;
    if (overflowCss.overflow) {
      style.overflow = overflowCss.overflow;
    }
    if (overflowCss.whiteSpace === "normal") {
      style.alignItems = "flex-start";
    }
  }

  return style;
}

/** Geometry keys applied to the selection shell (must stay overflow:visible). */
export const CANVAS_CHROME_SHELL_KEYS = [
  "left",
  "top",
  "width",
  "height",
  "transform",
  "transformOrigin",
  "cursor",
] as const;

/**
 * Split chrome so selection handles can live on an overflow:visible shell
 * while long_mode / clip_corner overflow stays on the body (BK CanvasComponent).
 */
export function splitCanvasChrome(style: CanvasChromeStyle): {
  shell: CanvasChromeStyle;
  body: CanvasChromeStyle;
} {
  const shell: CanvasChromeStyle = {};
  const body: CanvasChromeStyle = {};
  const shellKeySet = new Set<string>(CANVAS_CHROME_SHELL_KEYS);
  for (const [key, value] of Object.entries(style)) {
    if (shellKeySet.has(key)) shell[key] = value;
    else body[key] = value;
  }
  body.position = "absolute";
  body.left = 0;
  body.top = 0;
  body.width = "100%";
  body.height = "100%";
  body.boxSizing = "border-box";
  return { shell, body };
}

/** Style keys exposed for button in the property panel (must paint on canvas). */
export const BUTTON_CANVAS_STYLE_KEYS = styleSubgroupsForWidget("button").flatMap((g) =>
  g.fields.map((f) => f.key),
);

/** Non-style props that must be visible on canvas for button. */
export const BUTTON_CANVAS_PROP_KEYS = ["text", "preview_state", "lvgl_flags"] as const;
