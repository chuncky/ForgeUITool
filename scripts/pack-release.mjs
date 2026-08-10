#!/usr/bin/env node
/**
 * Build a distributable ForgeUI Kit designer package (Windows x64).
 *
 * Usage:
 *   npm run release
 *   node scripts/pack-release.mjs
 *   node scripts/pack-release.mjs --skip-build
 *   node scripts/pack-release.mjs --no-preview-sdk
 *   node scripts/pack-release.mjs --target dir
 *   node scripts/pack-release.mjs --target portable,nsis,dir
 *
 * Output: release/
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(root, ".release", "forgeui-root");
const packOutDir = path.join(root, ".release", "pack");
const outDir = path.join(root, "release");
const designerDir = path.join(root, "apps", "designer");

const RUNTIME_PACKAGES = [
  "shared",
  "core",
  "codegen",
  "preview-host",
  "platforms",
  "packer",
  "loader",
  "importers",
  "mcp",
];

const argv = process.argv.slice(2);
const skipBuild = argv.includes("--skip-build");
const noPreviewSdk = argv.includes("--no-preview-sdk");
const targetArg = (() => {
  const i = argv.indexOf("--target");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : "portable,dir";
})();

function log(msg) {
  console.log(`[pack-release] ${msg}`);
}

function fail(msg) {
  console.error(`[pack-release] ERROR: ${msg}`);
  process.exit(1);
}

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCmd() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function run(cmd, cmdArgs, opts = {}) {
  log(`$ ${cmd} ${cmdArgs.join(" ")}`);
  const needsShell =
    opts.shell === true ||
    (process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd));
  const r = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    shell: needsShell,
    env: { ...process.env, ...opts.env },
    windowsHide: true,
  });
  if (r.error) fail(`${cmd} failed: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} exited with ${r.status ?? "signal"}`);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sleep(ms) {
  spawnSync(process.execPath, ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`], {
    stdio: "ignore",
    windowsHide: true,
  });
}

/** Remove leftover .release/pack.trash-* and release.trash-* from interrupted packs. */
function cleanStaleTrash() {
  for (const base of [path.dirname(outDir), path.dirname(packOutDir)]) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!name.includes(".trash-") && !name.startsWith("release.trash-") && !name.startsWith("pack.trash-")) {
        continue;
      }
      if (!name.includes("trash-")) continue;
      try {
        rmrf(path.join(base, name));
      } catch {
        /* ignore */
      }
    }
  }
}

