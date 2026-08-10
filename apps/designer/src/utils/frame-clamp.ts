/** Mirror of core `clampFrameWithinParent` for designer live drag (no core barrel). */
export type FrameBox = { x: number; y: number; w: number; h: number };

export function clampFrameToParent(
  frame: Partial<FrameBox> & { x?: number; y?: number; w?: number; h?: number },
  parentW: number,
  parentH: number,
): FrameBox {
  const pw = Math.max(1, Math.round(Number(parentW)) || 1);
  const ph = Math.max(1, Math.round(Number(parentH)) || 1);
  let w = Math.max(1, Math.round(Number(frame.w) || 1));
  let h = Math.max(1, Math.round(Number(frame.h) || 1));
  w = Math.min(w, pw);
  h = Math.min(h, ph);
  let x = Math.round(Number(frame.x) || 0);
  let y = Math.round(Number(frame.y) || 0);
  x = Math.min(Math.max(0, x), Math.max(0, pw - w));
  y = Math.min(Math.max(0, y), Math.max(0, ph - h));
  return { x, y, w, h };
}
