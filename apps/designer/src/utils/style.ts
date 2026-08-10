/** Style read helpers aligned with @forgeui/core style.ts (MVP flat + V1 parts). */

import { STYLE_SUBGROUPS, visibleStyleFieldKeysForWidget, type StyleFieldDef } from "./style-fields.js";

export {
  STYLE_FIELD_CATALOG,
  STYLE_SUBGROUPS,
  styleFieldsForWidget,
  styleSubgroupsForWidget,
  visibleStyleFieldKeysForWidget,
  isStyleFieldPanelVisible,
} from "./style-fields.js";

export type { StyleFieldDef, StyleSubgroupDef } from "./style-fields.js";

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

/**
 * Merge style.parts[part].default with style.parts[part][previewState].
 * Used by canvas chrome for multi-part widgets (tabview tabbar / tabbaritem).
 */
export function resolvePartCanvasStyleProps(
  style: Record<string, unknown> | undefined,
  part: string,
  previewState: string | undefined,
): Record<string, unknown> {
  const parts = normalizeStyleParts(style);
  const partId = part || "main";
  const merged: Record<string, unknown> = { ...(parts[partId]?.default ?? {}) };
  const state = String(previewState ?? "default").toLowerCase();
  if (state && state !== "default") {
    const overlay = parts[partId]?.[state];
    if (overlay && typeof overlay === "object") Object.assign(merged, overlay);
  }
  const disabled = Array.isArray(style?.disabledSubgroups)
    ? (style!.disabledSubgroups as unknown[]).map(String)
    : [];
  if (!disabled.length) return merged;
  const blocked = new Set<string>();
  for (const id of disabled) {
    const g = STYLE_SUBGROUPS.find((s) => s.id === id);
    for (const f of g?.fields ?? []) blocked.add(f.key);
  }
  return Object.fromEntries(Object.entries(merged).filter(([k]) => !blocked.has(k)));
}

/**
 * V1-B: merge main.default with main[preview_state] for canvas chrome
 * (bg/text/radius/opacity). Non-default preview_state overlays matching keys.
 */
export function resolveCanvasStyleProps(
  style: Record<string, unknown> | undefined,
  previewState: string | undefined,
): Record<string, unknown> {
  return resolvePartCanvasStyleProps(style, "main", previewState);
}

/** Persist eye-toggle meta without dropping part/state props. */
export function withDisabledSubgroups(
  style: Record<string, unknown> | undefined,
  disabled: string[],
): Record<string, unknown> {
  const parts = normalizeStyleParts(style);
  const useParts = !!(style?.parts && typeof style.parts === "object");
  const base: Record<string, unknown> = useParts ? { parts } : { ...parts };
  const ids = [...new Set(disabled.map(String).filter(Boolean))];
  if (ids.length) base.disabledSubgroups = ids;
  return base;
}

export function visibleStyleFields(type: string, fields: StyleFieldDef[]): StyleFieldDef[] {
  const keys = visibleStyleFieldKeysForWidget(type);
  if (!keys) return fields;
  const allow = new Set(keys);
  return fields.filter((f) => allow.has(f.key));
}