/** Stop packaged/dev ForgeUI that may lock release/win-unpacked. */
function stopReleaseLockHolders() {
  if (process.platform !== "win32") return;
  const patterns = ["ForgeUI.exe", "ForgeUI-Kit*.exe"];
  for (const pat of patterns) {
    spawnSync("taskkill", ["/F", "/IM", pat, "/T"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
  // Also kill by window title path match via PowerShell (best-effort).
  spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Path -and (
            $_.Path -like '*\\uitool\\release\\*' -or
            $_.ProcessName -like 'ForgeUI*'
          )
        } |
        Stop-Process -Force -ErrorAction SilentlyContinue`,
    ],
    { stdio: "ignore", windowsHide: true },
  );
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/**
 * Empty a directory's children. Never delete the directory node itself
 * (Windows EPERM if Explorer / a shell cwd holds the folder).
 */
function emptyDirContents(dir) {
  ensureDir(dir);
  stopReleaseLockHolders();
  sleep(300);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const failed = [];
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    let ok = false;
    for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
      try {
        rmrf(p);
        ok = true;
      } catch (e) {
        if (attempt === 4) {
          failed.push(`${entry.name}: ${e.message}`);
        } else {
          stopReleaseLockHolders();
          sleep(300 * attempt);
        }
      }
    }
  }
  if (failed.length) {
    fail(
      `无法清空 ${dir} 内部分文件（可能被占用）：\n  - ${failed.join("\n  - ")}\n` +
        `请关闭 ForgeUI.exe，以及打开该目录的资源管理器 / 终端（cwd 不要落在 release\\），然后重试。`,
    );
  }
}

function cleanPackOut() {
  emptyDirContents(packOutDir);
}

function tryRemove(p) {
  try {
    rmrf(p);
    return true;
  } catch {
    /* continue */
  }
  const bak = `${p}.old-${Date.now()}`;
  try {
    fs.renameSync(p, bak);
    setTimeout(() => {
      try {
        rmrf(bak);
      } catch {
        /* ignore */
      }
    }, 1000);
    return true;
  } catch {
    return false;
  }
}

function publishToRelease() {
  ensureDir(outDir);
  stopReleaseLockHolders();
  sleep(400);

  for (const name of fs.readdirSync(packOutDir)) {
    const from = path.join(packOutDir, name);
    const to = path.join(outDir, name);

    if (fs.existsSync(to)) {
      if (!tryRemove(to)) {
        // Overwrite in place (directory merge / file replace).
        log(`warn: could not remove ${to}; overwriting in place`);
      }
    }

    try {
      fs.cpSync(from, to, { recursive: true, force: true });
    } catch (e) {
      // Last resort: publish under an alternate name so pack still succeeds.
      const alt = path.join(outDir, `${name}.new`);
      try {
        if (fs.existsSync(alt)) tryRemove(alt);
        fs.cpSync(from, alt, { recursive: true, force: true });
        log(`published as ${path.basename(alt)} (original locked)`);
      } catch (e2) {
        fail(
          `无法写入 ${to}（${e.message}）；备用路径也失败（${e2.message}）。\n` +
            `请关闭 ForgeUI.exe，并关闭资源管理器中 release\\win-unpacked 窗口后重试。`,
        );
      }
    }
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDirFiltered(src, dest, shouldSkip) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkip?.(entry.name, path.join(src, entry.name))) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirFiltered(from, to, shouldSkip);
    else {
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
    }
  }
}

function copyDir(src, dest) {
  copyDirFiltered(src, dest, null);
}

function stagePackage(name) {
  const src = path.join(root, "packages", name);
  const dest = path.join(stageRoot, "packages", name);
  const pkg = readJson(path.join(src, "package.json"));
  ensureDir(dest);
  fs.writeFileSync(
    path.join(dest, "package.json"),
    `${JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        type: pkg.type ?? "module",
        main: pkg.main,
        exports: pkg.exports,
        bin: pkg.bin,
        dependencies: pkg.dependencies ?? {},
      },
      null,
      2,
    )}\n`,
  );
  const distSrc = path.join(src, "dist");
  if (!fs.existsSync(distSrc)) fail(`missing ${distSrc}; run build first`);
  copyDir(distSrc, path.join(dest, "dist"));
  const templates = path.join(src, "templates");
  if (fs.existsSync(templates)) copyDir(templates, path.join(dest, "templates"));
}

function resolveLvglSrc() {
  const candidates = [
    path.join(root, "xos-package", "lvgl"),
    path.join(root, "third_party", "lvgl"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "lvgl.h"))) return c;
  }
  return null;
}

function stagePreviewSdk() {
  if (noPreviewSdk) {
    log("skip preview SDK (--no-preview-sdk)");
    return;
  }

  const lvglSrc = resolveLvglSrc();
  if (lvglSrc) {
    log(`stage LVGL ← ${lvglSrc}`);
    copyDir(lvglSrc, path.join(stageRoot, "third_party", "lvgl"));
  } else {
    log("WARN: LVGL not found; need xos-package/lvgl, fetch:lvgl, or FORGEUI_LVGL_ROOT");
  }

  // Product Windows toolchain (MinGW/ccache + cmake + prebuilt SDL2), BK-compatible layout.
  const toolsWinSrc = path.join(root, "xos-package", "tools", "win");
  const toolsParts = ["w64devkit", "cmake", "sdl2"];
  const missingTools = toolsParts.filter((n) => !fs.existsSync(path.join(toolsWinSrc, n)));
  if (missingTools.length === 0) {
    const destWin = path.join(stageRoot, "xos-package", "tools", "win");
    for (const name of toolsParts) {
      log(`stage tools/win/${name} ← ${path.join(toolsWinSrc, name)}`);
      copyDir(path.join(toolsWinSrc, name), path.join(destWin, name));
    }
  } else {
    log(
      `WARN: xos-package/tools/win missing [${missingTools.join(", ")}]; run node scripts/sync-xos-tools.mjs (preview may fall back to MSVC)`,
    );
  }

  // Optional SDL2 sources (fallback when prebuilt sdl2 is absent).
  const sdlSrc = path.join(root, "third_party", "SDL2-2.30.11");
  if (fs.existsSync(path.join(sdlSrc, "CMakeLists.txt"))) {
    log(`stage SDL2 sources ← ${sdlSrc}`);
    copyDir(sdlSrc, path.join(stageRoot, "third_party", "SDL2-2.30.11"));
  }

  ensureDir(path.join(stageRoot, "scripts"));
  for (const script of ["fetch-lvgl.mjs", "fetch-sdl.mjs", "sync-xos-tools.mjs"]) {
    const src = path.join(root, "scripts", script);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(stageRoot, "scripts", script));
    }
  }
}

function stageRuntimeRoot(version) {
  log(`stage runtime → ${stageRoot}`);
  rmrf(stageRoot);
  ensureDir(stageRoot);

  for (const name of RUNTIME_PACKAGES) stagePackage(name);
  copyDirFiltered(path.join(root, "templates"), path.join(stageRoot, "templates"), (name) =>
    name === ".forge" || name === "node_modules" || name === ".git",
  );

  const schemasSrc = path.join(root, "schemas");
  if (fs.existsSync(schemasSrc)) {
    copyDir(schemasSrc, path.join(stageRoot, "schemas"));
  } else {
    log("WARN: schemas/ missing — project validate will fail in packaged app");
  }

  // AI design Skill templates (Cursor/Codex/TRAE install from here when packaged).
  const aiSkillSrc = path.join(root, "resources", "ai-skill");
  if (fs.existsSync(path.join(aiSkillSrc, "forgeui-lvgl-designer", "SKILL.md"))) {
    log(`stage AI skill ← ${aiSkillSrc}`);
    copyDir(aiSkillSrc, path.join(stageRoot, "resources", "ai-skill"));
  } else {
    log("WARN: resources/ai-skill/forgeui-lvgl-designer missing — AI设计安装 Skill 会失败");
  }

  // Built-in designer fonts (property panel defaults + canvas @font-face).
  const ttfSrc = path.join(root, "xos-package", "res", "ttf");
  if (fs.existsSync(ttfSrc)) {
    log(`stage builtin fonts ← ${ttfSrc}`);
    copyDir(ttfSrc, path.join(stageRoot, "xos-package", "res", "ttf"));
  } else {
    log("WARN: xos-package/res/ttf missing — default text_font will not resolve on canvas");
  }

  ensureDir(path.join(stageRoot, "docs"));
  for (const f of ["MVP_GUI_ACCEPTANCE_UI-01-08.md", "AC-005_BOARD_BRINGUP.md"]) {
    const src = path.join(root, "docs", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(stageRoot, "docs", f));
  }
  const readme = path.join(root, "README.md");
  if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(stageRoot, "README.md"));

  const coreDeps = readJson(path.join(root, "packages/core/package.json")).dependencies;
  const codegenDeps = readJson(path.join(root, "packages/codegen/package.json")).dependencies;

  fs.writeFileSync(
    path.join(stageRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "forgeui-runtime",
        private: true,
        version,
        type: "module",
        dependencies: {
          "@forgeui/shared": "file:packages/shared",
          "@forgeui/core": "file:packages/core",
          "@forgeui/codegen": "file:packages/codegen",
          "@forgeui/preview-host": "file:packages/preview-host",
          "@forgeui/platforms": "file:packages/platforms",
          "@forgeui/packer": "file:packages/packer",
          "@forgeui/loader": "file:packages/loader",
          "@forgeui/importers": "file:packages/importers",
          "@forgeui/mcp": "file:packages/mcp",
          handlebars: codegenDeps.handlebars,
          ajv: coreDeps.ajv,
          "ajv-formats": coreDeps["ajv-formats"],
        },
      },
      null,
      2,
    )}\n`,
  );

  run(npmCmd(), ["install", "--omit=dev", "--no-fund", "--no-audit"], { cwd: stageRoot });
  stagePreviewSdk();
}

