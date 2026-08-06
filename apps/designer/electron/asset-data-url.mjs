/**
 * FR-016e-a: resolve project-relative asset paths to data: URLs for canvas chrome.
 * Pure helpers + Node fs reader — unit-tested from tests/designer_canvas_asset_url.test.ts
 */
import fs from "node:fs";
import path from "node:path";

/** @param {string} relPath */
export function normalizeAssetRelPath(relPath) {
  const normalized = String(relPath ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {{ ok: true; abs: string; rel: string } | { ok: false; error: string }}
 */
export function resolveAssetAbsPath(projectRoot, relPath) {
  const rel = normalizeAssetRelPath(relPath);
  if (!rel) return { ok: false, error: "Invalid path" };
  const root = path.resolve(projectRoot);
  const abs = path.resolve(root, rel);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootPrefix)) {
    return { ok: false, error: "Path escapes project root" };
  }
  return { ok: true, abs, rel };
}

/** @param {string} filePath */
export function mimeFromAssetPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * @param {string} mime
 * @param {Buffer | Uint8Array} buf
 */
export function bufferToDataUrl(mime, buf) {
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {{ ok: true; dataUrl: string; relPath: string; mime: string } | { ok: false; error: string }}
 */
export function readProjectAssetDataUrl(projectRoot, relPath) {
  if (!projectRoot) return { ok: false, error: "No project open" };
  const resolved = resolveAssetAbsPath(projectRoot, relPath);
  if (!resolved.ok) return resolved;
  if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) {
    return { ok: false, error: "文件不存在" };
  }
  const mime = mimeFromAssetPath(resolved.abs);
  const buf = fs.readFileSync(resolved.abs);
  return {
    ok: true,
    dataUrl: bufferToDataUrl(mime, buf),
    relPath: resolved.rel,
    mime,
  };
}

/** Stable CSS font-family for an imported font id. */
export function canvasFontFamilyName(fontId) {
  const id = String(fontId ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return id ? `forgeui-font-${id}` : "";
}
