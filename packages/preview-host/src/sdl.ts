import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@forgeui/codegen";
import { openProject, resolveCodegenPaths, codegenArtifactsReady } from "@forgeui/core";
import { Diagnostic, ErrorCodes, ForgeError } from "@forgeui/shared";
import { runProcessAsync } from "./process.js";
import {
  PREVIEW_TEMPLATE_VERSION,
  computeConfigureFingerprint,
  needsReconfigure,
  reconfigureReason,
  softCleanCmakeCache,
  writeBuildCache,
} from "./cache.js";
import { mergePathEnv, resolvePreviewToolchain } from "./toolchain.js";
import type {
  PreviewBackend,
  PreviewBuildLogSink,
  PreviewPrepareResult,
  PreviewRunResult,
  PreviewSession,
} from "./types.js";

function resolveRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function resolveSdlTemplate(): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../templates/sdl-sim"),
    path.resolve(process.cwd(), "templates/sdl-sim"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "CMakeLists.txt"))) return c;
  }
  throw new ForgeError(ErrorCodes.E_PREV_001, "templates/sdl-sim not found");
}

function copyFile(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    const a = fs.readFileSync(src);
    const b = fs.readFileSync(dest);
    if (a.length === b.length && a.equals(b)) return;
  }
  fs.copyFileSync(src, dest);
}

function spawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const extra: string[] = [];
  if (process.platform === "win32") {
    extra.push(
      "C:\\Program Files\\CMake\\bin",
      "C:\\Program Files (x86)\\CMake\\bin",
      path.join(process.env.ProgramFiles ?? "C:\\Program Files", "CMake", "bin"),
    );
  }
  const merged = [...extra, env.PATH ?? env.Path ?? ""].filter(Boolean).join(path.delimiter);
  env.PATH = merged;
  env.Path = merged;
  return env;
}

function resolveExecutable(name: string, fallbacks: string[] = []): string | null {
  const probe = process.platform === "win32" ? "where" : "which";
  const hit = spawnSync(probe, [name], { encoding: "utf8", env: spawnEnv() });
  if (hit.status === 0) {
    const line = (hit.stdout ?? "").split(/\r?\n/).find((l) => l.trim());
    if (line && fs.existsSync(line.trim())) return line.trim();
  }
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  for (const fb of fallbacks) {
    const candidate = fb.includes(path.sep) ? fb : path.join(fb, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveCmake(): string | null {
  return resolveExecutable("cmake", [
    "C:\\Program Files\\CMake\\bin\\cmake.exe",
    "C:\\Program Files (x86)\\CMake\\bin\\cmake.exe",
  ]);
}

function resolveLvglRoot(): string | null {
  const env = process.env.FORGEUI_LVGL_ROOT;
  if (env && fs.existsSync(path.join(env, "lvgl.h"))) return path.resolve(env);
  if (env && fs.existsSync(path.join(env, "lvgl", "lvgl.h"))) return path.resolve(env);

  const repo = resolveRepoRoot();
  const candidates = [
    path.join(repo, "xos-package/lvgl"),
    path.join(repo, "third_party/lvgl"),
    path.resolve(process.cwd(), "xos-package/lvgl"),
    path.resolve(process.cwd(), "third_party/lvgl"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "lvgl.h"))) return c;
  }
  return null;
}

function sdl2Marker(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "CMakeLists.txt")) ||
    fs.existsSync(path.join(dir, "lib/cmake/SDL2/sdl2-config.cmake"))
  );
}

