import type { WidgetIR } from "@forgeui/core";
import { normalizeStyle, resolveColorValue, isStyleKeyDisabled, type FontAsset, type NamedColor } from "@forgeui/core";
import { fontRefForStyle, builtinFontExprForSize } from "./font-emit.js";
import { imageSymbolForPath, type EmittedImage } from "./image-emit.js";

const PART_TO_LVGL: Record<string, string> = {
  main: "LV_PART_MAIN",
  indicator: "LV_PART_INDICATOR",
  knob: "LV_PART_KNOB",
  items: "LV_PART_ITEMS",
  scrollbar: "LV_PART_SCROLLBAR",
  main_button: "LV_PART_MAIN",
  main_item: "LV_PART_ITEMS",
  main_list: "LV_PART_ITEMS",
  selected_list: "LV_PART_ITEMS",
  scrollbar_list: "LV_PART_SCROLLBAR",
  main_header: "LV_PART_MAIN",
  main_content: "LV_PART_MAIN",
  main_footer: "LV_PART_MAIN",
  main_tabbar: "LV_PART_MAIN",
  main_tabbaritem: "LV_PART_ITEMS",
  main_sidebar: "LV_PART_MAIN",
  main_buttonmatrix: "LV_PART_ITEMS",
  items_buttonmatrix: "LV_PART_ITEMS",
  selected: "LV_PART_SELECTED",
  series: "LV_PART_ITEMS",
  cursor: "LV_PART_CURSOR",
};

const STATE_TO_LVGL: Record<string, string> = {
  default: "LV_STATE_DEFAULT",
  pressed: "LV_STATE_PRESSED",
  focused: "LV_STATE_FOCUSED",
  disabled: "LV_STATE_DISABLED",
  checked: "LV_STATE_CHECKED",
  scrolled: "LV_STATE_SCROLLED",
};

type StyleEmitter = (sym: string, selector: string, value: unknown) => string | null;

