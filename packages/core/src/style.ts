/** Normalized style lookup — accepts MVP flat or V1 parts/states (§3.5.1 LLD). */

export type StyleProps = Record<string, unknown>;

export interface NormalizedStyle {
  parts: Record<string, Record<string, StyleProps>>;
}

export function normalizeStyle(style: Record<string, unknown> | undefined): NormalizedStyle {
  if (!style || typeof style !== "object") {
    return { parts: { main: { default: {} } } };
  }

  const raw = style as Record<string, unknown>;
  if (raw.parts && typeof raw.parts === "object") {
    return { parts: raw.parts as Record<string, Record<string, StyleProps>> };
  }

  // MVP flat: { main: { default: { ... } } }
  const parts: Record<string, Record<string, StyleProps>> = {};
  for (const [part, states] of Object.entries(raw)) {
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

/** Deep-merge style keys into part/state; preserves MVP flat vs V1 parts wrapper. */
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

  if (style?.parts && typeof style.parts === "object") {
    return { parts: n.parts };
  }
  return { ...n.parts };
}

/** MVP property panel style fields (main / default). */
export const MVP_STYLE_FIELDS = [
  { key: "bg_color", label: "背景色", type: "color" as const },
  { key: "text_color", label: "文字色", type: "color" as const },
  { key: "radius", label: "圆角", type: "number" as const },
];
