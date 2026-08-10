import fs from "node:fs";
import path from "node:path";
import type { LoadedProject, Node } from "./types.js";
import { ForgeError, ErrorCodes } from "@forgeui/shared";
import { uniqueId } from "./themes.js";

export interface FontAsset {
  id: string;
  /** Project-relative path, e.g. assets/fonts/ui.ttf */
  path: string;
  size?: number;
  bpp?: 1 | 2 | 4 | 8;
  /** Extra glyphs beyond auto-collected project text */
  symbols?: string;
  /** Relative path under project root after codegen, e.g. forgeui_generated/fonts/font_ui_16.c */
  generated?: string;
}

const FONT_EXT = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const TEXT_PROP_KEYS = ["text", "label", "placeholder", "title", "value"] as const;

function ensureAssets(project: LoadedProject["project"]): void {
  if (!project.assets) project.assets = { images: [], fonts: [] };
  if (!project.assets.fonts) project.assets.fonts = [];
}

export function normalizeFontAssets(project: LoadedProject["project"]): FontAsset[] {
  ensureAssets(project);
  const out: FontAsset[] = [];
  for (const item of project.assets!.fonts!) {
    if (typeof item === "string") {
      const base = path.basename(item);
      out.push({ id: path.basename(base, path.extname(base)), path: item.replace(/\\/g, "/") });
      continue;
    }
    if (item && typeof item === "object" && "path" in item) {
      const o = item as FontAsset;
      const base = path.basename(o.path);
      out.push({
        id: o.id ?? path.basename(base, path.extname(base)),
        path: o.path.replace(/\\/g, "/"),
        size: o.size,
        bpp: o.bpp,
        symbols: o.symbols,
        generated: o.generated,
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
  while (fs.existsSync(path.join(root, "assets", "fonts", candidate))) {
    candidate = `${stem}_${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export function importFontAsset(loaded: LoadedProject, sourcePath: string, opts: { size?: number } = {}): FontAsset {
  const abs = path.resolve(sourcePath);
  if (!fs.existsSync(abs)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `font not found: ${sourcePath}`);
  }
  const ext = path.extname(abs).toLowerCase();
  if (!FONT_EXT.has(ext)) {
    throw new ForgeError(ErrorCodes.E_SEM_001, `unsupported font type: ${ext}`);
  }

  ensureAssets(loaded.project);
  const fontsDir = path.join(loaded.root, "assets", "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });

  const fileName = uniqueDestName(loaded.root, path.basename(abs));
  const destAbs = path.join(fontsDir, fileName);
  fs.copyFileSync(abs, destAbs);

  const stem = path.basename(fileName, ext);
  const existing = new Set(normalizeFontAssets(loaded.project).map((f) => f.id));
  const id = uniqueId(stem.replace(/[^A-Za-z0-9_]/g, "_") || "font", existing);

  const rel = `assets/fonts/${fileName}`.replace(/\\/g, "/");
  const asset: FontAsset = { id, path: rel, size: opts.size ?? 16, bpp: 4 };
  const list = loaded.project.assets!.fonts!;
  if (!normalizeFontAssets(loaded.project).some((f) => f.path === rel)) {
    list.push(asset);
  }
  return asset;
}

function addChars(text: string, out: Set<string>): void {
  for (const ch of text) out.add(ch);
}

function collectFromExtraData(extra: Record<string, unknown>, out: Set<string>): void {
  const pairs: Array<[string, string]> = [
    ["items", "text"],
    ["items", "label"],
    ["tabs", "title"],
    ["buttons", "text"],
    ["spans", "text"],
  ];
  for (const [arrKey, field] of pairs) {
    const arr = extra[arrKey];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && typeof item === "object" && typeof (item as Record<string, unknown>)[field] === "string") {
        addChars(String((item as Record<string, unknown>)[field]), out);
      }
    }
  }
}

export function collectGlyphsFromNode(node: Node, out: Set<string>): void {
  for (const key of TEXT_PROP_KEYS) {
    const v = node.props[key];
    if (typeof v === "string") addChars(v, out);
  }
  if (node.extraData) collectFromExtraData(node.extraData, out);
  for (const child of node.children) collectGlyphsFromNode(child, out);
}

/** Collect unique glyphs used in all screens (FR-041 charset source). */
export function collectProjectGlyphs(loaded: LoadedProject): string {
  const set = new Set<string>();
  for (const screen of loaded.screens.values()) {
    for (const child of screen.children) collectGlyphsFromNode(child, set);
  }
  return [...set].join("");
}

/** ASCII printable + project glyphs + optional explicit symbols string. */
export function mergeFontCharset(projectGlyphs: string, explicit?: string): string {
  const set = new Set<string>();
  for (let cp = 0x20; cp <= 0x7e; cp += 1) set.add(String.fromCodePoint(cp));
  for (const ch of projectGlyphs) set.add(ch);
  if (explicit) for (const ch of explicit) set.add(ch);
  return [...set]
    .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    .join("");
}

export function importFontAssets(loaded: LoadedProject, sourcePaths: string[]): FontAsset[] {
  return sourcePaths.map((p) => importFontAsset(loaded, p));
}

export interface FontRefHit {
  screenId: string;
  nodeId: string;
  path: string;
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

function matchesFontRef(s: string, fontId: string): boolean {
  const t = s.trim();
  if (t === fontId) return true;
  if (t === `@${fontId}`) return true;
  if (t.startsWith("@") && t.slice(1) === fontId) return true;
  return false;
}

export function listFontReferences(loaded: LoadedProject, fontId: string): FontRefHit[] {
  const hits: FontRefHit[] = [];
  for (const [screenId, screen] of loaded.screens) {
    walkNodes(screen, (node) => {
      walkStrings({ props: node.props, style: node.style, extraData: node.extraData }, (s) => {
        if (matchesFontRef(s, fontId)) hits.push({ screenId, nodeId: node.id, path: s });
      });
    });
  }
  return hits;
}

export function countFontReferences(loaded: LoadedProject, fontId: string): number {
  return listFontReferences(loaded, fontId).length;
}

export function deleteFontAsset(loaded: LoadedProject, fontId: string): void {
  const refs = listFontReferences(loaded, fontId);
  if (refs.length > 0) {
    const sample = refs
      .slice(0, 3)
      .map((r) => `${r.screenId}/${r.nodeId}`)
      .join(", ");
    throw new ForgeError(
      ErrorCodes.E_SEM_001,
      `font is referenced (${refs.length}): ${sample}${refs.length > 3 ? "…" : ""}`,
    );
  }
  ensureAssets(loaded.project);
  const fonts = normalizeFontAssets(loaded.project);
  const hit = fonts.find((f) => f.id === fontId);
  loaded.project.assets!.fonts = (loaded.project.assets!.fonts ?? []).filter((item) => {
    if (typeof item === "string") {
      const base = path.basename(item, path.extname(item));
      return base !== fontId;
    }
    return (item as FontAsset).id !== fontId;
  });
  if (hit) {
    const abs = path.join(loaded.root, ...hit.path.split("/"));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}
