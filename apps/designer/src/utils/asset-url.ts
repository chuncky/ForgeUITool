/**
 * FR-016e: renderer helpers for project asset data URLs + canvas font faces.
 * Path→bytes lives in Electron `asset-data-url.mjs` / IPC `project:assetDataUrl`.
 */

const dataUrlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const registeredFonts = new Set<string>();

export function canvasFontFamilyName(fontId: string): string {
  const id = String(fontId ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return id ? `forgeui-font-${id}` : "";
}

export function isUsableDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:[^;]+;base64,/.test(value) && value.length > "data:;base64,".length + 8;
}

export function clearAssetUrlCache(): void {
  dataUrlCache.clear();
  pending.clear();
}

/** Resolve project-relative path to data URL (cached). Returns null if unavailable. */
export async function resolveProjectAssetDataUrl(relPath: string): Promise<string | null> {
  const key = String(relPath ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!key) return null;
  if (isUsableDataUrl(key)) return key;
  if (dataUrlCache.has(key)) return dataUrlCache.get(key)!;
  const existing = pending.get(key);
  if (existing) return existing;

  const task = (async () => {
    const api = window.forgeuiDesktop?.resolveAssetDataUrl;
    if (!api) return null;
    try {
      const res = await api(key);
      if (res?.ok && isUsableDataUrl(res.dataUrl)) {
        dataUrlCache.set(key, res.dataUrl!);
        return res.dataUrl!;
      }
    } catch {
      /* ignore */
    }
    return null;
  })();

  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

/** Inject @font-face for a font id once data URL is known. */
export function ensureCanvasFontFace(fontId: string, dataUrl: string): string {
  const family = canvasFontFamilyName(fontId);
  if (!family || !isUsableDataUrl(dataUrl)) return "";
  if (typeof document !== "undefined" && !registeredFonts.has(family)) {
    const style = document.createElement("style");
    style.setAttribute("data-forgeui-font", family);
    style.textContent = `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(dataUrl)});font-display:swap;}`;
    document.head.appendChild(style);
    registeredFonts.add(family);
  }
  return family;
}

/** Look up font path from project font assets list. */
export function fontPathForId(
  fontId: string,
  fonts: Array<{ id: string; path: string }>,
): string | undefined {
  const id = String(fontId ?? "")
    .trim()
    .replace(/^@/, "");
  if (!id) return undefined;
  return fonts.find((f) => f.id === id || f.path === fontId)?.path;
}