function resolveSdl2Root(): string | null {
  const env = process.env.FORGEUI_SDL2_ROOT;
  if (env && fs.existsSync(env) && sdl2Marker(env)) return path.resolve(env);

  const repo = resolveRepoRoot();
  const candidates = [
    path.join(repo, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/sdl2"),
    path.join(repo, "third_party/SDL2-2.30.11"),
    path.join(repo, "third_party/SDL"),
  ];
  for (const c of candidates) {
    if (sdl2Marker(c)) return c;
  }
  return null;
}

function ensureSdl2(diagnostics: Diagnostic[]): string | null {
  const existing = resolveSdl2Root();
  if (existing) return existing;

  const repo = resolveRepoRoot();
  const script = path.join(repo, "scripts/fetch-sdl.mjs");
  if (!fs.existsSync(script)) return null;

  diagnostics.push({
    level: "info",
    code: "E_PREV_SDL2_FETCH",
    message: "未找到 SDL2，正在自动下载到 third_party/SDL2-2.30.11 …",
  });

  const node = process.execPath;
  const r = spawnSync(node, [script], {
    cwd: repo,
    encoding: "utf8",
    env: spawnEnv(),
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_PREV_001,
      message: `自动下载 SDL2 失败: ${(r.stderr || r.stdout || "unknown").trim()}`,
    });
    return null;
  }
  return resolveSdl2Root();
}

function writeConfigHeader(buildDir: string, width: number, height: number, colorDepth: number): void {
  const content = `/* Auto-generated by ForgeUI PreviewHost — do not edit */
#ifndef FORGEUI_PREVIEW_CONFIG_H
#define FORGEUI_PREVIEW_CONFIG_H
#define FORGEUI_HOR_RES ${width}
#define FORGEUI_VER_RES ${height}
#define FORGEUI_COLOR_DEPTH ${colorDepth}
#endif
`;
  const dest = path.join(buildDir, "forgeui_preview_config.h");
  if (fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === content) return;
  fs.writeFileSync(dest, content, "utf8");
}

