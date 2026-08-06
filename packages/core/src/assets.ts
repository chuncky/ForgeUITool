import fs from "node:fs";
import path from "node:path";
import type { LoadedProject } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";

export interface ImageAsset {
  id: string;
  /** Project-relative path, e.g. assets/images/logo.png */
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
