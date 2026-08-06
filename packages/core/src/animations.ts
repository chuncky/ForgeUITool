import type { ProjectDocument } from "./types.js";
import { uniqueId } from "./themes.js";

export const ANIM_PROPERTIES = ["x", "y", "w", "h", "opacity", "rotation"] as const;
export type AnimProperty = (typeof ANIM_PROPERTIES)[number];

export const ANIM_EASINGS = ["linear", "ease_in", "ease_out", "ease_in_out"] as const;
export type AnimEasing = (typeof ANIM_EASINGS)[number];

export interface AnimKeyframe {
  /** Time offset in ms from animation start */
  t: number;
  value: number;
  easing?: AnimEasing;
}

export interface AnimTrack {
  id: string;
  nodeId: string;
  property: AnimProperty;
  keyframes: AnimKeyframe[];
}

export interface TimelineAnimation {
  id: string;
  name: string;
  /** Total duration in ms */
  duration: number;
  loop?: boolean;
  tracks: AnimTrack[];
}

export function normalizeAnimations(project: ProjectDocument): TimelineAnimation[] {
  const raw = project.animations;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is TimelineAnimation => !!a && typeof a === "object" && typeof a.id === "string")
    .map((a) => ({
      id: a.id,
      name: typeof a.name === "string" ? a.name : a.id,
      duration: typeof a.duration === "number" && a.duration > 0 ? Math.round(a.duration) : 1000,
      loop: !!a.loop,
      tracks: Array.isArray(a.tracks)
        ? a.tracks
            .filter((t): t is AnimTrack => !!t && typeof t === "object" && typeof t.nodeId === "string")
            .map((t) => ({
              id: typeof t.id === "string" ? t.id : uniqueId("track", new Set()),
              nodeId: t.nodeId,
              property: ANIM_PROPERTIES.includes(t.property as AnimProperty)
                ? (t.property as AnimProperty)
                : "opacity",
              keyframes: Array.isArray(t.keyframes)
                ? t.keyframes
                    .filter((k): k is AnimKeyframe => !!k && typeof k === "object" && typeof k.t === "number")
                    .map((k) => ({
                      t: Math.max(0, Math.round(k.t)),
                      value: Number(k.value) || 0,
                      easing: ANIM_EASINGS.includes(k.easing as AnimEasing)
                        ? (k.easing as AnimEasing)
                        : "linear",
                    }))
                    .sort((x, y) => x.t - y.t)
                : [],
            }))
        : [],
    }));
}

export function createTimelineAnimation(
  existing: TimelineAnimation[],
  opts: { name?: string; duration?: number } = {},
): TimelineAnimation {
  const ids = new Set(existing.map((a) => a.id));
  const id = uniqueId("anim", ids);
  return {
    id,
    name: opts.name ?? `Animation ${existing.length + 1}`,
    duration: opts.duration ?? 1000,
    loop: false,
    tracks: [],
  };
}

export function createAnimTrack(
  anim: TimelineAnimation,
  opts: { nodeId: string; property?: AnimProperty },
): AnimTrack {
  const ids = new Set(anim.tracks.map((t) => t.id));
  const track: AnimTrack = {
    id: uniqueId("track", ids),
    nodeId: opts.nodeId,
    property: opts.property ?? "opacity",
    keyframes: [
      { t: 0, value: opts.property === "opacity" ? 0 : 0, easing: "linear" },
      { t: anim.duration, value: opts.property === "opacity" ? 255 : 100, easing: "linear" },
    ],
  };
  anim.tracks.push(track);
  return track;
}

/** Sample track value at time t (ms) with linear interpolation between keyframes. */
export function sampleTrackValue(track: AnimTrack, tMs: number): number | undefined {
  const kfs = track.keyframes;
  if (!kfs.length) return undefined;
  if (tMs <= kfs[0]!.t) return kfs[0]!.value;
  const last = kfs[kfs.length - 1]!;
  if (tMs >= last.t) return last.value;
  for (let i = 0; i < kfs.length - 1; i += 1) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    if (tMs >= a.t && tMs <= b.t) {
      const span = b.t - a.t || 1;
      const u = (tMs - a.t) / span;
      return a.value + (b.value - a.value) * u;
    }
  }
  return last.value;
}
