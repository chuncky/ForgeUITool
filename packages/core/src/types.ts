export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
  /** 0=left/top, 1=center, 2=right/bottom — reference point for x/y (V1-C) */
  anchorX?: 0 | 1 | 2;
  anchorY?: 0 | 1 | 2;
  /** Visual rotation in degrees (0–359), designer + CodeGen transform */
  rotation?: number;
}

/** Container layout mode (V1-C) — maps to LVGL flex/grid in codegen */
export const LAYOUT_TYPES = ["none", "flex_row", "flex_column", "grid"] as const;
export type LayoutType = (typeof LAYOUT_TYPES)[number];

export function normalizeRotation(deg: number): number {
  const n = Math.round(deg) % 360;
  return n < 0 ? n + 360 : n;
}

export function parseLayoutType(value: unknown): LayoutType {
  if (value === "flex_row" || value === "flex_column" || value === "grid") return value;
  return "none";
}

/** Grid track count for layout_type=grid (1–8). */
export function parseGridTrackCount(value: unknown, fallback = 2): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(8, Math.max(1, Math.round(n)));
}

export type Action =
  | { type: "CHANGE_SCREEN"; target: string; anim?: string; ms?: number }
  | { type: "CALL_FUNCTION"; handler: string }
  | { type: "SET_PROP"; nodeId: string; prop: string; value: unknown }
  | { type: "SWITCH_LANGUAGE"; locale: string }
  | { type: "PLAY_ANIMATION"; animationId: string }
  | { type: "SET_VAR"; variableId: string; value: unknown }
  | { type: "TOGGLE_VAR"; variableId: string };

export interface EventBinding {
  id?: string;
  trigger: "CLICKED" | "PRESSED" | "RELEASED" | "LONG_PRESSED" | "VALUE_CHANGED";
  actions: Action[];
}

export interface Node {
  type: string;
  id: string;
  name: string;
  frame: Frame;
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  /** FR-018: project.themes[] id; theme edits re-sync linked nodes */
  styleRef?: string;
  /** V1 structured data (list items, tab headers, chart series…) — FR-016b */
  extraData?: Record<string, unknown>;
  events: EventBinding[];
  children: Node[];
  locked?: boolean;
  hidden?: boolean;
}

export interface ScreenDocument extends Node {
  schemaVersion: string;
  type: "screen";
}

export interface ScreenRef {
  id: string;
  file: string;
}

export interface NamedColor {
  id: string;
  name: string;
  value: string;
}

export interface NamedStyleTheme {
  id: string;
  name: string;
  /** Optional description (BK style library, max ~200). */
  description?: string;
  /** ISO timestamp when saved. */
  createdAt?: string;
  /** Widget type at save time — preview hint (e.g. button). */
  widgetType?: string;
  part: string;
  state: string;
  props: Record<string, unknown>;
}

/** FR-019 saved composite widget template */
export interface CustomWidgetDefinition {
  id: string;
  name: string;
  root: Node;
  createdAt?: string;
}

export interface ProjectDocument {
  schemaVersion: string;
  name: string;
  /** D-08: optional SDK delivery hint only — never drives CodeGen */
  platform?: string;
  display: {
    width: number;
    height: number;
    colorDepth: number;
    rotation?: number;
  };
  lvglVersion: string;
  previewBackend: "sdl" | "wasm";
  deliveryMode: "static_c" | "dynamic_ui" | "both";
  entrySymbol: string;
  defaultScreen: string;
  screens: ScreenRef[];
  assets?: { images?: unknown[]; fonts?: unknown[] };
  /** FR-018 named palette colors; style values may reference as @id */
  colors?: NamedColor[];
  /** FR-018 saved Part+State style snapshots */
  themes?: NamedStyleTheme[];
  /** FR-019 user-saved composite widgets */
  customWidgets?: CustomWidgetDefinition[];
  /** FR-042/043 multi-language strings */
  i18n?: import("./i18n.js").I18nConfig;
  /** FR-071 timeline animations */
  animations?: import("./animations.js").TimelineAnimation[];
  /** FR-035 project variables for action table */
  variables?: import("./variables.js").ProjectVariable[];
  /** FR-076 multi-resolution targets */
  targets?: import("./memory-estimate.js").DisplayTarget[];
  export?: {
    imageMode?: "c_array" | "fs_path";
    lvglInclude?: string;
    /** D-07 single codegen root (default forgeui_generated). */
    codegenDir?: string;
    /** User-editable subdir inside codegenDir (default custom). */
    customSubdir?: string;
    /** @deprecated migrated to codegenDir + customSubdir */
    generatedDir?: string;
    /** @deprecated migrated to customSubdir under codegenDir */
    userDir?: string;
    packageDir?: string;
    /** FR-056: weak event stubs vs strong custom/ implementations */
    eventStubStyle?: "custom" | "weak";
    /** FR-055: also emit MicroPython preview module */
    micropython?: boolean;
  };
  sdk?: { path?: string; copyTargetRel?: string };
  naming?: { cPrefix?: string; screenPrefix?: string };
}

export interface LoadedProject {
  root: string;
  project: ProjectDocument;
  screens: Map<string, ScreenDocument>;
}
