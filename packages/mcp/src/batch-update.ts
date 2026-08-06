import type { EventBinding, LoadedProject, Node } from "@forgeui/core";
import {
  addChildNode,
  removeNode,
  setNodeEvents,
  updateNodeProps,
} from "@forgeui/core";
import { ErrorCodes, ForgeError } from "@forgeui/shared";

export interface BatchUpdateOperation {
  type: string;
  ref?: string;
  nodeRef?: string;
  parentRef?: string;
  screenRef?: string;
  screenId?: string;
  nodeId?: string;
  parentId?: string | null;
  [key: string]: unknown;
}

export interface BatchUpdateResult {
  ok: boolean;
  results: Array<{ index: number; ok: boolean; data?: unknown; error?: { code: string; message: string } }>;
  timedOut?: boolean;
  pendingFrom?: number;
  redrawn: boolean;
  aiTransaction?: { pending: boolean; changeCount: number };
  warnings?: string[];
}

export interface ApplyBatchUpdateOptions {
  mode?: "stop_on_error" | "continue_on_error";
  changeCountBase?: number;
}

function resolveRef(refs: Map<string, string>, ref?: string): string | undefined {
  if (!ref) return undefined;
  const hit = refs.get(ref);
  if (!hit) throw new ForgeError(ErrorCodes.E_MCP_ARGS, `Unknown ref: ${ref}`);
  return hit;
}

function resolveScreenId(
  loaded: LoadedProject,
  op: BatchUpdateOperation,
  refs: Map<string, string>,
): string {
  if (op.screenId && typeof op.screenId === "string") return op.screenId;
  const fromRef = resolveRef(refs, op.screenRef);
  if (fromRef) return fromRef;
  return loaded.project.defaultScreen;
}

function resolveNodeId(
  loaded: LoadedProject,
  screenId: string,
  op: BatchUpdateOperation,
  refs: Map<string, string>,
): string {
  if (op.nodeId && typeof op.nodeId === "string") return op.nodeId;
  const fromRef = resolveRef(refs, op.nodeRef);
  if (fromRef) return fromRef;
  throw new ForgeError(ErrorCodes.E_MCP_ARGS, "nodeId or nodeRef required");
}

function resolveParentId(
  loaded: LoadedProject,
  screenId: string,
  op: BatchUpdateOperation,
  refs: Map<string, string>,
): string {
  if (op.parentId === null || op.parentId === undefined) {
    const fromRef = resolveRef(refs, op.parentRef);
    return fromRef ?? screenId;
  }
  if (typeof op.parentId === "string") return op.parentId;
  return screenId;
}

interface NodeTreeInput {
  type: string;
  name?: string;
  frame?: Partial<Node["frame"]>;
  props?: Record<string, unknown>;
  children?: NodeTreeInput[];
}

function addNodeTree(
  loaded: LoadedProject,
  screenId: string,
  parentId: string,
  tree: NodeTreeInput,
): Node {
  const node = addChildNode(loaded, screenId, parentId, tree.type, tree.frame ? { frame: tree.frame } : undefined);
  if (tree.name) node.name = tree.name;
  if (tree.props) node.props = { ...node.props, ...tree.props };
  for (const child of tree.children ?? []) {
    addNodeTree(loaded, screenId, node.id, child);
  }
  return node;
}

