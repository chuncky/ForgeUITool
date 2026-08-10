import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openProject, resolveCodegenPaths } from "@forgeui/core";

/** Bump when configure inputs change (e.g. GLOB dirs that must reconfigure). */
export const PREVIEW_TEMPLATE_VERSION = "10";

export interface PreviewBuildCache {
  fingerprint: string;
  configuredAt: string;
  generator?: string;
  buildType: string;
  /** Product LVGL tree stamp; change ⇒ wipe lvgl_build objs only (keep SDL). */
  lvglStamp?: string;
}

export interface PreviewFingerprintInput {
  templateVersion: string;
  projectRoot: string;
  templateDir: string;
  lvglRoot: string;
  /** Hash of lvgl.h + blend dir listing (detect wrong hybrid trees). */
  lvglStamp: string;
  sdl2Root: string;
  repoRoot: string;
  display: { width: number; height: number; colorDepth: number };
  lvglVersion: string;
  generator?: string;
}

function hashParts(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 20);
}

function fileContentHash(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
}

function resolveGeneratedRoot(projectRoot: string): string {
  try {
    const loaded = openProject(projectRoot);
    return resolveCodegenPaths(loaded.root, loaded.project).codegenAbs;
  } catch {
    return path.join(projectRoot, "forgeui_generated");
  }
}

/**
 * Source file set under forgeui_generated that CMake `file(GLOB_RECURSE …/*.c)` captures
 * at configure time. Adding image/*.c or fonts/*.c without reconfigure → link undefined ref.
 * FR-016e / preview: property edits that introduce assets MUST change this listing.
 */
export function generatedScreensListing(projectRoot: string): string {
  return generatedAssetSourcesListing(projectRoot);
}

/** screens/ + image/ + fonts/ .c basenames (sorted) for configure fingerprint. */
export function generatedAssetSourcesListing(projectRoot: string): string {
  const gen = resolveGeneratedRoot(projectRoot);
  const names: string[] = [];
  for (const sub of ["screens", "image", "fonts"]) {
    const dir = path.join(gen, sub);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      if (n.endsWith(".c")) names.push(`${sub}/${n}`);
    }
  }
  return names.sort().join(",");
}

/** Content hash for logging only; build picks up content edits via cmake deps without reconfigure. */
export function generatedSourcesFingerprint(projectRoot: string): string {
  const gen = resolveGeneratedRoot(projectRoot);
  const parts: string[] = [];
  for (const rel of ["ui.c", "ui_nav.c", "ui.h"]) {
    parts.push(`${rel}=${fileContentHash(path.join(gen, rel))}`);
  }
  for (const sub of ["screens", "image", "fonts"]) {
    const dir = path.join(gen, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith(".c")) {
        parts.push(`${sub}/${name}=${fileContentHash(path.join(dir, name))}`);
      }
    }
  }
  return hashParts(parts);
}

/**
 * Stamp product LVGL so packaging the wrong hybrid tree (stock al88 + QM `_` typedefs)
 * forces reconfigure + lvgl object wipe without discarding SDL build trees.
 */
export function computeLvglStamp(lvglRoot: string): string {
  const root = path.resolve(lvglRoot);
  const blendDir = path.join(root, "src/draw/sw/blend");
  const blendNames = fs.existsSync(blendDir)
    ? fs
        .readdirSync(blendDir)
        .filter((n) => n.startsWith("lv_draw_sw_blend"))
        .sort()
        .join(",")
    : "";
  const cCount = countCFiles(path.join(root, "src"));
  return hashParts([fileContentHash(path.join(root, "lvgl.h")), blendNames, `c:${cCount}`]);
}

function countCFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".c")) n += 1;
    }
  };
  walk(dir);
  return n;
}

export function computeConfigureFingerprint(input: PreviewFingerprintInput): string {
  const templateFiles = [
    "CMakeLists.txt",
    "main.c",
    "hal.c",
    "lv_conf.h",
    "lv_drv_conf.h",
    "optimize_drivers.cmake",
  ];
  const templateSigs = templateFiles.map((n) => `${n}=${fileContentHash(path.join(input.templateDir, n))}`);
  return hashParts([
    input.templateVersion,
    input.lvglRoot,
    input.lvglStamp,
    input.sdl2Root,
    input.repoRoot,
    input.generator ?? "default",
    `${input.display.width}x${input.display.height}x${input.display.colorDepth}`,
    input.lvglVersion,
    generatedAssetSourcesListing(input.projectRoot),
    ...templateSigs,
  ]);
}

export function computePreviewFingerprint(input: PreviewFingerprintInput): string {
  return hashParts([computeConfigureFingerprint(input), generatedSourcesFingerprint(input.projectRoot)]);
}

export function readBuildCache(outDir: string): PreviewBuildCache | null {
  const file = path.join(outDir, "forgeui-build-cache.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PreviewBuildCache;
  } catch {
    return null;
  }
}

export function writeBuildCache(outDir: string, cache: PreviewBuildCache): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "forgeui-build-cache.json"), `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

/** Beken-style: drop CMake cache only, keep compiled objects for incremental rebuild. */
export function softCleanCmakeCache(outDir: string): void {
  for (const name of ["CMakeCache.txt", "CMakeFiles"]) {
    const target = path.join(outDir, name);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}

export function needsReconfigure(outDir: string, fingerprint: string): boolean {
  if (!fs.existsSync(path.join(outDir, "CMakeCache.txt"))) return true;
  const cached = readBuildCache(outDir);
  return !cached || cached.fingerprint !== fingerprint;
}

/** Human-readable hint when configure is required (for build logs). */
export function reconfigureReason(outDir: string, fingerprint: string): string {
  if (!fs.existsSync(path.join(outDir, "CMakeCache.txt"))) {
    return "first run or CMake cache missing";
  }
  const cached = readBuildCache(outDir);
  if (!cached) return "build cache metadata missing";
  if (cached.fingerprint !== fingerprint) return "project/template/toolchain inputs changed";
  return "unknown";
}
