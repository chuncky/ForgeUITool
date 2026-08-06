import type { Action, LoadedProject, Node, ProjectDocument, ScreenDocument } from "./types.js";
import { resolveStyleWithRef } from "./themes.js";

export interface WidgetIR {
  type: string;
  id: string;
  name: string;
  frame: Node["frame"];
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  styleRef?: string;
  extraData?: Record<string, unknown>;
  events: Array<{ trigger: string; actions: Action[] }>;
  children: WidgetIR[];
}

export interface ScreenIR {
  id: string;
  name: string;
  root: WidgetIR;
}

export interface ProjectIR {
  meta: ProjectDocument;
  screens: ScreenIR[];
  callHandlers: string[];
  cPrefix: string;
  screenPrefix: string;
  entrySymbol: string;
}

function toWidgetIR(node: Node, themes: ProjectDocument["themes"]): WidgetIR {
  return {
    type: node.type,
    id: node.id,
    name: node.name,
    frame: node.frame,
    props: node.props ?? {},
    style: resolveStyleWithRef(node.style, node.styleRef, themes),
    styleRef: node.styleRef,
    extraData: node.extraData,
    events: (node.events ?? []).map((e) => ({ trigger: e.trigger, actions: e.actions })),
    children: (node.children ?? []).map((c) => toWidgetIR(c, themes)),
  };
}

function collectHandlers(node: Node, out: Set<string>): void {
  for (const ev of node.events ?? []) {
    for (const action of ev.actions) {
      if (action.type === "CALL_FUNCTION" && action.handler) out.add(action.handler);
    }
  }
  for (const child of node.children ?? []) collectHandlers(child, out);
}

export function buildIR(loaded: LoadedProject): ProjectIR {
  const handlers = new Set<string>();
  const screens: ScreenIR[] = [];
  const themes = loaded.project.themes;

  for (const ref of loaded.project.screens) {
    const doc = loaded.screens.get(ref.id) as ScreenDocument;
    collectHandlers(doc, handlers);
    screens.push({
      id: doc.id,
      name: doc.name,
      root: toWidgetIR(doc, themes),
    });
  }

  return {
    meta: loaded.project,
    screens,
    callHandlers: [...handlers].sort(),
    cPrefix: loaded.project.naming?.cPrefix ?? "ui_",
    screenPrefix: loaded.project.naming?.screenPrefix ?? "screen_",
    entrySymbol: loaded.project.entrySymbol,
  };
}

export function symbolFor(screenId: string, nodeId: string, cPrefix: string): string {
  if (nodeId === screenId) return `${cPrefix}${screenId}`;
  return `${cPrefix}${screenId}_${nodeId}`;
}
