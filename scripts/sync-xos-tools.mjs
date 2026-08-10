#!/usr/bin/env node
/**
 * Sync Windows preview toolchain into xos-package/tools/win.
 *
 * Default source: ref/beken/.../resources/tools/win/{w64devkit,cmake,sdl2}
 * Override: FORGEUI_TOOLS_WIN_SRC=<dir containing those three folders>
 *
 * Usage: node scripts/sync-xos-tools.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destWin = path.join(root, "xos-package", "tools", "win");
const defaultSrc = path.join(
  root,
  "ref/beken/lvgl_ui_designer_2.0.3/resources/tools/win",
);
const srcWin = process.env.FORGEUI_TOOLS_WIN_SRC
  ? path.resolve(process.env.FORGEUI_TOOLS_WIN_SRC)
  : defaultSrc;

const PARTS = ["w64devkit", "cmake", "sdl2"];

function log(msg) {
  console.log(`[sync-xos-tools] ${msg}`);
}

function fail(msg) {
  console.error(`[sync-xos-tools] ERROR: ${msg}`);
  process.exit(1);
}

function mirror(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (process.platform === "win32") {
    const r = spawnSync(
      "robocopy",
      [src, dest, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"],
      { encoding: "utf8" },
    );
    // robocopy: 0–7 success
    if ((r.status ?? 1) >= 8) {
      fail(`robocopy failed (${r.status}): ${src} → ${dest}\n${r.stderr || r.stdout || ""}`);
    }
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(srcWin)) {
  fail(`source not found: ${srcWin}`);
}

for (const name of PARTS) {
  const src = path.join(srcWin, name);
  if (!fs.existsSync(src)) fail(`missing ${src}`);
  const dest = path.join(destWin, name);
  log(`${name}: ${src} → ${dest}`);
  mirror(src, dest);
}

log("done");
log(`layout: ${destWin}/{${PARTS.join(",")}}`);
