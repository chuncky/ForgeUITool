#!/usr/bin/env node
/**
 * Ensure a LVGL tree is available for PC/Wasm preview.
 * Prefer the product fork at xos-package/lvgl; otherwise fill third_party/lvgl.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xosLvgl = path.join(repoRoot, "xos-package", "lvgl");
const target = path.join(repoRoot, "third_party", "lvgl");

function hasLvgl(dir) {
  return fs.existsSync(path.join(dir, "lvgl.h"));
}

if (hasLvgl(xosLvgl)) {
  console.log(`Using product LVGL at ${xosLvgl}`);
  process.exit(0);
}

if (hasLvgl(target)) {
  console.log(`LVGL already present at ${target}`);
  process.exit(0);
}

console.log("Cloning LVGL v9.1.0 (shallow)...");
fs.mkdirSync(path.dirname(target), { recursive: true });
execSync(`git clone --depth 1 --branch v9.1.0 https://github.com/lvgl/lvgl.git "${target}"`, {
  stdio: "inherit",
});
console.log(`LVGL ready at ${target}`);
