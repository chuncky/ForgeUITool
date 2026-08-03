export {};

interface EditorContext {
  screenId: string;
  selectedId: string;
}

interface MutationResult {
  loaded: SerializedProject;
  canUndo: boolean;
  canRedo: boolean;
}

interface UndoRedoResult {
  ok: boolean;
  loaded?: SerializedProject;
  screenId?: string;
  selectedId?: string;
  canUndo: boolean;
  canRedo: boolean;
}

declare global {
  interface Window {
    forgeuiDesktop?: {
      openProjectDir: () => Promise<string | null>;
      chooseNewProjectDir: () => Promise<string | null>;
      getRepoRoot: () => Promise<string>;
      openProjectFolder: () => Promise<{ ok: boolean; error?: string; path?: string }>;
      readDoc: (id: string) => Promise<string>;
      openProject: (dir: string) => Promise<SerializedProject>;
      openHello: () => Promise<SerializedProject>;
      createProject: (opts: {
        root: string;
        name: string;
        platform?: string;
        fromTemplate?: "blank" | "hello-dual-screen";
        deliveryMode?: "both" | "static_c" | "dynamic_ui";
        display?: { width: number; height: number; colorDepth: number; rotation?: number };
      }) => Promise<SerializedProject>;
      saveProject: () => Promise<{
        ok: boolean;
        loaded?: SerializedProject;
        diagnostics?: Diagnostic[];
        canUndo?: boolean;
        canRedo?: boolean;
      }>;
      updateMeta: (args: {
        patch: Record<string, unknown>;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      updateNode: (args: {
        screenId: string;
        nodeId: string;
        patch: Record<string, unknown>;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      setEvents: (args: {
        screenId: string;
        nodeId: string;
        events: EventBinding[];
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      addNode: (args: {
        screenId: string;
        parentId: string;
        type: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { node: UiNode }>;
      removeNode: (args: {
        screenId: string;
        nodeId: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      addScreen: (args?: {
        id?: string;
        name?: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { screenId: string }>;
      renameScreen: (args: {
        screenId: string;
        newId: string;
        name?: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      removeScreen: (args: {
        screenId: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      duplicateScreen: (args: {
        screenId: string;
        newId?: string;
        name?: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { screenId: string }>;
      reorderScreen: (args: {
        screenId: string;
        where: "up" | "down" | "top" | "bottom";
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      setDefaultScreen: (args: {
        screenId: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      duplicateNode: (args: {
        screenId: string;
        nodeId: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { node: UiNode }>;
      moveNodeOrder: (args: {
        screenId: string;
        nodeId: string;
        where: "up" | "down" | "top" | "bottom";
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      setNodeFlags: (args: {
        screenId: string;
        nodeId: string;
        locked?: boolean;
        hidden?: boolean;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      alignNode: (args: {
        screenId: string;
        nodeId: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      undo: (editor: EditorContext) => Promise<UndoRedoResult>;
      redo: (editor: EditorContext) => Promise<UndoRedoResult>;
      historyState: () => Promise<{ canUndo: boolean; canRedo: boolean }>;
      listCodeFiles: () => Promise<Array<{ relPath: string; editable: boolean }>>;
      readProjectFile: (relPath: string) => Promise<{ ok: boolean; content?: string; error?: string; relPath?: string }>;
      writeUserFile: (args: { relPath: string; content: string }) => Promise<{ ok: boolean; relPath: string }>;
      listWidgets: () => Promise<WidgetMeta[]>;
      generate: (opts?: {
        cleanGenerated?: boolean;
        cleanOnly?: boolean;
        cleanPreviewBuild?: boolean;
      }) => Promise<{ ok: boolean; diagnostics: Diagnostic[]; filesWritten: string[]; autoSaved?: boolean }>;
      preview: (opts?: {
        prepareOnly?: boolean;
        buildOnly?: boolean;
        runOnly?: boolean;
        skipGenerate?: boolean;
      }) => Promise<{
        ok: boolean;
        diagnostics: Diagnostic[];
        buildLogs?: string[];
        elapsedMs?: number;
        autoSaved?: boolean;
        session?: { buildDir: string; pid?: number; logs?: string[] };
      }>;
      /** Subscribe to live cmake/build output during tool:preview (returns unsubscribe). */
      onPreviewBuildLog: (cb: (line: string) => void) => () => void;
      exportSdk: (opts: {
        sdkPath?: string;
        force?: boolean;
      }) => Promise<{ ok: boolean; diagnostics: Diagnostic[]; targetDir: string }>;
      pack: () => Promise<{
        ok: boolean;
        skeleton: boolean;
        outDir: string;
        diagnostics: Diagnostic[];
      }>;
    };
  }
}

export interface Diagnostic {
  level: string;
  code: string;
  message: string;
  path?: string;
}

export interface PropSpecMeta {
  name: string;
  type: string;
  label?: string;
  default?: unknown;
  enum?: string[];
  enumLabels?: Record<string, string>;
}

export interface WidgetMeta {
  type: string;
  category?: string;
  icon?: string;
  label: { "zh-CN": string; en?: string };
  isContainer: boolean;
  defaultFrame: { w: number; h: number };
  props?: PropSpecMeta[];
  styleParts?: string[];
  events?: string[];
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

export interface UiNode {
  type: string;
  id: string;
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  events: EventBinding[];
  children: UiNode[];
  locked?: boolean;
  hidden?: boolean;
}

export interface SerializedProject {
  root: string;
  project: {
    name: string;
    platform: string;
    lvglVersion: string;
    deliveryMode: string;
    previewBackend?: string;
    entrySymbol?: string;
    defaultScreen: string;
    display: { width: number; height: number; colorDepth: number };
    screens: Array<{ id: string; file: string }>;
    assets?: { images?: unknown[]; fonts?: unknown[] };
  };
  screens: Record<string, UiNode>;
}
