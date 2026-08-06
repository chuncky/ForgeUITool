import fs from "node:fs";
import path from "node:path";
import { openProject, saveProject } from "./workspace.js";
import type { LoadedProject } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";

export interface SnapshotMeta {
  id: string;
  label?: string;
  createdAt: string;
}

const MAX_SNAPSHOTS = 30;

export function projectHistoryDir(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".forge", "history");
}

export function snapshotTimestampId(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(".", "");
}

function uniqueSnapshotId(projectRoot: string, date = new Date()): string {
  const base = snapshotTimestampId(date);
  let id = base;
  let i = 2;
  while (fs.existsSync(path.join(projectHistoryDir(projectRoot), id))) {
    id = `${base}_${i}`;
    i += 1;
  }
  return id;
}

function copyTree(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function rmTree(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeMeta(dir: string, meta: SnapshotMeta): void {
  fs.writeFileSync(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function readMeta(dir: string): SnapshotMeta | null {
  const file = path.join(dir, "meta.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SnapshotMeta;
  } catch {
    return null;
  }
}

function copyProjectFiles(projectRoot: string, destDir: string): void {
  const root = path.resolve(projectRoot);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(path.join(root, "project.json"), path.join(destDir, "project.json"));
  copyTree(path.join(root, "screens"), path.join(destDir, "screens"));
}

function applySnapshotFiles(snapshotDir: string, projectRoot: string): void {
  const root = path.resolve(projectRoot);
  fs.copyFileSync(path.join(snapshotDir, "project.json"), path.join(root, "project.json"));
  rmTree(path.join(root, "screens"));
  copyTree(path.join(snapshotDir, "screens"), path.join(root, "screens"));
}

function pruneOldSnapshots(projectRoot: string): void {
  const items = listSnapshots(projectRoot);
  if (items.length <= MAX_SNAPSHOTS) return;
  const drop = items.slice(MAX_SNAPSHOTS);
  for (const s of drop) {
    rmTree(path.join(projectHistoryDir(projectRoot), s.id));
  }
}

/** Copy current project.json + screens/ into `.forge/history/<id>/` (FR-004). */
export function createSnapshot(projectRoot: string, label?: string): SnapshotMeta {
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(path.join(root, "project.json"))) {
    throw new ForgeError(ErrorCodes.E_IO_001, "project.json missing");
  }
  const id = uniqueSnapshotId(root);
  const dir = path.join(projectHistoryDir(root), id);
  if (fs.existsSync(dir)) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Snapshot id collision: ${id}`);
  }
  const meta: SnapshotMeta = {
    id,
    label: label?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  copyProjectFiles(root, dir);
  writeMeta(dir, meta);
  pruneOldSnapshots(root);
  return meta;
}

/** List snapshots newest-first. */
export function listSnapshots(projectRoot: string): SnapshotMeta[] {
  const dir = projectHistoryDir(projectRoot);
  if (!fs.existsSync(dir)) return [];
  const out: SnapshotMeta[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const snapDir = path.join(dir, entry.name);
    const meta = readMeta(snapDir) ?? {
      id: entry.name,
      createdAt: fs.statSync(snapDir).mtime.toISOString(),
    };
    out.push(meta);
  }
  return out.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Restore snapshot: backup current state, overwrite project files, reopen.
 * On failure attempts to roll back from the backup snapshot.
 */
export function restoreSnapshot(projectRoot: string, snapshotId: string): LoadedProject {
  const root = path.resolve(projectRoot);
  const snapDir = path.join(projectHistoryDir(root), snapshotId);
  if (!fs.existsSync(path.join(snapDir, "project.json"))) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Snapshot not found: ${snapshotId}`);
  }

  const backup = createSnapshot(root, `_before_restore_${snapshotId}`);
  try {
    applySnapshotFiles(snapDir, root);
    return openProject(root);
  } catch (err) {
    try {
      applySnapshotFiles(path.join(projectHistoryDir(root), backup.id), root);
    } catch {
      /* best effort rollback */
    }
    throw err instanceof ForgeError
      ? err
      : new ForgeError(ErrorCodes.E_IO_001, err instanceof Error ? err.message : String(err));
  }
}

/** Save project and append a history snapshot (used by designer save). */
export function saveProjectWithSnapshot(loaded: LoadedProject, label?: string): SnapshotMeta {
  saveProject(loaded);
  return createSnapshot(loaded.root, label);
}
