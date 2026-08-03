#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "third_party", "lvgl");
const marker = path.join(target, "lvgl.h");

const refCandidates = [
  path.join(
    repoRoot,
    "ref/beken/lvgl_ui_designer_2.0.3/resources/lv_port_pc_simulate/lvgl",
  ),
];

function hasLvgl(dir) {
  return fs.existsSync(path.join(dir, "lvgl.h"));
}

if (hasLvgl(marker)) {
  console.log(`LVGL already present at ${target}`);
  process.exit(0);
}

for (const ref of refCandidates) {
  if (hasLvgl(ref)) {
    console.log(`Copying LVGL from ${ref} → ${target}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(ref, target, { recursive: true });
    process.exit(0);
  }
}

console.log("Cloning LVGL v9.1.0 (shallow)...");
fs.mkdirSync(path.dirname(target), { recursive: true });
execSync(`git clone --depth 1 --branch v9.1.0 https://github.com/lvgl/lvgl.git "${target}"`, {
  stdio: "inherit",
});
console.log(`LVGL ready at ${target}`);
