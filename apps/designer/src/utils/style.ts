/** Style read helpers aligned with @forgeui/core style.ts (MVP flat + V1 parts). */

export function normalizeStyleParts(
  style: Record<string, unknown> | undefined,
): Record<string, Record<string, Record<string, unknown>>> {
  if (!style || typeof style !== "object") {
    return { main: { default: {} } };
  }
  if (style.parts && typeof style.parts === "object") {
    return style.parts as Record<string, Record<string, Record<string, unknown>>>;
  }
  const parts: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const [part, states] of Object.entries(style)) {
    if (states && typeof states === "object" && !Array.isArray(states)) {
      parts[part] = states as Record<string, Record<string, unknown>>;
    }
  }
  if (!parts.main) parts.main = { default: {} };
  return parts;
}

export function readStyleProp(
  style: Record<string, unknown> | undefined,
  part: string,
  state: string,
  key: string,
): unknown {
  return normalizeStyleParts(style)[part]?.[state]?.[key];
}

export type StyleFieldDef = { key: string; label: string; type: "color" | "number" };

export const STYLE_FIELD_CATALOG: StyleFieldDef[] = [
  { key: "bg_color", label: "背景色", type: "color" },
  { key: "text_color", label: "文字色", type: "color" },
  { key: "radius", label: "圆角", type: "number" },
  { key: "border_width", label: "边框宽度", type: "number" },
  { key: "border_color", label: "边框颜色", type: "color" },
];

export function styleFieldsForWidget(type: string): StyleFieldDef[] {
  if (type === "label") {
    return STYLE_FIELD_CATALOG.filter((f) => f.key === "text_color");
  }
  if (type === "image") {
    return STYLE_FIELD_CATALOG.filter((f) => f.key === "bg_color" || f.key === "radius");
  }
  return STYLE_FIELD_CATALOG.filter((f) => ["bg_color", "text_color", "radius"].includes(f.key));
}