function ensureElectronBuilder() {
  try {
    require.resolve("electron-builder/package.json", { paths: [root] });
  } catch {
    log("installing electron-builder…");
    run(npmCmd(), ["i", "-D", "electron-builder@^25.1.8"]);
  }
}

function writeReleaseNotes(version) {
  const text = `# ForgeUI Kit ${version}

## 内容

- Windows x64 设计器（Electron）
- 运行时：\`@forgeui/*\`（codegen / preview / mcp / packer …）
- 工程模板：\`templates/\`
- AI Skill：\`resources/ai-skill/forgeui-lvgl-designer\`（「AI设计」一键安装）
- 预览 SDK：\`xos-package/lvgl\` → \`third_party/lvgl\`；Windows 工具链 \`xos-package/tools/win\`（w64devkit / cmake / sdl2）一并打入
- PC 预览：优先内置 MinGW+Ninja+ccache，无需本机另装 VS

## 使用

1. 运行 portable 可执行文件，或解压 \`win-unpacked\` 目录后启动 **ForgeUI Kit**
2. 新建或打开工程
3. PC 预览优先使用内置 \`xos-package/tools/win\`（w64devkit + cmake + SDL2）

## MCP / AI 设计

顶栏「AI设计」→ Cursor：自动安装 MCP + Skill，并打开工程 \`.forge-ai\`。  
生产态 MCP 通过 \`ELECTRON_RUN_AS_NODE=1\` 拉起内置 server。

生成时间：${new Date().toISOString()}
`;
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "RELEASE_NOTES.md"), text, "utf8");
}

