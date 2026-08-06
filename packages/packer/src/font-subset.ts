import fs from "node:fs";
import path from "node:path";
import {
  collectProjectGlyphs,
  mergeFontCharset,
  normalizeFontAssets,
  type FontAsset,
  type LoadedProject,
} from "@forgeui/core";

export interface FontSubsetEntry {
  id: string;
  path: string;
  size: number;
  bpp: number;
  charsetLength: number;
  bundled: boolean;
}

export interface FontSubsetsManifest {
  schemaVersion: "1.0.0";
  projectGlyphCount: number;
  fonts: FontSubsetEntry[];
}

function bundledRel(font: FontAsset): string {
  return font.path.replace(/^assets\//, "");
}

export function buildFontSubsetsManifest(loaded: LoadedProject, assetsDir: string): FontSubsetsManifest {
  const projectGlyphs = collectProjectGlyphs(loaded);
  const fonts = normalizeFontAssets(loaded.project);
  const entries: FontSubsetEntry[] = fonts.map((font) => {
    const rel = bundledRel(font);
    const bundled = fs.existsSync(path.join(assetsDir, rel));
    const charset = mergeFontCharset(projectGlyphs, font.symbols);
    return {
      id: font.id,
      path: font.path,
      size: font.size ?? 16,
      bpp: font.bpp ?? 4,
      charsetLength: charset.length,
      bundled,
    };
  });
  return {
    schemaVersion: "1.0.0",
    projectGlyphCount: projectGlyphs.length,
    fonts: entries,
  };
}

export function writeFontSubsetSidecars(
  loaded: LoadedProject,
  assetsDir: string,
): { manifest: FontSubsetsManifest; charsetFiles: string[] } {
  const fontsDir = path.join(assetsDir, "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  const projectGlyphs = collectProjectGlyphs(loaded);
  const charsetFiles: string[] = [];

  for (const font of normalizeFontAssets(loaded.project)) {
    const charset = mergeFontCharset(projectGlyphs, font.symbols);
    const rel = path.join("fonts", `${font.id}.charset.txt`);
    const abs = path.join(assetsDir, rel);
    fs.writeFileSync(abs, `${charset}\n`, "utf8");
    charsetFiles.push(rel.replace(/\\/g, "/"));
  }

  const manifest = buildFontSubsetsManifest(loaded, assetsDir);
  fs.writeFileSync(path.join(fontsDir, "subsets.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, charsetFiles };
}
