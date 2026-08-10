import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openProject, resolveCodegenPaths } from "@forgeui/core";
import { Diagnostic, ErrorCodes } from "@forgeui/shared";
import { runProcessAsync } from "./process.js";
import type { PreviewPrepareResult } from "./types.js";
import { resolveWinToolsRoot } from "./win-tools.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function cmakePathArg(p: string): string {
  return p.replace(/\\/g, "/");
}

function resolveCmake(): string | null {
  const env = process.env.FORGEUI_CMAKE ?? process.env.CMAKE;
  if (env && fs.existsSync(env)) return env;
  const toolsWin = resolveWinToolsRoot(repoRoot());
  const candidates = [
    "cmake",
    "C:\\Program Files\\CMake\\bin\\cmake.exe",
    "C:\\Program Files (x86)\\CMake\\bin\\cmake.exe",
    ...(toolsWin ? [path.join(toolsWin, "cmake/bin/cmake.exe")] : []),
  ];
  for (const c of candidates) {
    if (c === "cmake") return c;
    if (fs.existsSync(c)) return c;
  }
  return "cmake";
}

function resolveLvglRoot(): string | null {
  const env = process.env.FORGEUI_LVGL_ROOT;
  if (env && fs.existsSync(path.join(env, "lvgl.h"))) return path.resolve(env);
  if (env && fs.existsSync(path.join(env, "lvgl", "lvgl.h"))) return path.resolve(env);

  const root = repoRoot();
  for (const c of [
    path.join(root, "xos-package/lvgl"),
    path.join(root, "third_party/lvgl"),
  ]) {
    if (fs.existsSync(path.join(c, "lvgl.h"))) return c;
  }
  return null;
}

function resolveEmcmake(emccPath: string): string {
  const dir = path.dirname(emccPath);
  const name = process.platform === "win32" ? "emcmake.bat" : "emcmake";
  const full = path.join(dir, name);
  return fs.existsSync(full) ? full : "emcmake";
}

function copyArtifacts(outDir: string, destDir: string): string | null {
  const names = fs.readdirSync(outDir);
  let html: string | null = null;
  for (const name of names) {
    if (/^forgeui_preview.*\.(html|js|wasm)$/.test(name)) {
      const src = path.join(outDir, name);
      const dest = path.join(destDir, name);
      fs.copyFileSync(src, dest);
      if (name.endsWith(".html")) html = dest;
    }
  }
  return html;
}

export interface WasmEmccBuildInput {
  prepared: PreviewPrepareResult;
  projectRoot: string;
  emccPath: string;
  logLine: (line: string) => void;
  diagnostics: Diagnostic[];
}

/** Configure + build LVGL Wasm via emcmake when toolchain + LVGL are available. */
export async function buildWasmLvgl(input: WasmEmccBuildInput): Promise<boolean> {
  const { prepared, projectRoot, emccPath, logLine, diagnostics } = input;
  const lvglRoot = resolveLvglRoot();
  const cmakePath = resolveCmake();
  if (!cmakePath) {
    diagnostics.push({
      level: "warning",
      code: ErrorCodes.E_PREV_001,
      message: "未找到 cmake，跳过 Emscripten 编译（仍可用 IR shell）",
    });
    return false;
  }
  if (!lvglRoot) {
    diagnostics.push({
      level: "warning",
      code: ErrorCodes.E_PREV_001,
      message: "未找到 LVGL 源码，跳过 Emscripten 编译（仍可用 IR shell）",
    });
    return false;
  }

  const loaded = openProject(projectRoot);
  const paths = resolveCodegenPaths(projectRoot, loaded.project);
  const outDir = path.join(prepared.buildDir, "out-wasm");
  fs.mkdirSync(outDir, { recursive: true });

  const emcmake = resolveEmcmake(emccPath);
  const configureArgs = [
    "cmake",
    "-S",
    cmakePathArg(prepared.buildDir),
    "-B",
    cmakePathArg(outDir),
    "-DCMAKE_BUILD_TYPE=Release",
    `-DFORGEUI_PROJECT_ROOT=${cmakePathArg(projectRoot)}`,
    `-DFORGEUI_CODEGEN_DIR=${cmakePathArg(paths.codegenAbs)}`,
    `-DFORGEUI_LVGL_ROOT=${cmakePathArg(lvglRoot)}`,
    `-DFORGEUI_REPO_ROOT=${cmakePathArg(repoRoot())}`,
  ];

  logLine(`emcmake: ${emcmake}`);
  logLine("--- emcmake configure ---");
  const t0 = Date.now();
  const configure = await runProcessAsync(emcmake, configureArgs, {
    cwd: prepared.buildDir,
    onLine: (line) => logLine(line),
  });
  logLine(`[timing] emcmake configure: ${Date.now() - t0}ms`);
  if (configure.status !== 0) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_PREV_001,
      message: "emcmake configure 失败（详见构建日志）",
    });
    return false;
  }

  logLine("--- emscripten build ---");
  const t1 = Date.now();
  const build = await runProcessAsync(
    cmakePath,
    ["--build", cmakePathArg(outDir), "--parallel", String(Math.max(2, os.cpus().length - 1))],
    { cwd: prepared.buildDir, onLine: (line) => logLine(line) },
  );
  logLine(`[timing] emscripten build: ${Date.now() - t1}ms`);
  if (build.status !== 0) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_PREV_001,
      message: "Emscripten build 失败（详见构建日志）",
    });
    return false;
  }

  const html = copyArtifacts(outDir, prepared.buildDir);
  if (!html) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_PREV_001,
      message: "Emscripten 构建完成但未找到 forgeui_preview.html",
    });
    return false;
  }

  const mode = {
    mode: "lvgl-wasm",
    html: path.basename(html),
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(prepared.buildDir, "preview-mode.json"), `${JSON.stringify(mode, null, 2)}\n`);

  diagnostics.push({
    level: "info",
    code: "E_PREV_WASM_LVGL",
    message: `LVGL Wasm 预览已生成: ${html}`,
    path: html,
  });
  return true;
}
