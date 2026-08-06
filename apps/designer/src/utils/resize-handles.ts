/**
 * Beken-aligned 8-direction resize for canvas selection handles.
 * Directions: four corners + four edge midpoints.
 */

export type ResizeHandleDir = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

export type FrameRect = { x: number; y: number; w: number; h: number };

export const RESIZE_HANDLE_DIRS: readonly ResizeHandleDir[] = [
  "tl",
  "tc",
  "tr",
  "ml",
  "mr",
  "bl",
  "bc",
  "br",
] as const;

export const RESIZE_MIN_SIZE = 16;

export function resizeHandleCursor(dir: ResizeHandleDir): string {
  switch (dir) {
    case "tl":
    case "br":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    case "ml":
    case "mr":
      return "ew-resize";
    case "tc":
    case "bc":
      return "ns-resize";
  }
}

/**
 * Apply pointer delta (already divided by zoom) to the start frame for one handle.
 * Keeps opposite edges fixed; clamps w/h to RESIZE_MIN_SIZE.
 */
export function applyResizeDelta(
  start: FrameRect,
  dir: ResizeHandleDir,
  dx: number,
  dy: number,
  minSize = RESIZE_MIN_SIZE,
): FrameRect {
  let { x, y, w, h } = start;
  const right = x + w;
  const bottom = y + h;

  const fromLeft = dir === "tl" || dir === "ml" || dir === "bl";
  const fromRight = dir === "tr" || dir === "mr" || dir === "br";
  const fromTop = dir === "tl" || dir === "tc" || dir === "tr";
  const fromBottom = dir === "bl" || dir === "bc" || dir === "br";

  if (fromRight) {
    w = Math.max(minSize, Math.round(start.w + dx));
  }
  if (fromLeft) {
    const nextW = Math.max(minSize, Math.round(start.w - dx));
    x = Math.round(right - nextW);
    w = nextW;
  }
  if (fromBottom) {
    h = Math.max(minSize, Math.round(start.h + dy));
  }
  if (fromTop) {
    const nextH = Math.max(minSize, Math.round(start.h - dy));
    y = Math.round(bottom - nextH);
    h = nextH;
  }

  return { x, y, w, h };
}
