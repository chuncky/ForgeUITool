/** Canvas rotation handle math — pivot = geometric center (matches CodeGen lv_pct(50)). */

export function normalizeRotationDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const n = Math.round(deg) % 360;
  return n < 0 ? n + 360 : n;
}

/** Angle in degrees from center to point (screen/client coords); 0 = east, CCW positive like atan2. */
export function angleDegFromCenter(
  centerX: number,
  centerY: number,
  pointX: number,
  pointY: number,
): number {
  return (Math.atan2(pointY - centerY, pointX - centerX) * 180) / Math.PI;
}

/**
 * New rotation while dragging: preserve startRotation + delta of pointer angles about center.
 */
export function applyRotationDrag(
  startRotationDeg: number,
  startPointerAngleDeg: number,
  currentPointerAngleDeg: number,
): number {
  const delta = currentPointerAngleDeg - startPointerAngleDeg;
  return normalizeRotationDeg(startRotationDeg + delta);
}
