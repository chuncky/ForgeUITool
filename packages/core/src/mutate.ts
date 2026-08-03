import fs from "node:fs";
import path from "node:path";
import type { EventBinding, LoadedProject, Node, ScreenDocument } from "./types.js";
import { ForgeError, ErrorCodes, IDENTIFIER_RE } from "@forgeui/shared";
import { patchStyleProps } from "./style.js";
import { getWidgetSpec } from "./widgets.js";

function walkFind(node: Node, id: string): Node | null {
  if (node.id === id) return node;
  for (const c of node.children) {
    const hit = walkFind(c, id);
    if (hit) return hit;
  }
  return null;
}

function walkParent(node: Node, id: string, parent: Node | null = null): { parent: Node | null; node: Node } | null {
  if (node.id === id) return { parent, node };
  for (const c of node.children) {
    const hit = walkParent(c, id, node);
    if (hit) return hit;
  }
  return null;
}

export function findNode(screen: ScreenDocument, nodeId: string): Node | null {
  return walkFind(screen, nodeId);
}

export interface NodeStylePatch {
  part: string;
  state: string;
  props: Record<string, unknown>;
}

export function updateNodeProps(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  patch: {
    name?: string;
    frame?: Partial<Node["frame"]>;
    props?: Record<string, unknown>;
    style?: Record<string, unknown>;
    styleKeys?: NodeStylePatch;
  },
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const node = findNode(screen, nodeId);
  if (!node) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  if (patch.name !== undefined) node.name = patch.name;
  if (patch.frame) node.frame = { ...node.frame, ...patch.frame };
  if (patch.props) node.props = { ...node.props, ...patch.props };
  if (patch.styleKeys) {
    node.style = patchStyleProps(node.style, patch.styleKeys.part, patch.styleKeys.state, patch.styleKeys.props);
  } else if (patch.style) {
    node.style = patchStyleProps(node.style, "main", "default", patch.style);
  }
}

export function setNodeEvents(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  events: EventBinding[],
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const node = findNode(screen, nodeId);
  if (!node) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  node.events = events;
}

export function addChildNode(
  loaded: LoadedProject,
  screenId: string,
  parentId: string,
  type: string,
): Node {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const parent = findNode(screen, parentId);
  if (!parent) throw new ForgeError(ErrorCodes.E_SEM_001, `parent ${parentId} not found`);
  const spec = getWidgetSpec(type);
  if (!spec) throw new ForgeError(ErrorCodes.E_SEM_001, `unknown type ${type}`);
  if (!spec.isContainer && parentId !== screenId && parent.type !== "screen" && parent.type !== "container" && parent.type !== "button") {
    // allow adding into screen/container/button
  }
  if (!getWidgetSpec(parent.type)?.isContainer && parent.type !== "screen") {
    throw new ForgeError(ErrorCodes.E_SEM_001, `parent ${parent.type} is not a container`);
  }

  let n = 1;
  let id = `${type}_${n}`;
  while (findNode(screen, id)) {
    n += 1;
    id = `${type}_${n}`;
  }

  const node: Node = {
    type,
    id,
    name: spec.label["zh-CN"] || type,
    frame: {
      x: 20,
      y: 20 + parent.children.length * 8,
      w: spec.defaultFrame.w,
      h: spec.defaultFrame.h,
    },
    props: Object.fromEntries(spec.props.map((p) => [p.name, p.default])),
    style: {},
    events: [],
    children: [],
  };
  parent.children.push(node);
  return node;
}

export function removeNode(loaded: LoadedProject, screenId: string, nodeId: string): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  if (nodeId === screenId) throw new ForgeError(ErrorCodes.E_SEM_001, "cannot remove screen root");
  const hit = walkParent(screen, nodeId);
  if (!hit?.parent) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  hit.parent.children = hit.parent.children.filter((c) => c.id !== nodeId);
}

function blankScreen(id: string, name: string, w: number, h: number): ScreenDocument {
  return {
    schemaVersion: "1.0.0",
    id,
    type: "screen",
    name,
    frame: { x: 0, y: 0, w, h },
    props: {},
    style: { main: { default: { bg_color: "#101820" } } },
    events: [],
    children: [],
  };
}

export function addScreen(
  loaded: LoadedProject,
  opts: { id?: string; name?: string } = {},
): ScreenDocument {
  const display = loaded.project.display;
  let n = loaded.project.screens.length + 1;
  let id = opts.id ?? `page_${n}`;
  while (loaded.screens.has(id) || loaded.project.screens.some((s) => s.id === id)) {
    n += 1;
    id = opts.id ? `${opts.id}_${n}` : `page_${n}`;
  }
  if (!IDENTIFIER_RE.test(id)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `invalid screen id: ${id}`);
  }
  const name = opts.name ?? id;
  const file = `screens/${id}.json`;
  const screen = blankScreen(id, name, display.width, display.height);
  loaded.screens.set(id, screen);
  loaded.project.screens.push({ id, file });
  return screen;
}

