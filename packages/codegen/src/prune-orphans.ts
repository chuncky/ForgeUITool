import fs from "node:fs";
import path from "node:path";

/** Walk files under dir; skip `skipDir` name at any level (e.g. custom/). */
export function listFilesRecursive(dir: string, skipDirNames: Set<string> = new Set()): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (skipDirNames.has(ent.name)) continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * FR-057: delete files under codegenAbs that are not in keepAbs (never touch custom/).
 * Returns relative paths (posix) that were deleted.
 */
export function pruneCodegenOrphans(
  projectRoot: string,
  codegenAbs: string,
  keepAbs: string[],
  customSubdir: string,
): string[] {
  const root = path.resolve(projectRoot);
  const codegen = path.resolve(codegenAbs);
  const keep = new Set(keepAbs.map((f) => path.resolve(f)));
  const skip = new Set([customSubdir, ".git"]);
  const deleted: string[] = [];
  for (const file of listFilesRecursive(codegen, skip)) {
    if (keep.has(path.resolve(file))) continue;
    // safety: must stay under codegen
    const relToCodegen = path.relative(codegen, file);
    if (relToCodegen.startsWith("..") || path.isAbsolute(relToCodegen)) continue;
    fs.unlinkSync(file);
    deleted.push(path.relative(root, file).replace(/\\/g, "/"));
  }
  // prune empty dirs (except custom)
  const pruneEmpty = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(ent.name)) continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) pruneEmpty(full);
    }
    if (path.resolve(d) === codegen) return;
    const left = fs.readdirSync(d);
    if (left.length === 0) fs.rmdirSync(d);
  };
  pruneEmpty(codegen);
  return deleted;
}
