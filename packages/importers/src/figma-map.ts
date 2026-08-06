import type { Node, ScreenDocument } from "@forgeui/core";
import type { FigmaExportDocument, FigmaExportNode, FigmaExportPage } from "./figma-types.js";

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function slugId(name: string, fallback: string, used: Set<string>): string {
  let base = name
    .trim()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!base || !IDENTIFIER_RE.test(base)) base = fallback;
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n++}`;
  }
  used.add(id);
  return id;
}

function mapWidgetType(node: FigmaExportNode): string {
  if (node.widgetType) return node.widgetType;
  const t = node.figmaType.toUpperCase();
  if (t === "TEXT") return "label";
  if (t === "ELLIPSE" || t === "RECTANGLE") return "panel";
  if (t === "FRAME" || t === "GROUP" || t === "COMPONENT" || t === "INSTANCE") {
    const lower = node.name.toLowerCase();
    if (/button|btn/.test(lower)) return "button";
    if (/label|text|title/.test(lower) && node.text) return "label";
    return "container";
  }
  return "container";
}

function buildStyle(fillColor?: string, cornerRadius?: number): Record<string, unknown> {
  const main: Record<string, unknown> = {};
  if (fillColor) main.bg_color = fillColor;
  if (cornerRadius && cornerRadius > 0) main.radius = cornerRadius;
  if (!Object.keys(main).length) return {};
  return { main: { default: main } };
}

function mapNode(node: FigmaExportNode, used: Set<string>, parentOffset: { x: number; y: number }): Node {
  const type = mapWidgetType(node);
  const id = slugId(node.name, type, used);
  const frame = {
    x: Math.round(node.frame.x - parentOffset.x),
    y: Math.round(node.frame.y - parentOffset.y),
    w: Math.max(1, Math.round(node.frame.w)),
    h: Math.max(1, Math.round(node.frame.h)),
  };
  const props: Record<string, unknown> = {};
  if (type === "label" || type === "button") {
    props.text = node.text ?? node.name;
  }
  const style = buildStyle(node.fillColor, node.cornerRadius);
  const children = (node.children ?? []).map((c) =>
    mapNode(c, used, { x: node.frame.x, y: node.frame.y }),
  );
  return {
    type,
    id,
    name: node.name || id,
    frame,
    props,
    style,
    events: [],
    children,
  };
}

function mapPage(page: FigmaExportPage, used: Set<string>): ScreenDocument {
  const id = slugId(page.id ?? page.name, "screen", used);
  const screen: ScreenDocument = {
    schemaVersion: "1.0.0",
    id,
    type: "screen",
    name: page.name,
    frame: { ...page.frame },
    props: {},
    style: page.backgroundColor ? buildStyle(page.backgroundColor) : {},
    events: [],
    children: page.nodes.map((n) => mapNode(n, used, { x: page.frame.x, y: page.frame.y })),
  };
  return screen;
}

export function figmaDocumentToScreens(doc: FigmaExportDocument): {
  screens: ScreenDocument[];
  defaultScreenId: string;
} {
  const used = new Set<string>();
  const screens = doc.pages.map((p) => mapPage(p, used));
  const defaultScreenId = screens[0]?.id ?? "home";
  return { screens, defaultScreenId };
}

export function isFigmaExportDocument(raw: unknown): raw is FigmaExportDocument {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.format === "forgeui-figma" && o.formatVersion === 1 && Array.isArray(o.pages);
}
