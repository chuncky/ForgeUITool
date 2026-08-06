import type { LoadedProject, Node } from "@forgeui/core";
import { encodeRgbaPng, scaleRgbaNearest } from "./png-utils.js";

const TYPE_COLORS: Record<string, [number, number, number]> = {
  screen: [0x2a, 0x2a, 0x2e],
  label: [0x4a, 0x90, 0xe2],
  button: [0x50, 0xc8, 0x78],
  image: [0xe9, 0x4e, 0x77],
  container: [0xbd, 0x93, 0xf9],
  panel: [0x8b, 0x94, 0x9e],
};

function colorForType(type: string): [number, number, number] {
  return TYPE_COLORS[type] ?? [0x6c, 0x75, 0x7d];
}

function fillRect(
  rgba: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(w, Math.ceil(x + rw));
  const y1 = Math.min(h, Math.ceil(y + rh));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const i = (py * w + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
}

function strokeRect(
  rgba: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
): void {
  fillRect(rgba, w, h, x, y, rw, 1, r, g, b);
  fillRect(rgba, w, h, x, y + rh - 1, rw, 1, r, g, b);
  fillRect(rgba, w, h, x, y, 1, rh, r, g, b);
  fillRect(rgba, w, h, x + rw - 1, y, 1, rh, r, g, b);
}

function walkNodes(node: Node, visit: (n: Node) => void): void {
  if (node.hidden) return;
  visit(node);
  for (const child of node.children) walkNodes(child, visit);
}

/**
 * Headless wireframe PNG of a screen tree (MCP visual check; not pixel-perfect LVGL).
 */
export function renderScreenWireframePng(
  loaded: LoadedProject,
  screenId: string,
  maxWidth?: number,
): { mime: "image/png"; base64: string; width: number; height: number; mode: "wireframe" } {
  const screen = loaded.screens.get(screenId);
  if (!screen) {
    throw new Error(`screen not found: ${screenId}`);
  }
  const srcW = loaded.project.display.width;
  const srcH = loaded.project.display.height;
  const rgba = new Uint8Array(srcW * srcH * 4);
  fillRect(rgba, srcW, srcH, 0, 0, srcW, srcH, 0x1e, 0x1e, 0x1e);
  fillRect(rgba, srcW, srcH, 2, 2, srcW - 4, srcH - 4, 0xf5, 0xf5, 0xf5);

  walkNodes(screen, (n) => {
    if (n.type === "screen") return;
    const { x, y, w: fw, h: fh } = n.frame;
    const [r, g, b] = colorForType(n.type);
    fillRect(rgba, srcW, srcH, x, y, fw, fh, r, g, b, 48);
    strokeRect(rgba, srcW, srcH, x, y, fw, fh, r, g, b);
  });

  let outW = srcW;
  let outH = srcH;
  let outRgba: Uint8Array = rgba;
  if (typeof maxWidth === "number" && maxWidth > 0 && maxWidth < srcW) {
    outW = maxWidth;
    outH = Math.max(1, Math.round((srcH * maxWidth) / srcW));
    outRgba = scaleRgbaNearest(srcW, srcH, rgba, outW, outH);
  }

  const png = encodeRgbaPng(outW, outH, outRgba);
  return {
    mime: "image/png",
    base64: png.toString("base64"),
    width: outW,
    height: outH,
    mode: "wireframe",
  };
}