export function renameScreen(loaded: LoadedProject, screenId: string, newId: string, name?: string): void {
  if (!IDENTIFIER_RE.test(newId)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `invalid screen id: ${newId}`);
  }
  if (screenId === newId) {
    const screen = loaded.screens.get(screenId);
    if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
    if (name !== undefined) screen.name = name;
    return;
  }
  if (loaded.screens.has(newId)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `screen id already exists: ${newId}`);
  }
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const ref = loaded.project.screens.find((s) => s.id === screenId);
  if (!ref) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ref missing: ${screenId}`);

  const oldFile = path.join(loaded.root, ref.file);
  const newFileRel = `screens/${newId}.json`;
  const newFile = path.join(loaded.root, newFileRel);

  loaded.screens.delete(screenId);
  screen.id = newId;
  if (name !== undefined) screen.name = name;
  else if (screen.name === screenId) screen.name = newId;
  loaded.screens.set(newId, screen);
  ref.id = newId;
  ref.file = newFileRel;

  if (loaded.project.defaultScreen === screenId) {
    loaded.project.defaultScreen = newId;
  }

  // rewrite CHANGE_SCREEN targets
  for (const s of loaded.screens.values()) {
    rewriteScreenTargets(s, screenId, newId);
  }

  if (fs.existsSync(oldFile) && oldFile !== newFile) {
    fs.mkdirSync(path.dirname(newFile), { recursive: true });
    if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
    fs.renameSync(oldFile, newFile);
  }
}

function rewriteScreenTargets(node: Node, from: string, to: string): void {
  for (const ev of node.events) {
    for (const a of ev.actions) {
      if (a.type === "CHANGE_SCREEN" && a.target === from) a.target = to;
    }
  }
  for (const c of node.children) rewriteScreenTargets(c, from, to);
}

export function removeScreen(loaded: LoadedProject, screenId: string): void {
  if (loaded.project.screens.length <= 1) {
    throw new ForgeError(ErrorCodes.E_SEM_001, "cannot remove the last screen");
  }
  const ref = loaded.project.screens.find((s) => s.id === screenId);
  if (!ref) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  loaded.project.screens = loaded.project.screens.filter((s) => s.id !== screenId);
  loaded.screens.delete(screenId);
  const file = path.join(loaded.root, ref.file);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  if (loaded.project.defaultScreen === screenId) {
    loaded.project.defaultScreen = loaded.project.screens[0]!.id;
  }
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

export function duplicateScreen(
  loaded: LoadedProject,
  screenId: string,
  opts: { newId?: string; name?: string } = {},
): ScreenDocument {
  const source = loaded.screens.get(screenId);
  if (!source) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const idx = loaded.project.screens.findIndex((s) => s.id === screenId);

  let n = loaded.project.screens.length + 1;
  let newId = opts.newId ?? `${screenId}_copy`;
  while (loaded.screens.has(newId) || loaded.project.screens.some((s) => s.id === newId)) {
    n += 1;
    newId = opts.newId ? `${opts.newId}_${n}` : `${screenId}_copy_${n}`;
  }
  if (!IDENTIFIER_RE.test(newId)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `invalid screen id: ${newId}`);
  }

  const clone = deepCloneNode(source);
  clone.id = newId;
  clone.name = opts.name ?? `${source.name} 副本`;
  const file = `screens/${newId}.json`;
  loaded.screens.set(newId, clone);
  loaded.project.screens.splice(idx + 1, 0, { id: newId, file });
  return clone;
}

export type ReorderWhere = "up" | "down" | "top" | "bottom";

export function reorderScreen(loaded: LoadedProject, screenId: string, where: ReorderWhere): void {
  const arr = loaded.project.screens;
  const idx = arr.findIndex((s) => s.id === screenId);
  if (idx < 0) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const [item] = arr.splice(idx, 1);
  let newIdx: number;
  switch (where) {
    case "up":
      newIdx = Math.max(0, idx - 1);
      break;
    case "down":
      newIdx = Math.min(arr.length, idx + 1);
      break;
    case "top":
      newIdx = 0;
      break;
    case "bottom":
      newIdx = arr.length;
      break;
  }
  arr.splice(newIdx, 0, item);
}

export function setDefaultScreen(loaded: LoadedProject, screenId: string): void {
  updateProjectMeta(loaded, { defaultScreen: screenId });
}

export function duplicateNode(loaded: LoadedProject, screenId: string, nodeId: string): Node {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  if (nodeId === screenId) throw new ForgeError(ErrorCodes.E_SEM_001, "cannot duplicate screen root");
  const hit = walkParent(screen, nodeId);
  if (!hit?.parent) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);

  const clone = deepCloneNode(hit.node);
  reassignNodeIds(clone, screen);
  clone.frame = {
    ...clone.frame,
    x: clone.frame.x + 12,
    y: clone.frame.y + 12,
  };
  const idx = hit.parent.children.findIndex((c) => c.id === nodeId);
  hit.parent.children.splice(idx + 1, 0, clone);
  return clone;
}

export function moveNodeOrder(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  where: ReorderWhere,
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  if (nodeId === screenId) throw new ForgeError(ErrorCodes.E_SEM_001, "cannot reorder screen root");
  const hit = walkParent(screen, nodeId);
  if (!hit?.parent) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);

  const siblings = hit.parent.children;
  const idx = siblings.findIndex((c) => c.id === nodeId);
  if (idx < 0) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  const [item] = siblings.splice(idx, 1);
  let newIdx: number;
  switch (where) {
    case "up":
      newIdx = Math.max(0, idx - 1);
      break;
    case "down":
      newIdx = Math.min(siblings.length, idx + 1);
      break;
    case "top":
      newIdx = 0;
      break;
    case "bottom":
      newIdx = siblings.length;
      break;
  }
  siblings.splice(newIdx, 0, item);
}

export function setNodeFlags(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  flags: { locked?: boolean; hidden?: boolean },
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const node = findNode(screen, nodeId);
  if (!node) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  if (flags.locked !== undefined) node.locked = flags.locked;
  if (flags.hidden !== undefined) node.hidden = flags.hidden;
}

/** Snap selected node edges to nearest siblings (8px threshold). */
export function alignNodeToNeighbors(
  loaded: LoadedProject,
  screenId: string,
  nodeId: string,
  threshold = 8,
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const hit = walkParent(screen, nodeId);
  if (!hit?.parent) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
  const node = hit.node;
  const siblings = hit.parent.children.filter((c) => c.id !== nodeId);
  let { x, y } = node.frame;
  for (const s of siblings) {
    if (Math.abs(x - s.frame.x) <= threshold) x = s.frame.x;
    if (Math.abs(y - s.frame.y) <= threshold) y = s.frame.y;
    if (Math.abs(x + node.frame.w - (s.frame.x + s.frame.w)) <= threshold) {
      x = s.frame.x + s.frame.w - node.frame.w;
    }
    if (Math.abs(y + node.frame.h - (s.frame.y + s.frame.h)) <= threshold) {
      y = s.frame.y + s.frame.h - node.frame.h;
    }
  }
  node.frame.x = Math.max(0, Math.round(x));
  node.frame.y = Math.max(0, Math.round(y));
}

/** Patch project.json meta fields (FR-002). Does not rewrite screens. */
export function updateProjectMeta(
  loaded: LoadedProject,
  patch: {
    name?: string;
    platform?: LoadedProject["project"]["platform"];
    display?: Partial<LoadedProject["project"]["display"]>;
    lvglVersion?: string;
    previewBackend?: LoadedProject["project"]["previewBackend"];
    deliveryMode?: LoadedProject["project"]["deliveryMode"];
    entrySymbol?: string;
    defaultScreen?: string;
    sdk?: Partial<NonNullable<LoadedProject["project"]["sdk"]>>;
  },
): void {
  const p = loaded.project;
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.platform !== undefined) p.platform = patch.platform;
  if (patch.display) {
    p.display = { ...p.display, ...patch.display };
    const w = patch.display.width;
    const h = patch.display.height;
    if (w !== undefined || h !== undefined) {
      for (const screen of loaded.screens.values()) {
        if (w !== undefined) screen.frame.w = w;
        if (h !== undefined) screen.frame.h = h;
      }
    }
  }
  if (patch.lvglVersion !== undefined) p.lvglVersion = patch.lvglVersion;
  if (patch.previewBackend !== undefined) p.previewBackend = patch.previewBackend;
  if (patch.deliveryMode !== undefined) p.deliveryMode = patch.deliveryMode;
  if (patch.entrySymbol !== undefined) p.entrySymbol = patch.entrySymbol;
  if (patch.defaultScreen !== undefined) {
    if (!loaded.screens.has(patch.defaultScreen)) {
      throw new ForgeError(ErrorCodes.E_SEM_001, `defaultScreen not found: ${patch.defaultScreen}`);
    }
    p.defaultScreen = patch.defaultScreen;
  }
  if (patch.sdk) p.sdk = { ...(p.sdk ?? {}), ...patch.sdk };
}
