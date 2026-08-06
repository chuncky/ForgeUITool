/** Normalized style lookup — accepts MVP flat or V1 parts/states (§3.5.1 LLD). */

export type StyleProps = Record<string, unknown>;

export interface NormalizedStyle {
  parts: Record<string, Record<string, StyleProps>>;
}

/** V1-B: subgroup id → style keys (eye-toggle / CodeGen skip). */
export const STYLE_SUBGROUP_KEYS: Record<string, readonly string[]> = {
  background: [
    "bg_color",
    "bg_grad_dir",
    "bg_grad_color",
    "bg_image",
    "bg_image_src",
    "bg_opacity",
    "radius",
    "clip_corner",
  ],
  font: [
    "text_color",
    "text_opacity",
    "text_letter_space",
    "text_line_space",
    "text_align",
    "text_font",
    "text_decor",
  ],
  border: ["border_width", "border_color", "border_opacity"],
  shadow: ["shadow_width", "shadow_color", "shadow_opacity", "shadow_ofs_x", "shadow_ofs_y"],
  padding: ["pad_top", "pad_right", "pad_bottom", "pad_left"],
  line: ["line_color", "line_width", "line_opacity"],
  outline: ["outline_width", "outline_color", "outline_opacity"],
  image: ["img_recolor", "image_recolor", "img_opa", "image_opa"],
};

export function readDisabledSubgroups(style: Record<string, unknown> | undefined): string[] {
  const raw = style?.disabledSubgroups;
  return Array.isArray(raw) ? raw.map(String) : [];
}

/** Rebuild style object preserving parts layout + disabledSubgroups meta. */
export function withDisabledSubgroups(
  style: Record<string, unknown> | undefined,
  disabled: string[],
): Record<string, unknown> {
  const n = normalizeStyle(style);
  const useParts = !!(style?.parts && typeof style.parts === "object");
  const base: Record<string, unknown> = useParts ? { parts: n.parts } : { ...n.parts };
  const ids = [...new Set(disabled.map(String).filter(Boolean))];
  if (ids.length) base.disabledSubgroups = ids;
  return base;
}

export function isStyleKeyDisabled(style: Record<string, unknown> | undefined, key: string): boolean {
  for (const id of readDisabledSubgroups(style)) {
    if (STYLE_SUBGROUP_KEYS[id]?.includes(key)) return true;
  }
  return false;
}

export function normalizeStyle(style: Record<string, unknown> | undefined): NormalizedStyle {
  if (!style || typeof style !== "object") {
    return { parts: { main: { default: {} } } };
  }

  const raw = style as Record<string, unknown>;
  if (raw.parts && typeof raw.parts === "object") {
    return { parts: raw.parts as Record<string, Record<string, StyleProps>> };
  }

  // MVP flat: { main: { default: { ... } } } — skip meta keys
  const parts: Record<string, Record<string, StyleProps>> = {};
  for (const [part, states] of Object.entries(raw)) {
    if (part === "disabledSubgroups") continue;
    if (states && typeof states === "object" && !Array.isArray(states)) {
      parts[part] = states as Record<string, StyleProps>;
    }
  }
  if (!parts.main) parts.main = { default: {} };
  return { parts };
}

export function styleProp(
  style: Record<string, unknown> | undefined,
  part: string,
  state: string,
  prop: string,
): unknown {
  const n = normalizeStyle(style);
  return n.parts[part]?.[state]?.[prop];
}

/** Deep-merge style keys into part/state; preserves MVP flat vs V1 parts wrapper + meta. */
export function patchStyleProps(
  style: Record<string, unknown> | undefined,
  part: string,
  state: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const n = normalizeStyle(style);
  if (!n.parts[part]) n.parts[part] = {};
  if (!n.parts[part][state]) n.parts[part][state] = {};
  n.parts[part][state] = { ...n.parts[part][state], ...props };

  const disabled = readDisabledSubgroups(style);
  if (style?.parts && typeof style.parts === "object") {
    const out: Record<string, unknown> = { parts: n.parts };
    if (disabled.length) out.disabledSubgroups = disabled;
    return out;
  }
  const out: Record<string, unknown> = { ...n.parts };
  if (disabled.length) out.disabledSubgroups = disabled;
  return out;
}

/** MVP property panel style fields (main / default). */
export const MVP_STYLE_FIELDS = [
  { key: "bg_color", label: "背景色", type: "color" as const },
  { key: "text_color", label: "文字色", type: "color" as const },
  { key: "radius", label: "圆角", type: "number" as const },
];
