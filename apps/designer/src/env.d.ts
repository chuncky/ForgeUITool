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
      openImageFiles: () => Promise<string[]>;
      openFontFiles: () => Promise<string[]>;
      importImages: (args: {
        paths: string[];
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { imported?: Array<{ id: string; path: string }> }>;
      importFonts: (args: {
        paths: string[];
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { imported?: Array<{ id: string; path: string; size?: number }> }>;
      readDoc: (id: string) => Promise<string>;
      openProject: (dir: string) => Promise<SerializedProject>;
      importForgeui: () => Promise<{
        ok: boolean;
        cancelled?: boolean;
        loaded?: SerializedProject;
        diagnostics?: Diagnostic[];
        canUndo?: boolean;
        canRedo?: boolean;
      }>;
      importFigma: () => Promise<{
        ok: boolean;
        cancelled?: boolean;
        loaded?: SerializedProject;
        diagnostics?: Diagnostic[];
        canUndo?: boolean;
        canRedo?: boolean;
      }>;
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
      seedI18n: (args?: {
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { added?: number }>;
      exportXliff: (args?: {
        sourceLocale?: string;
        targetLocale?: string;
        onlyMissing?: boolean;
      }) => Promise<{ ok: boolean; canceled?: boolean; path?: string; onlyMissing?: boolean }>;
      importXliff: (args?: {
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { updated?: number; canceled?: boolean; path?: string }>;
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
        frame?: { x: number; y: number; w?: number; h?: number };
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { node: UiNode }>;
      saveAsCustomWidget: (args: {
        screenId: string;
        nodeId: string;
        id?: string;
        name?: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult & { customWidget: { id: string; name: string } }>;
      addCustomWidget: (args: {
        screenId: string;
        parentId: string;
        customId: string;
        frame?: { x: number; y: number; w?: number; h?: number };
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
      alignNodes: (args: {
        screenId: string;
        nodeIds: string[];
        mode: string;
        _editor?: EditorContext;
        skipHistory?: boolean;
      }) => Promise<MutationResult>;
      undo: (editor: EditorContext) => Promise<UndoRedoResult>;
      redo: (editor: EditorContext) => Promise<UndoRedoResult>;
      historyState: () => Promise<{ canUndo: boolean; canRedo: boolean }>;
      listSnapshots: () => Promise<Array<{ id: string; label?: string; createdAt: string }>>;
      createSnapshot: (label?: string) => Promise<{ ok: boolean; meta: { id: string; label?: string; createdAt: string }; loaded: SerializedProject }>;
      restoreSnapshot: (id: string) => Promise<UndoRedoResult & { ok: boolean }>;
      listCodeFiles: () => Promise<Array<{ relPath: string; editable: boolean }>>;
      readProjectFile: (relPath: string) => Promise<{ ok: boolean; content?: string; error?: string; relPath?: string }>;
      resolveAssetDataUrl: (relPath: string) => Promise<{
        ok: boolean;
        dataUrl?: string;
        relPath?: string;
        mime?: string;
        error?: string;
      }>;
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
        backend?: "sdl" | "wasm";
      }) => Promise<{
        ok: boolean;
        diagnostics: Diagnostic[];
        buildLogs?: string[];
        elapsedMs?: number;
        autoSaved?: boolean;
        previewUrl?: string | null;
        session?: { buildDir: string; pid?: number; logs?: string[] };
      }>;
      hotReloadPreview: () => Promise<{
        ok: boolean;
        buildDir?: string;
        message?: string;
        diagnostics?: Diagnostic[];
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
      packPreview: () => Promise<{
        ok: boolean;
        outDir: string;
        diagnostics: Diagnostic[];
        widgetCount: number;
        screenCount: number;
        entryScreen: string | null;
        packageLogic: { allowedActions?: string[]; firmwareOnlyActions?: string[] } | null;
        /** FR-086 deepen: parsed A2 screen trees for canvas overlay */
        screens: Array<{ id: string; name: string; document: UiNode }>;
      }>;
      getAiTransactionState: () => Promise<{ pending: boolean; changeCount: number }>;
      commitAiTransaction: () => Promise<{
        ok: boolean;
        loaded?: SerializedProject;
        pending?: boolean;
        changeCount?: number;
        error?: string;
      }>;
      rollbackAiTransaction: () => Promise<{
        ok: boolean;
        loaded?: SerializedProject;
        pending?: boolean;
        changeCount?: number;
        error?: string;
      }>;
      getAiPanelState: () => Promise<{
        ok: boolean;
        bridgePort: number;
        projectOpen: boolean;
        previewBusy: boolean;
        aiWorkspacePath: string | null;
        workspaceReady: boolean;
        transaction: { pending: boolean; changeCount: number };
        tools: Array<{ name: string; description: string; implemented: boolean }>;
        mcpConfigJson: string;
        bridgePing: { ok?: boolean; status?: string; error?: string };
      }>;
      setupAiWorkspace: () => Promise<{ ok: boolean; aiWorkspacePath?: string; error?: string }>;
      openAiWorkspaceFolder: () => Promise<{ ok: boolean; aiWorkspacePath?: string; error?: string }>;
      pingAiBridge: () => Promise<{ ok: boolean; data?: unknown; error?: string }>;
      onAiModelUpdated: (
        cb: (payload: { loaded: SerializedProject; pending?: boolean; changeCount?: number }) => void,
      ) => () => void;
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
  /** text/string: prefer textarea when true (e.g. options one-per-line). */
  multiline?: boolean;
}

export type ExtraDataEditorKind = "items" | "tabs" | "buttons" | "series" | "cells" | "keymap" | "frames";

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
  extraDataEditor?: ExtraDataEditorKind;
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

export interface UiNode {
  type: string;
  id: string;
  name: string;
  frame: { x: number; y: number; w: number; h: number; anchorX?: 0 | 1 | 2; anchorY?: 0 | 1 | 2; rotation?: number };
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  styleRef?: string;
  extraData?: Record<string, unknown>;
  events: EventBinding[];
  children: UiNode[];
  locked?: boolean;
  hidden?: boolean;
}

export interface SerializedProject {
  root: string;
  project: {
    name: string;
    platform?: string;
    lvglVersion: string;
    deliveryMode: string;
    previewBackend?: string;
    entrySymbol?: string;
    defaultScreen: string;
    display: { width: number; height: number; colorDepth: number };
    screens: Array<{ id: string; file: string }>;
    assets?: { images?: unknown[]; fonts?: unknown[] };
    colors?: Array<{ id: string; name: string; value: string }>;
    themes?: Array<{
      id: string;
      name: string;
      description?: string;
      createdAt?: string;
      widgetType?: string;
      part: string;
      state: string;
      props: Record<string, unknown>;
    }>;
    customWidgets?: Array<{ id: string; name: string; root: UiNode; createdAt?: string }>;
    i18n?: {
      enabled: boolean;
      defaultLocale: string;
      previewLocale?: string;
      locales: Array<{ id: string; name: string }>;
      strings: Array<{ id: string; note?: string; values: Record<string, string> }>;
    };
    animations?: Array<{
      id: string;
      name: string;
      duration: number;
      loop?: boolean;
      tracks: Array<{
        id: string;
        nodeId: string;
        property: string;
        keyframes: Array<{ t: number; value: number; easing?: string }>;
      }>;
    }>;
  };
  screens: Record<string, UiNode>;
}
