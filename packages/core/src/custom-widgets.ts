import type { CustomWidgetDefinition, LoadedProject, Node, ScreenDocument } from "./types.js";
import { ForgeError, ErrorCodes, IDENTIFIER_RE } from "@forgeui/shared";
import { findNode } from "./mutate.js";
import { slugThemeId, uniqueId } from "./themes.js";
import { getWidgetSpec } from "./widgets.js";

function walkParent(
  node: Node,
  id: string,
  parent: Node | null = null,
): { parent: Node | null; node: Node } | null {
  if (node.id === id) return { parent, node };
  for (const c of node.children) {
    const hit = walkParent(c, id, node);
    if (hit) return hit;
  }
  return null;
}

function deepCloneNode<T extends Node>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

function nextNodeId(screen: ScreenDocument, type: string): string {
  let n = 1;
  let id = `${type}_${n}`;
  while (findNode(screen, id)) {
    n += 1;
    id = `${type}_${n}`;
  }
  return id;
}

function reassignNodeIds(node: Node, screen: ScreenDocument): void {
  node.id = nextNodeId(screen, node.type);
  for (const child of node.children) reassignNodeIds(child, screen);
}

function ensureCustomWidgets(project: LoadedProject["project"]): CustomWidgetDefinition[] {
  if (!project.customWidgets) project.customWidgets = [];
  return project.customWidgets;
}

export function listCustomWidgets(loaded: LoadedProject): CustomWidgetDefinition[] {
  return loaded.project.customWidgets ?? [];
}

export function saveNodeAsCustomWidget(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  opts: { id?: string; name?: string } = {},
): CustomWidgetDefinition {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  if (nodeId === screenId) {
    throw new ForgeError(ErrorCodes.E_SEM_001, "cannot save screen root as custom widget");
  }
  const hit = walkParent(screen, nodeId);
  if (!hit) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  if (!getWidgetSpec(hit.node.type)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `unknown widget type ${hit.node.type}`);
  }

  const list = ensureCustomWidgets(loaded.project);
  const name = opts.name?.trim() || hit.node.name || "自定义控件";
  const existing = new Set(list.map((c) => c.id));
  let id = opts.id?.trim() || slugThemeId(name) || "custom_widget";
  if (!IDENTIFIER_RE.test(id)) id = "custom_widget";
  id = uniqueId(id, existing);

  const def: CustomWidgetDefinition = {
    id,
    name,
    root: deepCloneNode(hit.node),
    createdAt: new Date().toISOString(),
  };
  list.push(def);
  return def;
}

export interface AddCustomWidgetOptions {
  frame?: Partial<Node["frame"]>;
}

export function addCustomWidgetInstance(
  loaded: LoadedProject,
  screenId: string,
  parentId: string,
  customId: string,
  opts?: AddCustomWidgetOptions,
): Node {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const def = listCustomWidgets(loaded).find((c) => c.id === customId);
  if (!def) throw new ForgeError(ErrorCodes.E_SEM_001, `custom widget ${customId} not found`);

  const parent = findNode(screen, parentId);
  if (!parent) throw new ForgeError(ErrorCodes.E_SEM_001, `parent ${parentId} not found`);
  if (!getWidgetSpec(parent.type)?.isContainer && parent.type !== "screen") {
    throw new ForgeError(ErrorCodes.E_SEM_001, `parent ${parent.type} is not a container`);
  }

  const clone = deepCloneNode(def.root);
  reassignNodeIds(clone, screen);
  if (opts?.frame) {
    clone.frame = { ...clone.frame, ...opts.frame };
  }
  parent.children.push(clone);
  return clone;
}

export function removeCustomWidget(loaded: LoadedProject, customId: string): void {
  const list = ensureCustomWidgets(loaded.project);
  const idx = list.findIndex((c) => c.id === customId);
  if (idx < 0) throw new ForgeError(ErrorCodes.E_SEM_001, `custom widget ${customId} not found`);
  list.splice(idx, 1);
}
