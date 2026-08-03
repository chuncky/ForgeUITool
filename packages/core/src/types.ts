export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
}

export type Action =
  | { type: "CHANGE_SCREEN"; target: string; anim?: string; ms?: number }
  | { type: "CALL_FUNCTION"; handler: string }
  | { type: "SET_PROP"; nodeId: string; prop: string; value: unknown };

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

export interface ProjectDocument {
  schemaVersion: string;
  name: string;
  platform: "qm10xd" | "qm10xv" | "qm10xh";
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
  };
  sdk?: { path?: string; copyTargetRel?: string };
  naming?: { cPrefix?: string; screenPrefix?: string };
}

export interface LoadedProject {
  root: string;
  project: ProjectDocument;
  screens: Map<string, ScreenDocument>;
}
