/** FR-018 color ref helpers for project.json colors / colorThemes / style themes. */

import { patchStyleProps } from "./style.js";
import type {
  ColorPaletteTheme,
  LoadedProject,
  NamedColor,
  NamedStyleTheme,
  Node,
} from "./types.js";

export type { NamedColor, NamedStyleTheme, ColorPaletteTheme } from "./types.js";

function walkNodes(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkNodes(child, visit);
}

/** Apply a named style theme's props into a node style object (part/state). */
export function applyThemePropsToStyle(
  style: Record<string, unknown> | undefined,
  theme: NamedStyleTheme,
): Record<string, unknown> {
  return patchStyleProps(style, theme.part, theme.state, theme.props);
}

/** Resolve node.style with optional styleRef theme overlay (CodeGen / IR). */
export function resolveStyleWithRef(
  style: Record<string, unknown> | undefined,
  styleRef: string | undefined,
  themes: NamedStyleTheme[] | undefined,
): Record<string, unknown> {
  const base = style ?? {};
  if (!styleRef || !themes?.length) return base;
  const theme = themes.find((t) => t.id === styleRef);
  if (!theme) return base;
  return applyThemePropsToStyle(base, theme);
}

/**
 * Re-apply project.themes[] props onto every node that has styleRef.
 * Returns how many nodes were updated.
 */
export function syncStyleRefs(loaded: LoadedProject): number {
  const themes = loaded.project.themes ?? [];
  let count = 0;
  for (const screen of loaded.screens.values()) {
    walkNodes(screen, (node) => {
      if (!node.styleRef) return;
      const theme = themes.find((t) => t.id === node.styleRef);
      if (!theme) return;
      node.style = applyThemePropsToStyle(node.style, theme);
      count += 1;
    });
  }
  return count;
}

export const COLOR_REF_PREFIX = "@";

export function isColorRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(COLOR_REF_PREFIX) && value.length > 1;
}

export function colorRefId(value: string): string {
  return value.slice(COLOR_REF_PREFIX.length);
}

export function formatColorRef(id: string): string {
  return `${COLOR_REF_PREFIX}${id}`;
}

/** Flatten mine colors + all palette-theme colors for @id lookup. */
export function flattenNamedColors(
  colors: NamedColor[] | undefined,
  colorThemes?: ColorPaletteTheme[] | undefined,
): NamedColor[] {
  const out: NamedColor[] = [...(colors ?? [])];
  for (const theme of colorThemes ?? []) {
    for (const c of theme.colors ?? []) out.push(c);
  }
  return out;
}

export function resolveColorValue(
  value: unknown,
  colors: NamedColor[] | undefined,
  colorThemes?: ColorPaletteTheme[] | undefined,
): string {
  if (typeof value !== "string") return String(value ?? "");
  if (!isColorRef(value)) return value;
  const id = colorRefId(value);
  const hit = flattenNamedColors(colors, colorThemes).find((c) => c.id === id);
  return hit?.value ?? value;
}

export function slugThemeId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return base || "theme";
}

export function uniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/** Collect all color ids already used in mine + palette themes. */
export function collectColorIds(
  colors: NamedColor[] | undefined,
  colorThemes?: ColorPaletteTheme[] | undefined,
): Set<string> {
  return new Set(flattenNamedColors(colors, colorThemes).map((c) => c.id));
}