function listOutputs() {
  if (!fs.existsSync(outDir)) return;
  for (const name of fs.readdirSync(outDir)) {
    const p = path.join(outDir, name);
    const st = fs.statSync(p);
    if (st.isFile()) log(`  ${name}  (${(st.size / (1024 * 1024)).toFixed(1)} MB)`);
    else log(`  ${name}/`);
  }
}

function main() {
  const version = readJson(path.join(root, "package.json")).version;
  log(`ForgeUI Kit release ${version}`);

  if (!skipBuild) run(npmCmd(), ["run", "build:designer"]);
  else log("skip workspace/designer build");

  run(process.execPath, ["scripts/ensure-electron.mjs"]);
  stageRuntimeRoot(version);
  ensureElectronBuilder();

  // Never delete release/ itself (Windows locks the folder if Explorer/shell cwd is inside it).
  // Build into .release/pack, then publish files into release/.
  process.chdir(root);
  cleanStaleTrash();
  cleanPackOut();

  const eb = [
    "electron-builder",
    "--projectDir",
    designerDir,
    "--config",
    path.join(designerDir, "electron-builder.yml"),
    "--win",
    "--x64",
  ];

  // Prefer yml targets when using the default; otherwise pass CLI targets.
  const useYmlTargets = targetArg === "portable,dir";
  if (!useYmlTargets) {
    const targets = targetArg
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of targets) {
      if (t === "dir") eb.push("--dir");
      else eb.push(t);
    }
  }

  run(npxCmd(), eb, {
    env: {
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
  });

  publishToRelease();
  writeReleaseNotes(version);
  log(`done → ${outDir}`);
  listOutputs();
}

main();
