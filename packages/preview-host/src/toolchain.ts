import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveWinToolsRoot } from "./win-tools.js";

export interface PreviewToolchain {
  cmakePath: string;
  generator?: string;
  buildType: "Release" | "Debug";
  buildParallel: string;
  pathPrefix: string[];
  /** Extra env (e.g. CC/CXX for Ninja+MinGW). */
  env?: Record<string, string>;
  label: string;
}

function existsFile(p: string): boolean {
  return fs.existsSync(p);
}

function findOnPath(exe: string): string | null {
  const pathEnv = process.env.PATH ?? process.env.Path ?? "";
  const names =
    process.platform === "win32" && !exe.toLowerCase().endsWith(".exe")
      ? [exe, `${exe}.exe`]
      : [exe];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (existsFile(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Prefer bundled MinGW (+ Ninja/ccache) — same model as Beken tools/win.
 * Product path: xos-package/tools/win (also staged into forgeui-root).
 * Override: FORGEUI_PREVIEW_GENERATOR=Visual Studio 17 2022 | MinGW Makefiles | Ninja | default
 */
export function resolvePreviewToolchain(
  repoRoot: string,
  fallbackCmake: string,
): PreviewToolchain {
  const forceGen = (process.env.FORGEUI_PREVIEW_GENERATOR ?? "").trim();
  const cpus = Math.max(2, os.cpus().length);
  const toolsWin = resolveWinToolsRoot(repoRoot);
  const w64 = toolsWin ? path.join(toolsWin, "w64devkit/bin") : "";
  const bundledCmake = toolsWin ? path.join(toolsWin, "cmake/bin/cmake.exe") : "";
  const ccacheDir = toolsWin ? path.join(toolsWin, "w64devkit/lib/ccache") : "";
  const sdlBin = toolsWin ? path.join(toolsWin, "sdl2/bin") : "";

  if (forceGen && forceGen.toLowerCase() !== "default" && !/^visual studio/i.test(forceGen)) {
    const gcc = findOnPath("gcc");
    const gxx = findOnPath("g++");
    const prefix = gcc ? [path.dirname(gcc)] : [];
    return {
      cmakePath: fallbackCmake,
      generator: forceGen,
      buildType: "Release",
      buildParallel: String(cpus),
      pathPrefix: prefix,
      env: {
        ...(gcc ? { CC: gcc } : {}),
        ...(gxx ? { CXX: gxx } : {}),
      },
      label: `forced ${forceGen} + Release + parallel`,
    };
  }

  if (forceGen && /^visual studio|default$/i.test(forceGen)) {
    return {
      cmakePath: fallbackCmake,
      buildType: "Release",
      buildParallel: String(cpus),
      pathPrefix: [],
      label: "default cmake (MSVC) + Release + parallel",
    };
  }

  if (process.platform === "win32" && w64 && existsFile(path.join(w64, "gcc.exe"))) {
    const cmakePath = bundledCmake && existsFile(bundledCmake) ? bundledCmake : fallbackCmake;
    const pathPrefix = [ccacheDir, w64, path.dirname(cmakePath), sdlBin].filter(existsFile);
    const hasCcache = pathPrefix.includes(ccacheDir) && existsFile(path.join(ccacheDir, "ccache.exe"));
    const ninja = existsFile(path.join(w64, "ninja.exe"));
    return {
      cmakePath,
      generator: ninja ? "Ninja" : "MinGW Makefiles",
      buildType: "Release",
      buildParallel: String(cpus),
      pathPrefix,
      env: {
        CC: path.join(w64, "gcc.exe"),
        CXX: path.join(w64, "g++.exe"),
      },
      label: hasCcache
        ? `MinGW (w64devkit${ninja ? "+Ninja" : ""}) + ccache + Release + parallel`
        : `MinGW (w64devkit${ninja ? "+Ninja" : ""}) + Release + parallel`,
    };
  }

  // System MinGW (WinGet WinLibs, MSYS2, …) — avoids slow full MSVC LVGL rebuilds.
  if (process.platform === "win32") {
    const gcc = findOnPath("gcc");
    const gxx = findOnPath("g++");
    const ninja = findOnPath("ninja");
    const mingwMake = findOnPath("mingw32-make");
    if (gcc && (ninja || mingwMake)) {
      const gccDir = path.dirname(gcc);
      const ccache = findOnPath("ccache");
      const pathPrefix = [gccDir, ...(ccache ? [path.dirname(ccache)] : [])];
      const generator = ninja ? "Ninja" : "MinGW Makefiles";
      return {
        cmakePath: fallbackCmake,
        generator,
        buildType: "Release",
        buildParallel: String(cpus),
        pathPrefix,
        env: {
          CC: gcc,
          ...(gxx ? { CXX: gxx } : {}),
        },
        label: ccache
          ? `MinGW (PATH${ninja ? "+Ninja" : ""}) + ccache + Release + parallel`
          : `MinGW (PATH${ninja ? "+Ninja" : ""}) + Release + parallel`,
      };
    }
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
