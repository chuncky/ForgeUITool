import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { LoadedProject } from "@forgeui/core";
import {
  collectProjectGlyphs,
  mergeFontCharset,
  normalizeFontAssets,
  type FontAsset,
} from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";

function cIdent(id: string, size: number): string {
  return `forgeui_font_${id}_${size}`.replace(/[^A-Za-z0-9_]/g, "_");
}

export function fontCIdent(id: string, size: number): string {
  return cIdent(id, size);
}

export function fontBaseName(id: string, size: number): string {
  return `font_${id}_${size}`;
}

/** Resolve designer text_font ref (id or @id) to include basename + C symbol.
 *  `sizeOverride` maps Beken `font_size` (style text_font_size); default 16 when only family set.
 */
export function fontRefForStyle(
  ref: unknown,
  fonts: FontAsset[] | undefined,
  sizeOverride?: unknown,
): { include: string; expr: string; size: number; fontId: string } | null {
  if (typeof ref !== "string" || !ref.trim() || !fonts?.length) return null;
  const raw = ref.startsWith("@") ? ref.slice(1) : ref;
  const font = fonts.find((f) => f.id === raw);
  if (!font) return null;
  const fromStyle = Number(sizeOverride);
  const size =
    Number.isFinite(fromStyle) && fromStyle > 0
      ? Math.round(fromStyle)
      : (font.size ?? 16);
  return {
    include: fontBaseName(font.id, size),
    expr: fontCIdent(font.id, size),
    size,
    fontId: font.id,
  };
}

/** Built-in LVGL montserrat pointer when only font_size is set (BK-like default family). */
export function builtinFontExprForSize(size: unknown): string | null {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = Math.round(n);
  // Common lv_conf montserrat sizes; others fall back to 14
  const allowed = new Set([8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48]);
  const pick = allowed.has(s) ? s : 14;
  return `&lv_font_montserrat_${pick}`;
}

/** True when file header looks like TTF/OTF/WOFF (skip lv_font_conv on dummy imports). */
export function isLikelyFontFile(filePath: string): boolean {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 4) return false;
    if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return true;
    if (buf[0] === 0x4f && buf[1] === 0x54 && buf[2] === 0x54 && buf[3] === 0x4f) return true;
    if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x46) return true;
    if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32) return true;
    return false;
  } catch {
    return false;
  }
}

export function writeFontHeader(
  baseName: string,
  cName: string,
  hPath: string,
  stub: boolean,
  charsetLen = 0,
): void {
  const guard = `FORGEUI_${baseName.toUpperCase()}_H`;
  const note = stub
    ? `/** Stub: lv_font_conv unavailable or invalid font file. Charset: ${baseName}.charset.txt (${charsetLen} glyphs). */`
    : `/** Bitmap font from lv_font_conv. Charset: ${baseName}.charset.txt (${charsetLen} glyphs). */`;
  fs.writeFileSync(
    hPath,
    `#ifndef ${guard}
#define ${guard}
#include "lvgl/lvgl.h"

${note}
extern const lv_font_t *${cName};

#define FORGEUI_FONT_${baseName.toUpperCase()} ${cName}

#endif
`,
    "utf8",
  );
}

/** Post-process lv_font_conv .c: lvgl include path + pointer alias for CodeGen symbol. */
export function normalizeLvFontConvSource(cPath: string, cName: string, baseName: string): boolean {
  let src = fs.readFileSync(cPath, "utf8");
  if (src.includes(`const lv_font_t *${cName}`)) return true;

  const match = src.match(/const\s+lv_font_t\s+(\w+)\s*=/);
  if (!match) return false;

  const generated = match[1]!;
  src = src.replace(/#include\s+"lvgl\.h"/g, '#include "lvgl/lvgl.h"');
  if (!src.includes(`#include "${baseName}.h"`)) {
    src = `#include "${baseName}.h"\n\n${src}`;
  }
  src = `${src.trimEnd()}\n\nconst lv_font_t *${cName} = &${generated};\n`;
  fs.writeFileSync(cPath, src, "utf8");
  return true;
}

function buildGlyphCliArgs(symbols: string): string[] {
  const args = ["-r", "0x20-0x7E"];
  const seen = new Set<number>();
  for (const ch of symbols) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) continue;
    if (seen.has(cp)) continue;
    seen.add(cp);
    args.push("-r", `0x${cp.toString(16).toUpperCase()}`);
  }
  return args;
}

function tryRunLvFontConv(opts: {
  fontPath: string;
  size: number;
  bpp: number;
  symbols: string;
  outC: string;
}): boolean {
  const cliArgs = [
    "--font",
    opts.fontPath,
    "--size",
    String(opts.size),
    "--bpp",
    String(opts.bpp),
    "--format",
    "lvgl",
    "--lv-include",
    "lvgl/lvgl.h",
    "--no-compress",
    "--no-prefilter",
    ...buildGlyphCliArgs(opts.symbols),
    "-o",
    opts.outC,
  ];
  const run = spawnSync("npx", ["--yes", "-p", "lv_font_conv@1.5.3", "lv_font_conv", ...cliArgs], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 120_000,
  });
  return run.status === 0 && fs.existsSync(opts.outC);
}

