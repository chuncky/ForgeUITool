/**
 * Tabview canvas chrome — approximate tab bar + content region (FR-016e / BK tabview).
 */
import {
  buildWidgetCanvasChrome,
  forgeColorToCss,
  withAlpha,
  type CanvasChromeStyle,
} from "./canvas-chrome.js";
import { opacityToCss01 } from "@forgeui/core/opacity";
import { resolvePartCanvasStyleProps } from "./style.js";

export type TabBarPosition = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

export type TabviewChromeInput = {
  frame: { x: number; y: number; w: number; h: number };
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  extraData?: Record<string, unknown> | null;
  resolvedBgImage?: string | null;
  resolvedFontFamily?: string | null;
};

export type TabviewChromeModel = {
  position: TabBarPosition;
  barSize: number;
  tabs: string[];
  selectedIndex: number;
  /** Outer flex direction so bar sits on correct edge */
  flexDirection: "column" | "column-reverse" | "row" | "row-reverse";
  barIsHorizontal: boolean;
  rootStyle: CanvasChromeStyle;
  barStyle: CanvasChromeStyle;
  contentStyle: CanvasChromeStyle;
  itemStyle: (selected: boolean) => CanvasChromeStyle;
};

function opa01(value: unknown): number | undefined {
  return opacityToCss01(value);
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Tab header label for canvas / editors (BK: tabs[].name; legacy title string). */
export function resolveTabEntryLabel(tab: unknown): string {
  if (tab && typeof tab === "object" && !Array.isArray(tab)) {
    const o = tab as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (o.name != null && o.name !== "") return String(o.name);
    if (typeof o.title === "string") return o.title;
  }
  if (typeof tab === "string") return tab;
  return "Tab";
}

/**
 * BK: child.layout.tabIndex assigns content to a tab (0 = first).
 * Forge also accepts props.tabIndex / props.tab_index.
 * `null` = unassigned → visible on every tab (legacy projects).
 */
export function resolveChildTabIndex(child: {
  props?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}): number | null {
  const raw =
    child.layout?.tabIndex ??
    child.props?.tabIndex ??
    child.props?.tab_index;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

/** Whether a tabview child should paint for the designer-selected tab. */
export function isTabviewChildVisible(
  child: { props?: Record<string, unknown>; layout?: Record<string, unknown>; hidden?: boolean },
  selectedTabIndex: number,
): boolean {
  if (child.hidden) return false;
  const tab = resolveChildTabIndex(child);
  return tab == null || tab === selectedTabIndex;
}

function parseTabs(extra: Record<string, unknown> | null | undefined): string[] {
  const raw = extra?.tabs;
  if (!Array.isArray(raw) || !raw.length) return ["Tab 1", "Tab 2"];
  return raw.map((t) => resolveTabEntryLabel(t));
}

function partChrome(
  def: Record<string, unknown>,
  opts: { resolvedBgImage?: string | null; resolvedFontFamily?: string | null; isItem?: boolean },
): CanvasChromeStyle {
  const bgOpa = opa01(def.bg_opacity);
  const textOpa = opa01(def.text_opacity);
  const borderOpa = opa01(def.border_opacity);
  const bgColor = forgeColorToCss(def.bg_color, opts.isItem ? "transparent" : "#243b53");
  const gradColor = forgeColorToCss(def.bg_grad_color);
  const gradDir = String(def.bg_grad_dir ?? "none").toLowerCase();
  let background: string | undefined = withAlpha(bgColor, bgOpa) ?? (opts.isItem ? "transparent" : "#243b53");
  if (gradDir === "hor" && bgColor && gradColor) {
    background = `linear-gradient(to right, ${withAlpha(bgColor, bgOpa)}, ${withAlpha(gradColor, bgOpa)})`;
  } else if (gradDir === "ver" && bgColor && gradColor) {
    background = `linear-gradient(to bottom, ${withAlpha(bgColor, bgOpa)}, ${withAlpha(gradColor, bgOpa)})`;
  }
  const bgImage =
    (typeof opts.resolvedBgImage === "string" && opts.resolvedBgImage.startsWith("data:")
      ? opts.resolvedBgImage
      : "") ||
    (typeof def.bg_image === "string" && String(def.bg_image).startsWith("data:") ? String(def.bg_image) : "");
  const borderW = num(def.border_width, 0);
  const radius = def.radius != null ? num(def.radius, 0) : undefined;
  const fontSize = def.text_font_size != null ? num(def.text_font_size, 12) : undefined;
  const bgImgOpa01 = opa01(def.bg_img_opacity) ?? 1;
  const isGradient = typeof background === "string" && background.includes("gradient");

  return {
    ...(bgImage && !isGradient ? { backgroundColor: background } : { background }),
    backgroundImage: bgImage ? `url("${bgImage}")` : undefined,
    backgroundSize: bgImage ? "cover" : undefined,
    backgroundPosition: bgImage ? "center" : undefined,
    backgroundRepeat: bgImage ? "no-repeat" : undefined,
    ["--forge-bg-img-opa" as string]: bgImage ? bgImgOpa01 : undefined,
    color: withAlpha(forgeColorToCss(def.text_color, "#F0F4F8"), textOpa) ?? "#F0F4F8",
    border:
      borderW > 0
        ? `${borderW}px solid ${withAlpha(forgeColorToCss(def.border_color, "#94a3b8"), borderOpa) ?? "#94a3b8"}`
        : undefined,
    borderRadius: radius != null ? `${radius}px` : undefined,
    fontFamily: opts.resolvedFontFamily || undefined,
    fontSize: fontSize != null ? `${fontSize}px` : undefined,
    boxSizing: "border-box",
  };
}

export function normalizeTabBarPosition(value: unknown): TabBarPosition {
  const p = String(value ?? "TOP").toUpperCase();
  if (p === "BOTTOM" || p === "LEFT" || p === "RIGHT" || p === "TOP") return p;
  return "TOP";
}

export function buildTabviewChrome(input: TabviewChromeInput): TabviewChromeModel {
  const previewState = String(input.props?.preview_state ?? "default");
  const position = normalizeTabBarPosition(input.props?.tab_bar_position);
  const barSize = Math.max(8, num(input.props?.tab_bar_size, 50));
  const tabs = parseTabs(input.extraData ?? undefined);
  const selectedIndex = Math.max(
    0,
    Math.min(tabs.length - 1, num(input.extraData?.selectedTabIndex, 0)),
  );

  let flexDirection: TabviewChromeModel["flexDirection"] = "column";
  if (position === "BOTTOM") flexDirection = "column-reverse";
  else if (position === "LEFT") flexDirection = "row";
  else if (position === "RIGHT") flexDirection = "row-reverse";
  const barIsHorizontal = position === "TOP" || position === "BOTTOM";

  const barDef = resolvePartCanvasStyleProps(input.style, "main_tabbar", previewState);
  const itemDef = resolvePartCanvasStyleProps(input.style, "main_tabbaritem", "default");
  const itemChecked = resolvePartCanvasStyleProps(input.style, "main_tabbaritem", "checked");

  // Reuse generic chrome for main part (bg/border/shadow/pad/font/flags) so every StyleGroup key paints.
  const rootStyle: CanvasChromeStyle = {
    ...buildWidgetCanvasChrome({
      type: "tabview",
      frame: input.frame,
      props: input.props,
      style: input.style,
      resolvedBgImage: input.resolvedBgImage,
      resolvedFontFamily: input.resolvedFontFamily,
    }),
    display: "flex",
    flexDirection,
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const barStyle: CanvasChromeStyle = {
    ...partChrome(barDef, {}),
    flex: barIsHorizontal ? `0 0 ${barSize}px` : `0 0 ${barSize}px`,
    width: barIsHorizontal ? "100%" : `${barSize}px`,
    height: barIsHorizontal ? `${barSize}px` : "100%",
    display: "flex",
    flexDirection: barIsHorizontal ? "row" : "column",
    alignItems: "stretch",
    overflow: "hidden",
  };

  const contentStyle: CanvasChromeStyle = {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    position: "relative",
  };

  const itemStyle = (selected: boolean): CanvasChromeStyle => {
    const def = selected ? { ...itemDef, ...itemChecked } : itemDef;
    return {
      ...partChrome(def, { isItem: true }),
      flex: "1 1 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2px 6px",
      fontSize: partChrome(def, { isItem: true }).fontSize ?? "12px",
      fontWeight: selected ? 600 : 400,
      opacity: selected ? 1 : 0.75,
      borderBottom:
        selected && position === "TOP"
          ? `2px solid ${forgeColorToCss(def.text_color, "#3d9cf0")}`
          : undefined,
      borderTop:
        selected && position === "BOTTOM"
          ? `2px solid ${forgeColorToCss(def.text_color, "#3d9cf0")}`
          : undefined,
      cursor: "default",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    };
  };

  return {
    position,
    barSize,
    tabs,
    selectedIndex,
    flexDirection,
    barIsHorizontal,
    rootStyle,
    barStyle,
    contentStyle,
    itemStyle,
  };
}
