/**
 * Ensure Electron binary exists. Avoids stuck npm postinstall / EBUSY on Windows.
 * Uses local .cache zip or downloads from npmmirror CDN.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronDir = path.join(root, "node_modules", "electron");
const distDir = path.join(electronDir, "dist");
const exe = path.join(distDir, "electron.exe");
const cacheDir = path.join(root, ".cache");
const version = "35.7.5";
const zipName = `electron-v${version}-win32-x64.zip`;
const zipPath = path.join(cacheDir, zipName);
const mirror = `https://cdn.npmmirror.com/binaries/electron/v${version}/${zipName}`;

function ok() {
  return (
    fs.existsSync(exe) &&
    fs.existsSync(path.join(electronDir, "path.txt")) &&
    fs.readFileSync(path.join(electronDir, "path.txt"), "utf8").trim() === "electron.exe"
  );
}

if (!fs.existsSync(electronDir)) {
  console.error("electron package missing; run: npm i electron@35 -D -w @forgeui/designer");
  process.exit(1);
}

if (ok()) {
  console.log("Electron binary OK:", exe);
  process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1_000_000) {
  console.log("Downloading", mirror);
  const r = spawnSync("curl.exe", ["-L", "--retry", "3", "-o", zipPath, mirror], {
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const extract = require("extract-zip");
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
await extract(zipPath, { dir: distDir });
fs.writeFileSync(path.join(electronDir, "path.txt"), "electron.exe");
fs.writeFileSync(path.join(distDir, "version"), version);
console.log("Electron installed:", exe);
