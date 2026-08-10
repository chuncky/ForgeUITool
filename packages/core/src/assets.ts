import fs from "node:fs";
import path from "node:path";
import type { LoadedProject, Node } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";

export interface ImageAsset {
  id: string;
  /** Project-relative path, e.g. assets/images/logo.png */
  path: string;
}

export interface AssetRefHit {
  screenId: string;
  nodeId: string;
  path: string;
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);

function ensureAssets(project: LoadedProject["project"]): void {
  if (!project.assets) project.assets = { images: [], fonts: [] };
  if (!project.assets.images) project.assets.images = [];
  if (!project.assets.fonts) project.assets.fonts = [];
}

export function normalizeImageAssets(project: LoadedProject["project"]): ImageAsset[] {
  ensureAssets(project);
  const out: ImageAsset[] = [];
  for (const item of project.assets!.images!) {
    if (typeof item === "string") {
      out.push({ id: path.basename(item, path.extname(item)), path: item });
      continue;
    }
    if (item && typeof item === "object" && "path" in item) {
      const o = item as { id?: string; path: string };
      out.push({
        id: o.id ?? path.basename(o.path, path.extname(o.path)),
        path: o.path.replace(/\\/g, "/"),
      });
    }
  }
  return out;
}

function uniqueDestName(root: string, baseName: string): string {
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  let candidate = baseName;
  let n = 1;
  while (fs.existsSync(path.join(root, "assets", "images", candidate))) {
    candidate = `${stem}_${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export function importImageAsset(loaded: LoadedProject, sourcePath: string): ImageAsset {
  const abs = path.resolve(sourcePath);
  if (!fs.existsSync(abs)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `image not found: ${sourcePath}`);
  }
  const ext = path.extname(abs).toLowerCase();
  if (!IMAGE_EXT.has(ext)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `unsupported image type: ${ext}`);
  }

  ensureAssets(loaded.project);
  const imagesDir = path.join(loaded.root, "assets", "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  const fileName = uniqueDestName(loaded.root, path.basename(abs));
  const destAbs = path.join(imagesDir, fileName);
  fs.copyFileSync(abs, destAbs);

  const rel = `assets/images/${fileName}`.replace(/\\/g, "/");
  const asset: ImageAsset = {
    id: path.basename(fileName, ext),
    path: rel,
  };

  const existing = normalizeImageAssets(loaded.project);
  if (!existing.some((a) => a.path === rel)) {
    loaded.project.assets!.images!.push(asset);
  }
  return asset;
}

export function importImageAssets(loaded: LoadedProject, sourcePaths: string[]): ImageAsset[] {
  return sourcePaths.map((p) => importImageAsset(loaded, p));
}

function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) walkStrings(v, visit);
  }
}

function walkNodes(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkNodes(child, visit);
}

function normPath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Collect references to an image path (or any assets/images path substring match). */
export function listImageReferences(loaded: LoadedProject, imagePath: string): AssetRefHit[] {
  const target = normPath(imagePath);
  const hits: AssetRefHit[] = [];
  for (const [screenId, screen] of loaded.screens) {
    walkNodes(screen, (node) => {
      const bag = {
        props: node.props,
        style: node.style,
        extraData: node.extraData,
      };
      walkStrings(bag, (s) => {
        if (normPath(s) === target || normPath(s).endsWith("/" + path.basename(target))) {
          hits.push({ screenId, nodeId: node.id, path: s });
        }
      });
    });
  }
  return hits;
}

export function countImageReferences(loaded: LoadedProject, imagePath: string): number {
  return listImageReferences(loaded, imagePath).length;
}

export function deleteImageAsset(loaded: LoadedProject, imagePath: string): void {
  const target = normPath(imagePath);
  const refs = listImageReferences(loaded, target);
  if (refs.length > 0) {
    const sample = refs
      .slice(0, 3)
      .map((r) => `${r.screenId}/${r.nodeId}`)
      .join(", ");
    throw new ForgeError(
      ErrorCodes.E_SEM_001,
      `image is referenced (${refs.length}): ${sample}${refs.length > 3 ? "…" : ""}`,
    );
  }
  ensureAssets(loaded.project);
  loaded.project.assets!.images = (loaded.project.assets!.images ?? []).filter((item) => {
    const p = typeof item === "string" ? item : (item as { path?: string }).path;
    return normPath(String(p ?? "")) !== target;
  });
  const abs = path.join(loaded.root, ...target.split("/"));
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

/**
 * Remove files under assets/images that are not registered and not referenced.
 * Never touches fonts.
 */
export function pruneOrphanImages(loaded: LoadedProject): string[] {
  const imagesDir = path.join(loaded.root, "assets", "images");
  if (!fs.existsSync(imagesDir)) return [];
  const registered = new Set(normalizeImageAssets(loaded.project).map((a) => normPath(a.path)));
  const removed: string[] = [];
  for (const name of fs.readdirSync(imagesDir)) {
    const abs = path.join(imagesDir, name);
    if (!fs.statSync(abs).isFile()) continue;
    const rel = `assets/images/${name}`.replace(/\\/g, "/");
    if (registered.has(rel)) continue;
    if (countImageReferences(loaded, rel) > 0) continue;
    fs.unlinkSync(abs);
    removed.push(rel);
  }
  return removed;
}