function patchLvConf(buildDir: string, colorDepth: number): void {
  const confPath = path.join(buildDir, "lv_conf.h");
  if (!fs.existsSync(confPath)) return;
  const text = fs.readFileSync(confPath, "utf8");
  let next = text.replace(/#define LV_COLOR_DEPTH\s+\d+/, `#define LV_COLOR_DEPTH ${colorDepth}`);
  next = next.replace(/#define LV_USE_ASSERT_MEM_INTEGRITY\s+\d+/, "#define LV_USE_ASSERT_MEM_INTEGRITY 0");
  next = next.replace(/#define LV_USE_ASSERT_OBJ\s+\d+/, "#define LV_USE_ASSERT_OBJ 0");
  next = next.replace(/#define LV_USE_ASSERT_STYLE\s+\d+/, "#define LV_USE_ASSERT_STYLE 0");
  if (next === text) return;
  fs.writeFileSync(confPath, next, "utf8");
}

function cmakePathArg(p: string): string {
  return p.replace(/\\/g, "/");
}

function rmDirSafe(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copySdlRuntimeDll(
  outDir: string,
  exeDir: string,
  logLine: (line: string) => void,
  repoRoot: string,
): void {
  const candidates = [
    path.join(repoRoot, "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win/sdl2/bin/SDL2.dll"),
    path.join(outDir, "sdl2-src", "Release", "SDL2.dll"),
    path.join(outDir, "sdl2-src", "Debug", "SDL2d.dll"),
    path.join(outDir, "sdl2-src", "Debug", "SDL2.dll"),
  ];
  for (const src of candidates) {
    if (!fs.existsSync(src)) continue;
    const name = path.basename(src);
    const dest = path.join(exeDir, name);
    if (fs.existsSync(dest)) {
      try {
        if (fs.statSync(src).size === fs.statSync(dest).size) return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      fs.copyFileSync(src, dest);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "EBUSY" && fs.existsSync(dest)) return;
      throw err;
    }
    logLine(`已复制 SDL 运行时: ${dest}`);
    return;
  }
}

function findPreviewExecutable(outDir: string): string | undefined {
  const exeCandidates = [
    path.join(outDir, "forgeui_preview.exe"),
    path.join(outDir, "Release", "forgeui_preview.exe"),
    path.join(outDir, "Debug", "forgeui_preview.exe"),
    path.join(outDir, "forgeui_preview"),
  ];
  return exeCandidates.find((p) => fs.existsSync(p));
}

function launchPreviewExecutable(exe: string): ChildProcess {
  const cwd = path.dirname(exe);
  const abs = path.resolve(exe);
  const child = spawn(abs, [], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    env: spawnEnv(),
  });
  child.unref();
  return child;
}

export class SdlBackend implements PreviewBackend {
  readonly id = "sdl" as const;
  private children = new Map<number, ChildProcess>();

  private stopRunningPreviews(): void {
    for (const [pid, child] of this.children) {
      if (child && !child.killed) {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
      }
      this.children.delete(pid);
    }
  }

  async prepare(
    projectRoot: string,
    opts: { fetchSdl?: boolean; skipGenerate?: boolean } = {},
  ): Promise<PreviewPrepareResult> {
    const diagnostics: Diagnostic[] = [];
    const root = path.resolve(projectRoot);
    const loaded = openProject(root);
    const artifactsMissing = !codegenArtifactsReady(root, loaded.project);
    if (!opts.skipGenerate || artifactsMissing) {
      if (opts.skipGenerate && artifactsMissing) {
        diagnostics.push({
          level: "info",
          code: "E_GEN_AUTO",
          message: "生成物缺失（如全部清理后），自动执行 generate…",
        });
      }
      const gen = await generate(root);
      diagnostics.push(...gen.diagnostics);
      if (!gen.ok) {
        return { ok: false, buildDir: "", diagnostics, canBuild: false };
      }
    }

    const buildDir = path.join(root, ".forge", "preview-build");
    fs.mkdirSync(buildDir, { recursive: true });

    const tpl = resolveSdlTemplate();
    for (const name of ["CMakeLists.txt", "main.c", "hal.c", "hal.h", "lv_conf.h", "optimize_drivers.cmake", "README.md"]) {
      const src = path.join(tpl, name);
      const dest = path.join(buildDir, name);
      if (name === "lv_conf.h" && fs.existsSync(dest)) continue;
      if (fs.existsSync(src)) copyFile(src, dest);
    }

    writeConfigHeader(
      buildDir,
      loaded.project.display.width,
      loaded.project.display.height,
      loaded.project.display.colorDepth,
    );
    patchLvConf(buildDir, loaded.project.display.colorDepth);

    const relProject = path.relative(buildDir, root).replace(/\\/g, "/") || ".";
    const cache = {
      projectRoot: root,
      relProject,
      lvglVersion: loaded.project.lvglVersion,
      preparedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(buildDir, "preview-meta.json"), `${JSON.stringify(cache, null, 2)}\n`);

    const lvglRoot = resolveLvglRoot();
    let sdl2Root = resolveSdl2Root();
    if (!sdl2Root && opts.fetchSdl !== false) {
      sdl2Root = ensureSdl2(diagnostics);
    }

    const cmake = resolveCmake();
    const canBuild = Boolean(lvglRoot && sdl2Root && cmake);

    if (!cmake) {
      diagnostics.push({
        level: "warning",
        code: ErrorCodes.E_PREV_001,
        message:
          "未找到 cmake。请安装 CMake 并加入 PATH，或确保存在 C:\\Program Files\\CMake\\bin\\cmake.exe",
      });
    }
    if (!lvglRoot) {
      diagnostics.push({
        level: "warning",
        code: ErrorCodes.E_PREV_001,
        message:
          "未找到 LVGL 源码。请将修改版放到 xos-package/lvgl，或运行 npm run fetch:lvgl，或设置 FORGEUI_LVGL_ROOT",
      });
    } else {
      fs.writeFileSync(path.join(buildDir, "lvgl.root"), `${lvglRoot}\n`, "utf8");
      diagnostics.push({
        level: "info",
        code: "E_PREV_LVGL",
        message: `LVGL: ${lvglRoot}`,
      });
    }

    if (!sdl2Root) {
      diagnostics.push({
        level: "warning",
        code: ErrorCodes.E_PREV_001,
        message: "未找到 SDL2。请运行 npm run fetch:sdl，或设置 FORGEUI_SDL2_ROOT",
      });
    } else {
      fs.writeFileSync(path.join(buildDir, "sdl2.root"), `${sdl2Root}\n`, "utf8");
      diagnostics.push({
        level: "info",
        code: "E_PREV_SDL2",
        message: `SDL2: ${sdl2Root}`,
      });
    }

    if (cmake) {
      fs.writeFileSync(path.join(buildDir, "cmake.exe.path"), `${cmake}\n`, "utf8");
    }

    diagnostics.push({
      level: "info",
      code: "E_PREV_PREPARED",
      message: `预览构建目录: ${buildDir}`,
      path: buildDir,
    });

    return { ok: true, buildDir, diagnostics, canBuild };
  }

  private async cmakeBuildProject(
    prepared: PreviewPrepareResult,
    projectRoot: string,
    logLine: (line: string) => void,
    baseDiagnostics: Diagnostic[],
  ): Promise<{ ok: true; exe: string; diagnostics: Diagnostic[] } | { ok: false; diagnostics: Diagnostic[] }> {
    const lvglRoot = fs.readFileSync(path.join(prepared.buildDir, "lvgl.root"), "utf8").trim();
    const projectRootAbs = path.resolve(projectRoot);
    const repoRoot = resolveRepoRoot();
    const outDir = path.join(prepared.buildDir, "out");

    const cmakePath =
      fs.existsSync(path.join(prepared.buildDir, "cmake.exe.path"))
        ? fs.readFileSync(path.join(prepared.buildDir, "cmake.exe.path"), "utf8").trim()
        : resolveCmake() ?? "cmake";

    const toolchain = resolvePreviewToolchain(repoRoot, cmakePath);
    logLine(`[toolchain] ${toolchain.label}`);

    const sdl2Root = fs.existsSync(path.join(prepared.buildDir, "sdl2.root"))
      ? fs.readFileSync(path.join(prepared.buildDir, "sdl2.root"), "utf8").trim()
      : "";

    const loaded = openProject(projectRootAbs);
    const configureFp = computeConfigureFingerprint({
      templateVersion: PREVIEW_TEMPLATE_VERSION,
      projectRoot: projectRootAbs,
      templateDir: resolveSdlTemplate(),
      lvglRoot,
      sdl2Root,
      repoRoot,
      display: loaded.project.display,
      lvglVersion: loaded.project.lvglVersion,
      generator: toolchain.generator,
    });

    const mustConfigure = needsReconfigure(outDir, configureFp);
    if (mustConfigure) {
      logLine(`[cache] configure required (${reconfigureReason(outDir, configureFp)})`);
      softCleanCmakeCache(outDir);
    } else {
      logLine("[cache] incremental build (reuse .forge/preview-build/out objects)");
    }

    const buildEnv = mergePathEnv(spawnEnv(), toolchain.pathPrefix);
    this.stopRunningPreviews();

    const paths = resolveCodegenPaths(projectRootAbs, loaded.project);
    const cmakeArgs = [
      "-S",
      cmakePathArg(prepared.buildDir),
      "-B",
      cmakePathArg(outDir),
      `-DFORGEUI_PROJECT_ROOT=${cmakePathArg(projectRootAbs)}`,
      `-DFORGEUI_CODEGEN_DIR=${cmakePathArg(paths.codegenAbs)}`,
      `-DFORGEUI_LVGL_ROOT=${cmakePathArg(lvglRoot)}`,
      `-DFORGEUI_REPO_ROOT=${cmakePathArg(repoRoot)}`,
      `-DCMAKE_BUILD_TYPE=${toolchain.buildType}`,
    ];

    if (toolchain.generator) {
      cmakeArgs.push("-G", toolchain.generator);
    }

    const sdl2RootFile = path.join(prepared.buildDir, "sdl2.root");
    if (fs.existsSync(sdl2RootFile)) {
      cmakeArgs.push(`-DFORGEUI_SDL2_ROOT=${cmakePathArg(fs.readFileSync(sdl2RootFile, "utf8").trim())}`);
    }

    logLine(`cmake: ${toolchain.cmakePath}`);

    const diagnostics = [...baseDiagnostics];
    const streamCmakeLine = (line: string) => logLine(line);

    if (mustConfigure) {
      const tCfg = Date.now();
      logLine("--- cmake configure ---");
      const configure = await runProcessAsync(toolchain.cmakePath, cmakeArgs, {
        maxBuffer: 10 * 1024 * 1024,
        env: buildEnv,
        onLine: streamCmakeLine,
      });
      logLine(`[timing] cmake configure: ${Date.now() - tCfg}ms`);

      if (configure.status !== 0) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_PREV_001,
          message: "cmake configure 失败（详见构建日志）",
        });
        return { ok: false, diagnostics };
      }

      writeBuildCache(outDir, {
        fingerprint: configureFp,
        configuredAt: new Date().toISOString(),
        generator: toolchain.generator,
        buildType: toolchain.buildType,
      });
    }

    const buildArgs = ["--build", cmakePathArg(outDir), "--parallel", toolchain.buildParallel];
    if (!toolchain.generator) {
      buildArgs.push("--config", toolchain.buildType);
    }

    const tBuild = Date.now();
    logLine("--- cmake build ---");
    const build = await runProcessAsync(toolchain.cmakePath, buildArgs, {
      maxBuffer: 10 * 1024 * 1024,
      env: buildEnv,
      onLine: streamCmakeLine,
    });
    logLine(`[timing] cmake build: ${Date.now() - tBuild}ms`);

    if (build.status !== 0) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_PREV_001,
        message: "cmake build 失败（详见构建日志）",
      });
      return { ok: false, diagnostics };
    }

    const exe = findPreviewExecutable(outDir);
    if (!exe) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_PREV_001,
        message: "编译完成但未找到 forgeui_preview 可执行文件",
      });
      return { ok: false, diagnostics };
    }

    copySdlRuntimeDll(outDir, path.dirname(exe), logLine, repoRoot);
    diagnostics.push({
      level: "info",
      code: "E_PREV_BUILT",
      message: `编译完成: ${exe}`,
    });
    return { ok: true, exe, diagnostics };
  }

  private async runExistingPreview(
    projectRoot: string,
    opts: {
      skipGenerate?: boolean;
      wait?: boolean;
      onBuildLog?: PreviewBuildLogSink;
      logLine: (line: string) => void;
      buildLogs: string[];
      wallStart: number;
    },
  ): Promise<PreviewRunResult> {
    const root = path.resolve(projectRoot);
    const buildDir = path.join(root, ".forge", "preview-build");
    const outDir = path.join(buildDir, "out");
    const diagnostics: Diagnostic[] = [];

    if (!fs.existsSync(path.join(buildDir, "CMakeLists.txt"))) {
      const prepared = await this.prepare(root, { fetchSdl: false, skipGenerate: opts.skipGenerate });
      diagnostics.push(...prepared.diagnostics);
      for (const d of prepared.diagnostics) {
        opts.logLine(`[${d.level}] ${d.message}`);
      }
      if (!prepared.ok) {
        return { ok: false, diagnostics, buildLogs: opts.buildLogs };
      }
    }

    let exe = findPreviewExecutable(outDir);
    if (!exe) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_PREV_001,
        message: "未找到 forgeui_preview 可执行文件，请先执行「编译」",
      });
      return { ok: false, diagnostics, buildLogs: opts.buildLogs };
    }

    const repoRoot = resolveRepoRoot();
    copySdlRuntimeDll(outDir, path.dirname(exe), opts.logLine, repoRoot);
    this.stopRunningPreviews();
    opts.logLine(`启动预览: ${exe}`);
    const child = launchPreviewExecutable(exe);
    const session: PreviewSession = {
      backendId: this.id,
      buildDir,
      pid: child.pid,
      logs: opts.buildLogs,
    };
    if (child.pid) this.children.set(child.pid, child);

    diagnostics.push({
      level: "info",
      code: "E_PREV_STARTED",
      message: `预览窗口已启动 (pid=${child.pid ?? "?"})`,
    });

    if (opts.wait) {
      await new Promise<void>((resolve) => child.on("exit", () => resolve()));
    }

    const elapsedMs = Date.now() - opts.wallStart;
    opts.logLine(`[timing] preview launch: ${elapsedMs}ms`);
    return { ok: true, session, diagnostics, buildLogs: opts.buildLogs, elapsedMs };
  }

  async start(
    projectRoot: string,
    opts: {
      prepareOnly?: boolean;
      buildOnly?: boolean;
      runOnly?: boolean;
      wait?: boolean;
      skipGenerate?: boolean;
      onBuildLog?: PreviewBuildLogSink;
    } = {},
  ): Promise<PreviewRunResult> {
    const wallStart = Date.now();
    const buildLogs: string[] = [];
    const logLine = (line: string) => {
      buildLogs.push(line);
      opts.onBuildLog?.(line);
    };

    if (opts.runOnly && !opts.buildOnly && !opts.prepareOnly) {
      return this.runExistingPreview(projectRoot, {
        skipGenerate: opts.skipGenerate,
        wait: opts.wait,
        onBuildLog: opts.onBuildLog,
        logLine,
        buildLogs,
        wallStart,
      });
    }

    const prepared = await this.prepare(projectRoot, {
      fetchSdl: !opts.prepareOnly,
      skipGenerate: opts.skipGenerate,
    });
    if (!prepared.ok) {
      return { ok: false, diagnostics: prepared.diagnostics, buildLogs };
    }

    for (const d of prepared.diagnostics) {
      logLine(`[${d.level}] ${d.message}`);
    }

    if (opts.prepareOnly) {
      return {
        ok: true,
        session: {
          backendId: this.id,
          buildDir: prepared.buildDir,
          logs: buildLogs,
        },
        diagnostics: prepared.diagnostics,
        buildLogs,
      };
    }

    if (!prepared.canBuild) {
      const diagnostics = [
        ...prepared.diagnostics,
        {
          level: "error" as const,
          code: ErrorCodes.E_PREV_001,
          message: opts.buildOnly
            ? "预览编译条件不满足（缺少 cmake / LVGL / SDL2），无法编译"
            : "预览编译条件不满足（缺少 cmake / LVGL / SDL2），无法启动窗口",
        },
      ];
      return { ok: false, diagnostics, buildLogs };
    }

    const built = await this.cmakeBuildProject(prepared, projectRoot, logLine, prepared.diagnostics);
    if (!built.ok) {
      return { ok: false, diagnostics: built.diagnostics, buildLogs };
    }

    if (opts.buildOnly) {
      const elapsedMs = Date.now() - wallStart;
      logLine(`[timing] compile total: ${elapsedMs}ms`);
      return {
        ok: true,
        session: {
          backendId: this.id,
          buildDir: prepared.buildDir,
          logs: buildLogs,
        },
        diagnostics: built.diagnostics,
        buildLogs,
        elapsedMs,
      };
    }

    this.stopRunningPreviews();
    logLine(`启动预览: ${built.exe}`);
    const child = launchPreviewExecutable(built.exe);
    const session: PreviewSession = {
      backendId: this.id,
      buildDir: prepared.buildDir,
      pid: child.pid,
      logs: buildLogs,
    };
    if (child.pid) this.children.set(child.pid, child);

    built.diagnostics.push({
      level: "info",
      code: "E_PREV_STARTED",
      message: `预览窗口已启动 (pid=${child.pid ?? "?"})`,
    });

    if (opts.wait) {
      await new Promise<void>((resolve) => child.on("exit", () => resolve()));
    }

    const elapsedMs = Date.now() - wallStart;
    logLine(`[timing] preview total: ${elapsedMs}ms`);
    return { ok: true, session, diagnostics: built.diagnostics, buildLogs, elapsedMs };
  }

  async stop(session: PreviewSession): Promise<void> {
    if (!session.pid) return;
    const child = this.children.get(session.pid);
    if (child && !child.killed) child.kill();
    this.children.delete(session.pid);
  }
}
