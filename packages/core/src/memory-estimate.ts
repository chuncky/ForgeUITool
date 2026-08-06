import type { LoadedProject, ProjectDocument } from "./types.js";
import { normalizeImageAssets } from "./assets.js";
import { normalizeFontAssets } from "./fonts.js";
import { normalizeAnimations } from "./animations.js";

export interface DisplayTarget {
  id: string;
  name: string;
  width: number;
  height: number;
  colorDepth: number;
}

export interface MemoryEstimate {
  imagesBytes: number;
  fontsEstimateBytes: number;
  screensBytes: number;
  animEstimateBytes: number;
  totalBytes: number;
  notes: string[];
}

/** Rough flash/RAM budget estimate (FR-076). */
export function estimateProjectMemory(loaded: LoadedProject): MemoryEstimate {
  const notes: string[] = [];
  const images = normalizeImageAssets(loaded.project);
  // Rough: each image asset ≈ 64×64 ARGB if size unknown
  const imagesBytes = images.length * 64 * 64 * 4;
  if (images.length) notes.push(`${images.length} image(s) ≈ 64×64 ARGB8888 each (rough)`);

  const fonts = normalizeFontAssets(loaded.project);
  const fontsEstimateBytes = fonts.length * 12_000;
  if (fonts.length) notes.push(`${fonts.length} font(s) ≈ 12KB bitmap each (rough)`);

  let nodeCount = 0;
  for (const screen of loaded.screens.values()) {
    const walk = (n: { children?: unknown[] }) => {
      nodeCount += 1;
      for (const c of n.children ?? []) walk(c as { children?: unknown[] });
    };
    walk(screen);
  }
  const screensBytes = nodeCount * 256;
  notes.push(`${nodeCount} widget node(s) × 256B meta`);

  const anims = normalizeAnimations(loaded.project);
  const animEstimateBytes = anims.reduce((acc, a) => acc + a.tracks.length * 64 + 128, 0);

  return {
    imagesBytes,
    fontsEstimateBytes,
    screensBytes,
    animEstimateBytes,
    totalBytes: imagesBytes + fontsEstimateBytes + screensBytes + animEstimateBytes,
    notes,
  };
}

export function normalizeTargets(project: ProjectDocument): DisplayTarget[] {
  const raw = project.targets;
  if (!Array.isArray(raw) || !raw.length) {
    return [
      {
        id: "default",
        name: "Default",
        width: project.display.width,
        height: project.display.height,
        colorDepth: project.display.colorDepth,
      },
    ];
  }
  return raw
    .filter((t): t is DisplayTarget => !!t && typeof t === "object" && typeof t.id === "string")
    .map((t) => ({
      id: t.id,
      name: typeof t.name === "string" ? t.name : t.id,
      width: Number(t.width) || project.display.width,
      height: Number(t.height) || project.display.height,
      colorDepth: Number(t.colorDepth) || project.display.colorDepth,
    }));
}
