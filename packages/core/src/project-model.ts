import type { Diagnostic, ValidateResult } from "@forgeui/shared";
import type { EventBinding, LoadedProject, Node, ScreenDocument } from "./types.js";
import { validateProjectDir } from "./validate.js";
import { openProject, saveProject } from "./workspace.js";
import { listWidgetSpecs } from "./widgets.js";
import {
  addChildNode,
  addScreen,
  findNode,
  removeNode,
  removeScreen,
  renameScreen,
  setNodeEvents,
  updateNodeProps,
  updateProjectMeta,
} from "./mutate.js";

export interface MutationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  dirtyViews?: Array<"canvas" | "outline" | "props" | "events">;
}

export type ModelEvent =
  | { type: "meta"; patch: Record<string, unknown> }
  | { type: "node"; screenId: string; nodeId: string; patch: Parameters<typeof updateNodeProps>[3] }
  | { type: "events"; screenId: string; nodeId: string; events: EventBinding[] }
  | { type: "addNode"; screenId: string; parentId: string; widgetType: string }
  | { type: "removeNode"; screenId: string; nodeId: string };

export interface EditorStateSummary {
  project: LoadedProject["project"];
  currentScreenId: string;
  screenIds: string[];
  selectedNodeId: string | null;
  widgetTypeSummaries: ReturnType<typeof listWidgetSpecs>;
  constraints: {
    maxBatchPayloadBytes: number;
    batchTimeBudgetMs: number;
    singlePageWritePerBatch: true;
    mcpSupportedActionTypes: string[];
  };
}

function mergeDiagnostics(...lists: Diagnostic[][]): Diagnostic[] {
  return lists.flat();
}

/** Validate on disk; use after save or for CLI. */
export function validateLoaded(loaded: LoadedProject): ValidateResult {
  saveProject(loaded);
  return validateProjectDir(loaded.root);
}

/** Single write entry (AR-020): mutate → validate in memory via re-read. */
export function applyMutation(loaded: LoadedProject, mutate: () => void): MutationResult {
  mutate();
  saveProject(loaded);
  const result = validateProjectDir(loaded.root);
  return {
    ok: result.ok,
    diagnostics: result.diagnostics,
    dirtyViews: ["canvas", "outline", "props", "events"],
  };
}

export function buildEditorState(
  loaded: LoadedProject,
  opts: { screenId?: string; includeWidgetTypes?: boolean } = {},
): EditorStateSummary {
  const screenId = opts.screenId ?? loaded.project.defaultScreen;
  return {
    project: loaded.project,
    currentScreenId: screenId,
    screenIds: loaded.project.screens.map((s) => s.id),
    selectedNodeId: null,
    widgetTypeSummaries: opts.includeWidgetTypes !== false ? listWidgetSpecs() : [],
    constraints: {
      maxBatchPayloadBytes: 262144,
      batchTimeBudgetMs: 45000,
      singlePageWritePerBatch: true,
      mcpSupportedActionTypes: ["change_screen", "set_prop", "call_function"],
    },
  };
}

export function summarizeScreenTree(screen: ScreenDocument, depth = 0): object {
  const mapNode = (n: Node): object => ({
    id: n.id,
    type: n.type,
    name: n.name,
    frame: n.frame,
    childCount: n.children.length,
    children: depth < 4 ? n.children.map((c) => mapNode(c)) : [],
  });
  return mapNode(screen);
}

export const ProjectModelOps = {
  openProject,
  saveProject,
  validateProjectDir,
  validateLoaded,
  applyMutation,
  buildEditorState,
  summarizeScreenTree,
  updateProjectMeta,
  updateNodeProps,
  setNodeEvents,
  addChildNode,
  removeNode,
  addScreen,
  renameScreen,
  removeScreen,
  findNode,
};
