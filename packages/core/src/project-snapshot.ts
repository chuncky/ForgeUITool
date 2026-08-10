import fs from "node:fs";
import path from "node:path";
import { openProject, saveProject } from "./workspace.js";
import type { LoadedProject, ProjectDocument, ScreenDocument } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";

/** Beken-aligned archive cap (workspace-archive-history.md). */
export const MAX_SNAPSHOTS = 50;

export interface SnapshotMeta {
  id: string;
  label?: string;
  createdAt: string;
  /** Number of screens in the snapshot. */
  pageCount: number;
  /** Approx size of snapshot files on disk (bytes). */
  byteSize: number;
  /** Display size captured from project.json (for preview frame). */
  width?: number;
  height?: number;
  /** Screen ids in project order. */
  screenIds?: string[];
  /** Default screen id for initial preview selection. */
  defaultScreen?: string;
}

export interface SnapshotPreview {
  meta: SnapshotMeta;
  project: ProjectDocument;
  /** screenId → document */
  screens: Record<string, ScreenDocument>;
}

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

function dirByteSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirByteSize(p);
    else {
      try {
        total += fs.statSync(p).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

function writeMeta(dir: string, meta: SnapshotMeta): void {
  fs.writeFileSync(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function readMetaRaw(dir: string): Partial<SnapshotMeta> | null {
  const file = path.join(dir, "meta.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Partial<SnapshotMeta>;
  } catch {
    return null;
  }
}

function enrichMeta(snapDir: string, id: string, raw?: Partial<SnapshotMeta> | null): SnapshotMeta {
  let pageCount = raw?.pageCount ?? 0;
  let width = raw?.width;
  let height = raw?.height;
  let screenIds = raw?.screenIds;
  let defaultScreen = raw?.defaultScreen;
  const projectPath = path.join(snapDir, "project.json");
  if (fs.existsSync(projectPath)) {
    try {
      const project = JSON.parse(fs.readFileSync(projectPath, "utf8")) as ProjectDocument;
      pageCount = project.screens?.length ?? pageCount;
      width = project.display?.width ?? width;
      height = project.display?.height ?? height;
      screenIds = (project.screens ?? []).map((s) => s.id);
      defaultScreen = project.defaultScreen ?? screenIds[0];
    } catch {
      /* keep raw */
    }
  }
  return {
    id: raw?.id ?? id,
    label: raw?.label,
    createdAt: raw?.createdAt ?? fs.statSync(snapDir).mtime.toISOString(),
    pageCount,
    byteSize: raw?.byteSize && raw.byteSize > 0 ? raw.byteSize : dirByteSize(snapDir),
    width,
    height,
    screenIds,
    defaultScreen,
  };
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

function dropOldestSnapshots(projectRoot: string, keep: number): void {
  const items = listSnapshots(projectRoot);
  if (items.length <= keep) return;
  for (const s of items.slice(keep)) {
    rmTree(path.join(projectHistoryDir(projectRoot), s.id));
  }
}

/** Format byte size like Beken cards ("84.0 KB"). */
export function formatSnapshotSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Copy current project.json + screens/ into `.forge/history/<id>/` (FR-004). */
export function createSnapshot(
  projectRoot: string,
  label?: string,
  opts?: { force?: boolean },
): SnapshotMeta {
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(path.join(root, "project.json"))) {
    throw new ForgeError(ErrorCodes.E_IO_001, "project.json missing");
  }
  const existing = listSnapshots(root);
  if (!opts?.force && existing.length >= MAX_SNAPSHOTS) {
    throw new ForgeError(
      ErrorCodes.E_IO_001,
      `历史版本已达上限 ${MAX_SNAPSHOTS}，请先删除旧版本后再存档`,
    );
  }
  if (opts?.force && existing.length >= MAX_SNAPSHOTS) {
    dropOldestSnapshots(root, MAX_SNAPSHOTS - 1);
  }

  const id = uniqueSnapshotId(root);
  const dir = path.join(projectHistoryDir(root), id);
  if (fs.existsSync(dir)) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Snapshot id collision: ${id}`);
  }

  copyProjectFiles(root, dir);
  const meta = enrichMeta(dir, id, {
    id,
    label: label?.trim() || undefined,
    createdAt: new Date().toISOString(),
  });
  writeMeta(dir, meta);
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
    out.push(enrichMeta(snapDir, entry.name, readMetaRaw(snapDir)));
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** Load a snapshot for in-dialog preview without restoring the workspace. */
export function loadSnapshotPreview(projectRoot: string, snapshotId: string): SnapshotPreview {
  const root = path.resolve(projectRoot);
  const snapDir = path.join(projectHistoryDir(root), snapshotId);
  const projectPath = path.join(snapDir, "project.json");
  if (!fs.existsSync(projectPath)) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Snapshot not found: ${snapshotId}`);
  }
  const project = JSON.parse(fs.readFileSync(projectPath, "utf8")) as ProjectDocument;
  const screens: Record<string, ScreenDocument> = {};
  for (const ref of project.screens ?? []) {
    const file = path.join(snapDir, ref.file);
    if (!fs.existsSync(file)) continue;
    screens[ref.id] = JSON.parse(fs.readFileSync(file, "utf8")) as ScreenDocument;
  }
  const meta = enrichMeta(snapDir, snapshotId, readMetaRaw(snapDir));
  return { meta, project, screens };
}

/** Delete one history version (Beken card trash). */
export function deleteSnapshot(projectRoot: string, snapshotId: string): void {
  const root = path.resolve(projectRoot);
  const snapDir = path.join(projectHistoryDir(root), snapshotId);
  if (!fs.existsSync(snapDir)) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Snapshot not found: ${snapshotId}`);
  }
  rmTree(snapDir);
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

  // Force room for pre-restore backup when already at cap.
  const backup = createSnapshot(root, `_before_restore_${snapshotId}`, { force: true });
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
export function saveProjectWithSnapshot(loaded: LoadedProject, label?: string): SnapshotMeta | null {
  saveProject(loaded);
  try {
    return createSnapshot(loaded.root, label);
  } catch (err) {
    // At archive cap (50): keep disk save; caller may surface the message.
    if (err instanceof ForgeError && /上限/.test(err.message)) {
      return null;
    }
    throw err;
  }
}
