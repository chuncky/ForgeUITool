import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PreviewToolchain {
  cmakePath: string;
  generator?: string;
  buildType: "Release" | "Debug";
  buildParallel: string;
  pathPrefix: string[];
  label: string;
}

function existsFile(p: string): boolean {
  return fs.existsSync(p);
}

/** Prefer Beken-bundled MinGW + cmake + ccache when present (matches competitor speed). */
export function resolvePreviewToolchain(
  repoRoot: string,
  fallbackCmake: string,
): PreviewToolchain {
  const w64 = path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/w64devkit/bin");
  const bekCmake = path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/cmake/bin/cmake.exe");
  const ccache = path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/w64devkit/lib/ccache");
  const sdlBin = path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/sdl2/bin");
  const cpus = Math.max(2, os.cpus().length);

  if (process.platform === "win32" && existsFile(path.join(w64, "gcc.exe"))) {
    const cmakePath = existsFile(bekCmake) ? bekCmake : fallbackCmake;
    const pathPrefix = [ccache, w64, path.dirname(cmakePath), sdlBin].filter(existsFile);
    const hasCcache = pathPrefix.includes(ccache) && existsFile(path.join(ccache, "ccache.exe"));
    return {
      cmakePath,
      generator: "MinGW Makefiles",
      buildType: "Release",
      buildParallel: String(cpus),
      pathPrefix,
      label: hasCcache
        ? "MinGW (w64devkit) + ccache + Release + parallel"
        : "MinGW (w64devkit) + Release + parallel",
    };
  }

  return {
    cmakePath: fallbackCmake,
    buildType: "Release",
    buildParallel: String(cpus),
    pathPrefix: [],
    label: "default cmake + Release + parallel",
  };
}

export function mergePathEnv(base: NodeJS.ProcessEnv, prefix: string[]): NodeJS.ProcessEnv {
  if (!prefix.length) return base;
  const env = { ...base };
  const merged = [...prefix, env.PATH ?? env.Path ?? ""].filter(Boolean).join(path.delimiter);
  env.PATH = merged;
  env.Path = merged;
  return env;
}