const STYLE_EMITTERS: Record<string, StyleEmitter> = {
  bg_color: (sym, sel, v) => `  lv_obj_set_style_bg_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  bg_grad_dir: (sym, sel, v) => `  lv_obj_set_style_bg_grad_dir(${sym}, ${gradDir(v)}, ${sel});`,
  bg_grad_color: (sym, sel, v) => `  lv_obj_set_style_bg_grad_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  img_recolor: (sym, sel, v) => `  lv_obj_set_style_image_recolor(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  image_recolor: (sym, sel, v) => `  lv_obj_set_style_image_recolor(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  img_opa: (sym, sel, v) => `  lv_obj_set_style_image_opa(${sym}, ${num(v)}, ${sel});`,
  image_opa: (sym, sel, v) => `  lv_obj_set_style_image_opa(${sym}, ${num(v)}, ${sel});`,
  text_color: (sym, sel, v) => `  lv_obj_set_style_text_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  border_color: (sym, sel, v) => `  lv_obj_set_style_border_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  shadow_color: (sym, sel, v) => `  lv_obj_set_style_shadow_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  line_color: (sym, sel, v) => `  lv_obj_set_style_line_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  radius: (sym, sel, v) => `  lv_obj_set_style_radius(${sym}, ${num(v)}, ${sel});`,
  clip_corner: (sym, sel, v) => `  lv_obj_set_style_clip_corner(${sym}, ${bool(v)}, ${sel});`,
  border_width: (sym, sel, v) => `  lv_obj_set_style_border_width(${sym}, ${num(v)}, ${sel});`,
  shadow_width: (sym, sel, v) => `  lv_obj_set_style_shadow_width(${sym}, ${num(v)}, ${sel});`,
  shadow_ofs_x: (sym, sel, v) => `  lv_obj_set_style_shadow_ofs_x(${sym}, ${num(v)}, ${sel});`,
  shadow_ofs_y: (sym, sel, v) => `  lv_obj_set_style_shadow_ofs_y(${sym}, ${num(v)}, ${sel});`,
  pad_top: (sym, sel, v) => `  lv_obj_set_style_pad_top(${sym}, ${num(v)}, ${sel});`,
  pad_right: (sym, sel, v) => `  lv_obj_set_style_pad_right(${sym}, ${num(v)}, ${sel});`,
  pad_bottom: (sym, sel, v) => `  lv_obj_set_style_pad_bottom(${sym}, ${num(v)}, ${sel});`,
  pad_left: (sym, sel, v) => `  lv_obj_set_style_pad_left(${sym}, ${num(v)}, ${sel});`,
  line_width: (sym, sel, v) => `  lv_obj_set_style_line_width(${sym}, ${num(v)}, ${sel});`,
  bg_opacity: (sym, sel, v) => `  lv_obj_set_style_bg_opa(${sym}, ${num(v)}, ${sel});`,
  text_opacity: (sym, sel, v) => `  lv_obj_set_style_text_opa(${sym}, ${num(v)}, ${sel});`,
  border_opacity: (sym, sel, v) => `  lv_obj_set_style_border_opa(${sym}, ${num(v)}, ${sel});`,
  shadow_opacity: (sym, sel, v) => `  lv_obj_set_style_shadow_opa(${sym}, ${num(v)}, ${sel});`,
  line_opacity: (sym, sel, v) => `  lv_obj_set_style_line_opa(${sym}, ${num(v)}, ${sel});`,
  outline_color: (sym, sel, v) => `  lv_obj_set_style_outline_color(${sym}, lv_color_hex(${colorHex(v)}), ${sel});`,
  outline_width: (sym, sel, v) => `  lv_obj_set_style_outline_width(${sym}, ${num(v)}, ${sel});`,
  outline_opacity: (sym, sel, v) => `  lv_obj_set_style_outline_opa(${sym}, ${num(v)}, ${sel});`,
  text_letter_space: (sym, sel, v) => `  lv_obj_set_style_text_letter_space(${sym}, ${num(v)}, ${sel});`,
  text_line_space: (sym, sel, v) => `  lv_obj_set_style_text_line_space(${sym}, ${num(v)}, ${sel});`,
  text_align: (sym, sel, v) => `  lv_obj_set_style_text_align(${sym}, ${textAlign(v)}, ${sel});`,
  text_decor: (sym, sel, v) => `  lv_obj_set_style_text_decor(${sym}, ${textDecor(v)}, ${sel});`,
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function bool(value: unknown): string {
  return value === true || value === 1 || value === "1" ? "true" : "false";
}

function colorHex(value: unknown): string {
  if (typeof value !== "string") return "0x000000";
  const m = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{6,8}$/.test(m)) return `0x${m.slice(0, 6).toUpperCase()}`;
  return "0x000000";
}

function textAlign(value: unknown): string {
  const s = String(value ?? "left").toLowerCase();
  switch (s) {
    case "center":
      return "LV_TEXT_ALIGN_CENTER";
    case "right":
      return "LV_TEXT_ALIGN_RIGHT";
    case "auto":
      return "LV_TEXT_ALIGN_AUTO";
    case "left":
    default:
      return "LV_TEXT_ALIGN_LEFT";
  }
}

function textDecor(value: unknown): string {
  const s = String(value ?? "none").toLowerCase();
  switch (s) {
    case "underline":
      return "LV_TEXT_DECOR_UNDERLINE";
    case "strikethrough":
      return "LV_TEXT_DECOR_STRIKETHROUGH";
    case "none":
    default:
      return "LV_TEXT_DECOR_NONE";
  }
}

function gradDir(value: unknown): string {
  const s = String(value ?? "none").toLowerCase();
  switch (s) {
    case "hor":
    case "horizontal":
      return "LV_GRAD_DIR_HOR";
    case "ver":
    case "vertical":
      return "LV_GRAD_DIR_VER";
    case "none":
    default:
      return "LV_GRAD_DIR_NONE";
  }
}

function cString(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}

export function lvglSelector(part: string, state: string): string {
  const p = PART_TO_LVGL[part] ?? "LV_PART_MAIN";
  const s = STATE_TO_LVGL[state] ?? "LV_STATE_DEFAULT";
  return `${p} | ${s}`;
}

/** Emit lv_obj_set_style_* lines for all part/state/style keys on a widget. */
export function emitWidgetStyleLines(
  sym: string,
  node: WidgetIR,
  colors: NamedColor[] | undefined,
  fonts: FontAsset[] | undefined,
  emittedImages: EmittedImage[],
  imageIncludes: Set<string>,
  fontIncludes: Set<string>,
): string[] {
  const lines: string[] = [];
  const normalized = normalizeStyle(node.style);
  for (const [part, states] of Object.entries(normalized.parts)) {
    for (const [state, props] of Object.entries(states)) {
      const selector = lvglSelector(part, state);
      // Beken style_text.hbs: font_family + font_size → one lv_obj_set_style_text_font
      const fontFamily = props.text_font;
      const fontSize = props.text_font_size;
      if (typeof fontFamily === "string" && fontFamily.trim() && !isStyleKeyDisabled(node.style, "text_font")) {
        const fontRef = fontRefForStyle(fontFamily, fonts, fontSize);
        if (fontRef) {
          fontIncludes.add(fontRef.include);
          lines.push(`  lv_obj_set_style_text_font(${sym}, ${fontRef.expr}, ${selector});`);
        } else {
          lines.push(`  /* TODO: text_font ${cString(fontFamily)} — import font in designer */`);
        }
      } else if (
        fontSize != null &&
        fontSize !== "" &&
        !isStyleKeyDisabled(node.style, "text_font_size")
      ) {
        // Only size set → BK default family montserrat at that size
        const expr = builtinFontExprForSize(fontSize);
        if (expr) {
          lines.push(`  lv_obj_set_style_text_font(${sym}, ${expr}, ${selector});`);
        }
      }

      for (const [key, raw] of Object.entries(props)) {
        if (isStyleKeyDisabled(node.style, key)) continue;
        if (key === "text_font" || key === "text_font_size") continue;
        if (key === "bg_image" || key === "bg_image_src") {
          const imgSym = imageSymbolForPath(raw, emittedImages);
          if (imgSym) {
            imageIncludes.add(imgSym);
            lines.push(`  lv_obj_set_style_bg_image_src(${sym}, &${imgSym}, ${selector});`);
          } else if (typeof raw === "string" && raw.trim()) {
            lines.push(`  /* TODO: bg_image ${cString(raw)} — import asset in designer */`);
          }
          continue;
        }
        const emitter = STYLE_EMITTERS[key];
        if (!emitter) continue;
        const resolved =
          typeof raw === "string" && raw.startsWith("@") ? resolveColorValue(raw, colors) : raw;
        const line = emitter(sym, selector, resolved);
        if (line) lines.push(line);
      }
    }
  }
  return lines;
}

export { PART_TO_LVGL, STATE_TO_LVGL, STYLE_EMITTERS };
