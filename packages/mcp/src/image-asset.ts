import fs from "node:fs";
import path from "node:path";
import { normalizeImageAssets, openProject, saveProject, type LoadedProject } from "@forgeui/core";
import { ErrorCodes, ForgeError } from "@forgeui/shared";
import { readPngDimensions } from "./png-utils.js";

const SAFE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/;

function ensureAssets(project: LoadedProject["project"]): void {
  if (!project.assets) project.assets = { images: [], fonts: [] };
  if (!project.assets.images) project.assets.images = [];
}

export function createImageAsset(
  loaded: LoadedProject,
  opts: {
    name: string;
    imagePath: string;
    targetWidth: number;
    targetHeight: number;
    purpose?: string;
  },
): { assetId: string; relativePath: string; width: number; height: number; purpose?: string } {
  const name = opts.name.trim();
  if (!SAFE_NAME.test(name)) {
    throw new ForgeError(
      ErrorCodes.E_MCP_ARGS,
      "name must be [a-zA-Z_][a-zA-Z0-9_]{0,49}",
    );
  }
  if (!Number.isFinite(opts.targetWidth) || !Number.isFinite(opts.targetHeight)) {
    throw new ForgeError(ErrorCodes.E_MCP_ARGS, "targetWidth and targetHeight are required");
  }

  const abs = path.resolve(opts.imagePath);
  if (!fs.existsSync(abs)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `image not found: ${opts.imagePath}`);
  }
  const ext = path.extname(abs).toLowerCase();
  if (ext !== ".png") {
    throw new ForgeError(ErrorCodes.E_SEM_001, "only PNG is supported for create_image_asset");
  }

  let dims: { width: number; height: number };
  try {
    dims = readPngDimensions(fs.readFileSync(abs));
  } catch {
    throw new ForgeError(ErrorCodes.E_SEM_001, "invalid PNG file");
  }
  if (dims.width !== opts.targetWidth || dims.height !== opts.targetHeight) {
    throw new ForgeError(
      ErrorCodes.E_MCP_ARGS,
      `IMAGE_SIZE_MISMATCH: PNG is ${dims.width}x${dims.height}, expected ${opts.targetWidth}x${opts.targetHeight}`,
    );
  }

  ensureAssets(loaded.project);
  const existing = normalizeImageAssets(loaded.project);
  if (existing.some((a) => a.id === name)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `asset name already exists: ${name}`);
  }

  const imagesDir = path.join(loaded.root, "assets", "images");
  fs.mkdirSync(imagesDir, { recursive: true });
  const fileName = `${name}.png`;
  const destAbs = path.join(imagesDir, fileName);
  if (fs.existsSync(destAbs)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `file already exists: assets/images/${fileName}`);
  }
  fs.copyFileSync(abs, destAbs);

  const rel = `assets/images/${fileName}`.replace(/\\/g, "/");
  loaded.project.assets!.images!.push({ id: name, path: rel });

  return {
    assetId: name,
    relativePath: rel,
    width: dims.width,
    height: dims.height,
    purpose: opts.purpose,
  };
}

export function createImageAssetForProject(
  projectRoot: string,
  opts: {
    name: string;
    imagePath: string;
    targetWidth: number;
    targetHeight: number;
    purpose?: string;
    persist?: boolean;
  },
) {
  const loaded = openProject(projectRoot);
  const result = createImageAsset(loaded, opts);
  if (opts.persist !== false) saveProject(loaded);
  return { ok: true, ...result };
}
