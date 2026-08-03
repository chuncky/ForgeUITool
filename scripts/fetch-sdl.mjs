#!/usr/bin/env node
/**
 * Fetch SDL2 2.30.x sources into third_party/SDL2-2.30.11 for offline SDL preview builds.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "third_party", "SDL2-2.30.11");
const marker = path.join(target, "CMakeLists.txt");

if (fs.existsSync(marker)) {
  console.log(`SDL2 already present at ${target}`);
  process.exit(0);
}

const urls = [
  "https://www.libsdl.org/release/SDL2-2.30.11.zip",
  "https://github.com/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.zip",
];

const zipPath = path.join(repoRoot, "third_party", "SDL2-2.30.11.zip");
fs.mkdirSync(path.dirname(zipPath), { recursive: true });

let downloaded = false;
for (const url of urls) {
  try {
    console.log(`Downloading ${url} ...`);
    execSync(`curl -L --fail -o "${zipPath}" "${url}"`, { stdio: "inherit" });
    downloaded = true;
    break;
  } catch {
    console.warn(`Failed: ${url}`);
  }
}

if (!downloaded) {
  console.error(
    "Could not download SDL2. Download SDL2-2.30.11.zip manually and extract to:\n  " + target,
  );
  process.exit(1);
}

console.log("Extracting...");
fs.mkdirSync(target, { recursive: true });
if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${path.dirname(target)}'"`,
    { stdio: "inherit" },
  );
  const extracted = path.join(path.dirname(target), "SDL2-2.30.11");
  if (fs.existsSync(extracted) && extracted !== target) {
    fs.renameSync(extracted, target);
  }
} else {
  execSync(`unzip -q -o "${zipPath}" -d "${path.dirname(target)}"`, { stdio: "inherit" });
}

if (fs.existsSync(marker)) {
  console.log(`SDL2 ready at ${target}`);
} else {
  console.error("Extract completed but CMakeLists.txt not found — check third_party layout");
  process.exit(1);
}