function execOperation(
  loaded: LoadedProject,
  op: BatchUpdateOperation,
  refs: Map<string, string>,
): unknown {
  const screenId = resolveScreenId(loaded, op, refs);

  switch (op.type) {
    case "update_node": {
      const nodeId = resolveNodeId(loaded, screenId, op, refs);
      const patch: Parameters<typeof updateNodeProps>[3] = {};
      if (op.frame && typeof op.frame === "object") patch.frame = op.frame as Partial<Node["frame"]>;
      if (op.props && typeof op.props === "object") patch.props = op.props as Record<string, unknown>;
      if (op.extraData && typeof op.extraData === "object") patch.extraData = op.extraData as Record<string, unknown>;
      if (Array.isArray(op.styles)) {
        for (const s of op.styles as Array<{ part?: string; state?: string; props?: Record<string, unknown> }>) {
          updateNodeProps(loaded, screenId, nodeId, {
            styleKeys: {
              part: s.part ?? "main",
              state: s.state ?? "default",
              props: s.props ?? {},
            },
          });
        }
      } else if (Object.keys(patch).length) {
        updateNodeProps(loaded, screenId, nodeId, patch);
      }
      if (Array.isArray(op.events)) {
        setNodeEvents(loaded, screenId, nodeId, op.events as EventBinding[]);
      }
      return { nodeId, screenId };
    }
    case "update_node_property": {
      const nodeId = resolveNodeId(loaded, screenId, op, refs);
      const property = String(op.property ?? "");
      updateNodeProps(loaded, screenId, nodeId, { props: { [property]: op.value } });
      return { nodeId, property };
    }
    case "update_node_style": {
      const nodeId = resolveNodeId(loaded, screenId, op, refs);
      const part = String(op.part ?? "main");
      const state = String(op.state ?? "default");
      const property = String(op.property ?? "");
      updateNodeProps(loaded, screenId, nodeId, {
        styleKeys: { part, state, props: { [property]: op.value } },
      });
      return { nodeId, part, state, property };
    }
    case "add_node": {
      const parentId = resolveParentId(loaded, screenId, op, refs);
      const widgetType = String(op.widgetType ?? "");
      if (!widgetType) {
        throw new ForgeError(ErrorCodes.E_MCP_ARGS, "add_node requires widgetType");
      }
      const node = addChildNode(loaded, screenId, parentId, widgetType, {
        frame: op.frame as Partial<Node["frame"]> | undefined,
      });
      if (typeof op.name === "string") node.name = op.name;
      if (op.ref) refs.set(String(op.ref), node.id);
      return { nodeId: node.id, screenId };
    }
    case "remove_node": {
      const nodeId = resolveNodeId(loaded, screenId, op, refs);
      removeNode(loaded, screenId, nodeId);
      return { nodeId, screenId };
    }
    case "add_node_tree": {
      const parentId = resolveParentId(loaded, screenId, op, refs);
      const tree = op.tree as NodeTreeInput;
      if (!tree?.type) throw new ForgeError(ErrorCodes.E_MCP_ARGS, "add_node_tree requires tree.type");
      const node = addNodeTree(loaded, screenId, parentId, tree);
      if (op.ref) refs.set(String(op.ref), node.id);
      return { nodeId: node.id, screenId };
    }
    default:
      throw new ForgeError(ErrorCodes.E_MCP_NOT_IMPL, `batch operation ${op.type} not implemented`);
  }
}

export function applyBatchUpdate(
  loaded: LoadedProject,
  operations: BatchUpdateOperation[],
  opts: ApplyBatchUpdateOptions = {},
): BatchUpdateResult {
  const mode = opts.mode ?? "stop_on_error";
  if (!Array.isArray(operations) || !operations.length) {
    throw new ForgeError(ErrorCodes.E_MCP_ARGS, "batch_update requires non-empty operations[]");
  }
  if (operations.length > 300) {
    throw new ForgeError(ErrorCodes.E_MCP_ARGS, "batch_update exceeds 300 operations");
  }
  const payload = JSON.stringify(operations);
  if (payload.length > 262144) {
    throw new ForgeError(ErrorCodes.E_MCP_ARGS, "BATCH_UPDATE_PAYLOAD_TOO_LARGE");
  }

  const screenIds = new Set<string>();
  const refsProbe = new Map<string, string>();
  for (const op of operations) {
    if (op.type === "switch_screen") continue;
    screenIds.add(resolveScreenId(loaded, op, refsProbe));
  }
  if (screenIds.size > 1) {
    throw new ForgeError(ErrorCodes.E_MCP_ARGS, "BATCH_UPDATE_MULTI_PAGE_FORBIDDEN");
  }

  const refs = new Map<string, string>();
  const results: BatchUpdateResult["results"] = [];
  let changeCount = opts.changeCountBase ?? 0;

  for (let index = 0; index < operations.length; index += 1) {
    const op = operations[index]!;
    try {
      const data = execOperation(loaded, op, refs);
      if (op.ref && data && typeof data === "object" && "nodeId" in data) {
        refs.set(String(op.ref), String((data as { nodeId: string }).nodeId));
      }
      changeCount += 1;
      results.push({ index, ok: true, data });
    } catch (e) {
      const err = e as Error;
      const error = {
        code: err instanceof ForgeError ? err.code : ErrorCodes.E_SEM_001,
        message: err.message,
      };
      results.push({ index, ok: false, error });
      if (mode === "stop_on_error") {
        return {
          ok: false,
          results,
          redrawn: changeCount > 0,
          aiTransaction: { pending: true, changeCount },
        };
      }
    }
  }

  return {
    ok: results.every((r) => r.ok),
    results,
    redrawn: changeCount > 0,
    aiTransaction: { pending: true, changeCount },
  };
}
