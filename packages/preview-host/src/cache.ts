import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openProject, resolveCodegenPaths } from "@forgeui/core";

export const PREVIEW_TEMPLATE_VERSION = "7";

export interface PreviewBuildCache {
  fingerprint: string;
  configuredAt: string;
  generator?: string;
  buildType: string;
}

export interface PreviewFingerprintInput {
  templateVersion: string;
  projectRoot: string;
  templateDir: string;
  lvglRoot: string;
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

/** Screen file set — GLOB in CMakeLists needs reconfigure when this changes. */
export function generatedScreensListing(projectRoot: string): string {
  const screens = path.join(resolveGeneratedRoot(projectRoot), "screens");
  if (!fs.existsSync(screens)) return "";
  return fs
    .readdirSync(screens)
    .filter((n) => n.endsWith(".c"))
    .sort()
    .join(",");
}

/** Content hash for logging only; build picks up changes via cmake deps without reconfigure. */
export function generatedSourcesFingerprint(projectRoot: string): string {
  const gen = resolveGeneratedRoot(projectRoot);
  const parts: string[] = [];
  for (const rel of ["ui.c", "ui_nav.c", "ui.h"]) {
    parts.push(`${rel}=${fileContentHash(path.join(gen, rel))}`);
  }
  const screens = path.join(gen, "screens");
  if (fs.existsSync(screens)) {
    for (const name of fs.readdirSync(screens).sort()) {
      if (name.endsWith(".c")) parts.push(`screens/${name}=${fileContentHash(path.join(screens, name))}`);
    }
  }
  return hashParts(parts);
}

export function computeConfigureFingerprint(input: PreviewFingerprintInput): string {
  const templateFiles = ["CMakeLists.txt", "main.c", "hal.c", "lv_conf.h", "optimize_drivers.cmake"];
  const templateSigs = templateFiles.map((n) => `${n}=${fileContentHash(path.join(input.templateDir, n))}`);
  return hashParts([
    input.templateVersion,
    input.lvglRoot,
    input.sdl2Root,
    input.repoRoot,
    input.generator ?? "default",
    `${input.display.width}x${input.display.height}x${input.display.colorDepth}`,
    input.lvglVersion,
    generatedScreensListing(input.projectRoot),
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
