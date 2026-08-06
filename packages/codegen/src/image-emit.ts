import fs from "node:fs";
import path from "node:path";
import { normalizeImageAssets, normalizeStyle, type LoadedProject, type Node, type ScreenDocument } from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";
import { decodePngRgba, rgbaToLvglArgb8888 } from "./png-decode.js";

export interface EmittedImage {
  assetId: string;
  path: string;
  cSymbol: string;
}

function cSymbolForImage(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1") || "img";
  return `forgeui_img_${safe}`;
}

function assetIdFromPath(relPath: string): string {
  return path.basename(relPath, path.extname(relPath));
}

/** Union of project.assets.images and paths referenced by widgets. */
export function collectImageAssets(loaded: LoadedProject): Array<{ id: string; path: string }> {
  const byPath = new Map<string, { id: string; path: string }>();
  for (const img of normalizeImageAssets(loaded.project)) {
    byPath.set(img.path, img);
  }

  const addPath = (src: unknown) => {
    if (typeof src !== "string" || !src.trim()) return;
    const p = src.replace(/\\/g, "/");
    if (!byPath.has(p)) {
      byPath.set(p, { id: assetIdFromPath(p), path: p });
    }
  };

  const walkStyle = (style: Record<string, unknown> | undefined) => {
    const normalized = normalizeStyle(style);
    for (const states of Object.values(normalized.parts)) {
      for (const props of Object.values(states)) {
        addPath(props.bg_image);
        addPath(props.bg_image_src);
      }
    }
  };

  const walk = (node: Node) => {
    walkStyle(node.style);
    if (node.type === "image") addPath(node.props?.src);
    if (node.type === "imagebutton") {
      addPath(node.props?.src_released);
      addPath(node.props?.src_pressed);
    }
    if (node.type === "animimg") {
      const frames = node.extraData?.frames;
      if (Array.isArray(frames)) {
        for (const f of frames) {
          if (f && typeof f === "object" && "src" in f) addPath((f as { src?: unknown }).src);
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  };

  for (const ref of loaded.project.screens) {
    const doc = loaded.screens.get(ref.id) as ScreenDocument | undefined;
    if (doc) walk(doc);
  }

  return [...byPath.values()];
}

function formatByteArray(data: Uint8Array, perLine = 16): string {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += perLine) {
    const slice = data.subarray(i, Math.min(i + perLine, data.length));
    lines.push(`    ${[...slice].map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(",")},`);
  }
  return lines.join("\n");
}

function writeImageSource(
  outDir: string,
  symbol: string,
  relPath: string,
  lvglInclude: string,
  pixels: Uint8Array,
  width: number,
  height: number,
  comment: string,
): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const hPath = path.join(outDir, `${symbol}.h`);
  const cPath = path.join(outDir, `${symbol}.c`);
  const guard = `${symbol.toUpperCase()}_H`;
  const h = `#ifndef ${guard}
#define ${guard}

#include "${lvglInclude}"

extern const lv_image_dsc_t ${symbol};

#endif
`;
  const stride = width * 4;
  const c = `#include "${symbol}.h"

/* ${comment} (${relPath}) ${width}×${height} ARGB8888 */
static const uint8_t ${symbol}_map[] = {
${formatByteArray(pixels)}
};

const lv_image_dsc_t ${symbol} = {
    .header = {
        .magic = LV_IMAGE_HEADER_MAGIC,
        .cf = LV_COLOR_FORMAT_ARGB8888,
        .flags = 0,
        .w = ${width},
        .h = ${height},
        .stride = ${stride},
        .reserved_2 = 0,
    },
    .data_size = sizeof(${symbol}_map),
    .data = ${symbol}_map,
    .reserved = NULL,
};
`;
  fs.writeFileSync(hPath, h, "utf8");
  fs.writeFileSync(cPath, c, "utf8");
  return [hPath, cPath];
}

function writeStubImage(
  outDir: string,
  symbol: string,
  relPath: string,
  lvglInclude: string,
): string[] {
  const pixels = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  return writeImageSource(outDir, symbol, relPath, lvglInclude, pixels, 1, 1, "Stub 1×1");
}

function tryEmbedPng(
  projectRoot: string,
  relPath: string,
): { pixels: Uint8Array; width: number; height: number } | null {
  const abs = path.join(projectRoot, relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(abs) || path.extname(abs).toLowerCase() !== ".png") return null;
  try {
    const { width, height, rgba } = decodePngRgba(fs.readFileSync(abs));
    return { pixels: rgbaToLvglArgb8888(rgba), width, height };
  } catch {
    return null;
  }
}

/** Emit LVGL image descriptors under codegenDir/image/ (tool zone; always overwrite). */
export function emitProjectImages(
  loaded: LoadedProject,
  imageOutDir: string,
  lvglInclude: string,
  diagnostics: Diagnostic[],
): { emitted: EmittedImage[]; files: string[] } {
  const images = collectImageAssets(loaded);
  const emitted: EmittedImage[] = [];
  const files: string[] = [];
  if (!images.length) return { emitted, files };

  for (const img of images) {
    const symbol = cSymbolForImage(img.id);
    const embedded = tryEmbedPng(loaded.root, img.path);
    let written: string[];
    if (embedded) {
      written = writeImageSource(
        imageOutDir,
        symbol,
        img.path,
        lvglInclude,
        embedded.pixels,
        embedded.width,
        embedded.height,
        "Embedded from PNG",
      );
      diagnostics.push({
        level: "info",
        code: "E_GEN_IMAGE_EMBED",
        message: `image embed ${symbol} ← ${img.path} (${embedded.width}×${embedded.height})`,
        path: written[1],
      });
    } else {
      written = writeStubImage(imageOutDir, symbol, img.path, lvglInclude);
      diagnostics.push({
        level: "warning",
        code: "E_GEN_IMAGE_STUB",
        message: `image stub ${symbol} ← ${img.path} (missing PNG or decode failed)`,
        path: written[1],
      });
    }
    files.push(...written);
    emitted.push({ assetId: img.id, path: img.path, cSymbol: symbol });
  }
  return { emitted, files };
}

/** Map project-relative asset path to emitted C symbol, if any. */
export function imageSymbolForPath(src: unknown, emitted: EmittedImage[]): string | undefined {
  if (typeof src !== "string" || !src.trim()) return undefined;
  const norm = src.replace(/\\/g, "/");
  const hit = emitted.find((e) => e.path === norm || e.path.endsWith(`/${norm}`) || norm.endsWith(e.path));
  return hit?.cSymbol;
}
