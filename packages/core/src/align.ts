import type { LoadedProject, Node } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";
import { findNode } from "./mutate.js";

export type AlignMode = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

function nodeBox(node: Node): Box {
  const { x, y, w, h } = node.frame;
  return { minX: x, minY: y, maxX: x + w, maxY: y + h, w, h };
}

function unionBox(boxes: Box[]): Box {
  const minX = Math.min(...boxes.map((b) => b.minX));
  const minY = Math.min(...boxes.map((b) => b.minY));
  const maxX = Math.max(...boxes.map((b) => b.maxX));
  const maxY = Math.max(...boxes.map((b) => b.maxY));
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function screenBox(screen: Node): Box {
  return {
    minX: 0,
    minY: 0,
    maxX: screen.frame.w,
    maxY: screen.frame.h,
    w: screen.frame.w,
    h: screen.frame.h,
  };
}

/** FR-013b: align nodes to selection bbox (multi) or screen (single). */
export function alignNodes(
  loaded: LoadedProject,
  screenId: string,
  nodeIds: string[],
  mode: AlignMode,
): void {
  const screen = loaded.screens.get(screenId);
  if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${screenId} not found`);
  const ids = [...new Set(nodeIds.filter((id) => id && id !== screenId))];
  if (!ids.length) return;

  const nodes: Node[] = [];
  for (const id of ids) {
    const n = findNode(screen, id);
    if (n) nodes.push(n);
  }
  if (!nodes.length) return;

  const ref = nodes.length === 1 ? screenBox(screen) : unionBox(nodes.map(nodeBox));

  for (const node of nodes) {
    const { w, h } = node.frame;
    let x = node.frame.x;
    let y = node.frame.y;
    switch (mode) {
      case "left":
        x = ref.minX;
        break;
      case "center-h":
        x = ref.minX + (ref.w - w) / 2;
        break;
      case "right":
        x = ref.maxX - w;
        break;
      case "top":
        y = ref.minY;
        break;
      case "center-v":
        y = ref.minY + (ref.h - h) / 2;
        break;
      case "bottom":
        y = ref.maxY - h;
        break;
    }
    node.frame.x = Math.max(0, Math.round(x));
    node.frame.y = Math.max(0, Math.round(y));
  }
}
