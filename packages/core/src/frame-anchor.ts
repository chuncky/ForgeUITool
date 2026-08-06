import type { Frame } from "./types.js";

export type AnchorAxis = 0 | 1 | 2;

export function normalizeAnchor(frame: Frame): { anchorX: AnchorAxis; anchorY: AnchorAxis } {
  const ax = frame.anchorX;
  const ay = frame.anchorY;
  return {
    anchorX: ax === 1 || ax === 2 ? ax : 0,
    anchorY: ay === 1 || ay === 2 ? ay : 0,
  };
}

/** Offset of anchor point from widget top-left. */
export function anchorPoint(w: number, h: number, anchorX: AnchorAxis, anchorY: AnchorAxis): { px: number; py: number } {
  return {
    px: anchorX === 2 ? w : anchorX === 1 ? w / 2 : 0,
    py: anchorY === 2 ? h : anchorY === 1 ? h / 2 : 0,
  };
}

/** Keep visual position when user picks a new 3×3 anchor cell (pivot only; panel must NOT use this). */
export function reanchorFrame(frame: Frame, newAnchorX: AnchorAxis, newAnchorY: AnchorAxis): Partial<Frame> {
  const { anchorX, anchorY } = normalizeAnchor(frame);
  if (anchorX === newAnchorX && anchorY === newAnchorY) {
    return { anchorX: newAnchorX, anchorY: newAnchorY };
  }
  const oldPt = anchorPoint(frame.w, frame.h, anchorX, anchorY);
  const newPt = anchorPoint(frame.w, frame.h, newAnchorX, newAnchorY);
  const worldX = frame.x + oldPt.px;
  const worldY = frame.y + oldPt.py;
  return {
    x: Math.round(worldX - newPt.px),
    y: Math.round(worldY - newPt.py),
    anchorX: newAnchorX,
    anchorY: newAnchorY,
  };
}

/**
 * Snap widget top-left into the parent content box at a 3×3 cell (Beken position grid).
 * Coordinates are relative to the parent origin; negative offsets allowed when widget > parent.
 */
export function alignFrameToParent(
  frame: Frame,
  parentW: number,
  parentH: number,
  col: AnchorAxis,
  row: AnchorAxis,
): Partial<Frame> {
  const w = Math.max(0, frame.w);
  const h = Math.max(0, frame.h);
  const pw = Math.max(0, parentW);
  const ph = Math.max(0, parentH);

  const x =
    col === 0 ? 0 : col === 1 ? Math.round((pw - w) / 2) : Math.round(pw - w);
  const y =
    row === 0 ? 0 : row === 1 ? Math.round((ph - h) / 2) : Math.round(ph - h);

  return {
    x,
    y,
    anchorX: col,
    anchorY: row,
  };
}