function writeStubFont(baseName: string, cName: string, charsetLen: number, hPath: string, cPath: string): void {
  writeFontHeader(baseName, cName, hPath, true, charsetLen);
  fs.writeFileSync(
    cPath,
    `#include "${baseName}.h"

/* FR-041 stub — aliases LVGL default until lv_font_conv succeeds. */
const lv_font_t *${cName} = &lv_font_montserrat_14;
`,
    "utf8",
  );
}

export function emitProjectFonts(
  loaded: LoadedProject,
  fontsOutDir: string,
  diagnostics: Diagnostic[],
): string[] {
  const fonts = normalizeFontAssets(loaded.project);
  if (!fonts.length) return [];

  fs.mkdirSync(fontsOutDir, { recursive: true });
  const projectGlyphs = collectProjectGlyphs(loaded);
  const written: string[] = [];
  const targets = collectFontSizeTargets(loaded, fonts);

  for (const { font, size } of targets) {
    written.push(...emitOneFont(loaded, font, size, fontsOutDir, projectGlyphs, diagnostics));
  }
  return written;
}

/** Collect (font asset, size) pairs: asset default size + every style text_font_size override (BK). */
export function collectFontSizeTargets(
  loaded: LoadedProject,
  fonts: FontAsset[],
): Array<{ font: FontAsset; size: number }> {
  const byId = new Map(fonts.map((f) => [f.id, f]));
  const key = (id: string, size: number) => `${id}@${size}`;
  const seen = new Set<string>();
  const out: Array<{ font: FontAsset; size: number }> = [];

  const add = (fontId: string, size: number) => {
    const font = byId.get(fontId);
    if (!font) return;
    const s = Math.max(1, Math.round(size));
    const k = key(fontId, s);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ font, size: s });
  };

  for (const font of fonts) {
    add(font.id, font.size ?? 16);
  }

  const walkStyle = (style: Record<string, unknown> | undefined) => {
    if (!style || typeof style !== "object") return;
    for (const part of Object.values(style)) {
      if (!part || typeof part !== "object") continue;
      for (const state of Object.values(part as Record<string, unknown>)) {
        if (!state || typeof state !== "object") continue;
        const props = state as Record<string, unknown>;
        const ref = props.text_font;
        if (typeof ref !== "string" || !ref.trim()) continue;
        const id = ref.startsWith("@") ? ref.slice(1) : ref;
        const sz = Number(props.text_font_size);
        if (Number.isFinite(sz) && sz > 0) add(id, sz);
      }
    }
  };

  for (const screen of loaded.screens.values()) {
    const walk = (node: { style?: Record<string, unknown>; children?: unknown[] }) => {
      walkStyle(node.style);
      for (const c of node.children ?? []) {
        if (c && typeof c === "object") walk(c as { style?: Record<string, unknown>; children?: unknown[] });
      }
    };
    walk(screen);
  }

  return out;
}

function emitOneFont(
  loaded: LoadedProject,
  font: FontAsset,
  size: number,
  fontsOutDir: string,
  projectGlyphs: string,
  diagnostics: Diagnostic[],
): string[] {
  const bpp = font.bpp ?? 4;
  const symbols = mergeFontCharset(projectGlyphs, font.symbols);
  const baseName = `font_${font.id}_${size}`;
  const charsetPath = path.join(fontsOutDir, `${baseName}.charset.txt`);
  const cPath = path.join(fontsOutDir, `${baseName}.c`);
  const hPath = path.join(fontsOutDir, `${baseName}.h`);
  const srcAbs = path.join(loaded.root, font.path);
  const cName = cIdent(font.id, size);
  const files = [charsetPath];

  fs.writeFileSync(charsetPath, `${symbols}\n`, "utf8");

  if (
    fs.existsSync(srcAbs) &&
    isLikelyFontFile(srcAbs) &&
    tryRunLvFontConv({ fontPath: srcAbs, size, bpp, symbols, outC: cPath }) &&
    normalizeLvFontConvSource(cPath, cName, baseName)
  ) {
    writeFontHeader(baseName, cName, hPath, false, symbols.length);
    files.push(hPath, cPath);
    if (size === (font.size ?? 16)) {
      font.generated = `forgeui_generated/fonts/${baseName}.c`;
    }
    diagnostics.push({
      level: "info",
      code: "E_FONT_OK",
      message: `lv_font_conv → forgeui_generated/fonts/${baseName}.c (${symbols.length} glyphs)`,
    });
    return files;
  }

  if (fs.existsSync(cPath)) {
    try {
      fs.unlinkSync(cPath);
    } catch {
      /* ignore partial conv output */
    }
  }

  writeStubFont(baseName, cName, symbols.length, hPath, cPath);
  if (size === (font.size ?? 16)) {
    font.generated = `forgeui_generated/fonts/${baseName}.c`;
  }
  files.push(hPath, cPath);
  diagnostics.push({
    level: "warning",
    code: "E_FONT_STUB",
    message: `Font stub ${baseName} (charset in ${baseName}.charset.txt); valid TTF + lv_font_conv required for bitmap output`,
  });
  return files;
}
