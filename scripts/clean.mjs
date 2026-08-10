/**
 * Clean temp/scratch files and compile outputs before commit or a fresh build.
 *
 * Usage:
 *   node scripts/clean.mjs
 *   node scripts/clean.mjs --dry-run
 *   npm run clean
 *   npm run clean -- --dry-run
 *
 * Does NOT remove: node_modules, source, docs, ref/ vendor trees (except _tmp_*).
 *
 * Note: `release/` is electron-builder / pack-release output. On Windows, EPERM
 * usually means ForgeUI.exe (or Explorer) still holds files under release/win-unpacked.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "ref",
  "xos-package",
  "templates",
]);

/** Top-level / known build & cache directories (relative to repo root). */
const ROOT_DIRS = [
  ".tmp",
  ".release",
  "release",
  ".cache",
  "coverage",
  "apps/cli/dist",
  "apps/designer/dist",
  "apps/designer/out",
  "packages/codegen/dist",
  "packages/core/dist",
  "packages/importers/dist",
  "packages/loader/dist",
  "packages/mcp/dist",
  "packages/packer/dist",
  "packages/platforms/dist",
  "packages/preview-host/dist",
  "packages/shared/dist",
];

const VITE_CACHE_DIRS = ["node_modules/.vite", "apps/designer/node_modules/.vite"];

let removed = 0;
let skippedMissing = 0;
let skippedLocked = 0;
let bytes = 0;
const lockedHints = [];

function rel(p) {
  return path.relative(root, p).split(path.sep).join("/");
}

function sizeOf(target) {
  try {
    const st = fs.statSync(target);
    if (st.isFile()) return st.size;
    if (!st.isDirectory()) return 0;
    let total = 0;
    for (const name of fs.readdirSync(target)) {
      total += sizeOf(path.join(target, name));
    }
    return total;
  } catch {
    return 0;
  }
}

/** Stop packaged ForgeUI that commonly locks release/win-unpacked (same idea as pack-release). */
function stopReleaseLockHolders() {
  if (dryRun || process.platform !== "win32") return;
  for (const pat of ["ForgeUI.exe", "ForgeUI-Kit*.exe"]) {
    spawnSync("taskkill", ["/F", "/IM", pat, "/T"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}

function isLockError(err) {
  const code = err && err.code;
  return code === "EPERM" || code === "EBUSY" || code === "EACCES";
}

function removePath(abs, kind) {
  if (!fs.existsSync(abs)) {
    skippedMissing += 1;
    return;
  }
  const n = sizeOf(abs);
  const label = rel(abs);
  if (dryRun) {
    console.log(`[dry-run] ${kind} ${label}`);
    removed += 1;
    bytes += n;
    return;
  }
  try {
    fs.rmSync(abs, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log(`rm ${kind} ${label}`);
    removed += 1;
    bytes += n;
  } catch (err) {
    if (!isLockError(err)) throw err;
    skippedLocked += 1;
    lockedHints.push(label);
    console.warn(
      `skip (locked) ${label}: ${err.code} — close ForgeUI / Explorer windows using this folder, then re-run`,
    );
  }
}

function walkFiles(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === "." || ent.name === "..") continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) {
        // Still scan ref/ and scripts-like areas for _tmp_* only under ref/beken etc.
        if (ent.name === "ref") {
          walkScratchOnly(abs, onFile);
        }
        continue;
      }
      walkFiles(abs, onFile);
      continue;
    }
    if (ent.isFile()) onFile(abs, ent.name);
  }
}

/** Under ref/: only remove scratch _tmp_* / _recover_* files, never vendor trees. */
function walkScratchOnly(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      walkScratchOnly(abs, onFile);
      continue;
    }
    if (ent.isFile() && isScratchName(ent.name)) onFile(abs, ent.name);
  }
}

function isScratchName(name) {
  return name.startsWith("_tmp_") || name.startsWith("_recover_");
}

function isTsBuildInfo(name) {
  return name.endsWith(".tsbuildinfo");
}

console.log(dryRun ? "ForgeUI clean (dry-run)" : "ForgeUI clean");
console.log(`root: ${root}`);

stopReleaseLockHolders();

for (const d of ROOT_DIRS) {
  removePath(path.join(root, d), "dir");
}

for (const d of VITE_CACHE_DIRS) {
  removePath(path.join(root, d), "dir");
}

walkFiles(root, (abs, name) => {
  if (isScratchName(name) || isTsBuildInfo(name)) {
    removePath(abs, "file");
  }
});

const mb = (bytes / (1024 * 1024)).toFixed(1);
console.log(
  dryRun
    ? `would remove ${removed} path(s) (~${mb} MiB); missing skipped ${skippedMissing}`
    : `removed ${removed} path(s) (~${mb} MiB); missing skipped ${skippedMissing}; locked skipped ${skippedLocked}`,
);
if (skippedLocked > 0) {
  console.warn(
    `hint: ${lockedHints.join(", ")} still locked. Quit packaged ForgeUI (release/win-unpacked) and retry.`,
  );
  process.exitCode = 1;
}
