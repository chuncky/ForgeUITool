import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadedProject } from "./types.js";
import { normalizeFontAssets, type FontAsset } from "./fonts.js";
import {
  BUILTIN_FONTS,
  DEFAULT_TEXT_FONT_SIZE,
} from "./builtin-fonts.js";

export function resolveBuiltinFontsDir(repoRoot?: string | null): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.FORGEUI_BUILTIN_FONTS,
    repoRoot ? path.join(repoRoot, "xos-package", "res", "ttf") : "",
    path.resolve(here, "../../../xos-package/res/ttf"),
    path.resolve(process.cwd(), "xos-package/res/ttf"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, "SourceHanSansCN-Bold.ttf")) ||
      fs.existsSync(path.join(dir, "2312_v9.ttf"))
    ) {
      return dir;
    }
  }
  return null;
}

/**
 * Copy shipped TTFs into `assets/fonts` and register in project.assets.fonts
 * so StyleGroup / canvas / codegen share one path.
 * @returns true if project.json assets were modified
 */
export function ensureBuiltinFontsInProject(
  loaded: LoadedProject,
  fontsSrcDir?: string | null,
): boolean {
  const srcDir = fontsSrcDir || resolveBuiltinFontsDir();
  if (!srcDir || !fs.existsSync(srcDir)) return false;

  if (!loaded.project.assets) loaded.project.assets = { images: [], fonts: [] };
  if (!loaded.project.assets.fonts) loaded.project.assets.fonts = [];

  const fontsDir = path.join(loaded.root, "assets", "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });

  const existing = normalizeFontAssets(loaded.project);
  const byId = new Map(existing.map((f) => [f.id, f]));
  let changed = false;

  for (const def of BUILTIN_FONTS) {
    const src = path.join(srcDir, def.fileName);
    if (!fs.existsSync(src)) continue;

    const rel = `assets/fonts/${def.fileName}`.replace(/\\/g, "/");
    const dest = path.join(loaded.root, ...rel.split("/"));
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      changed = true;
    }

    const hit = byId.get(def.id);
    if (!hit) {
      const asset: FontAsset = {
        id: def.id,
        path: rel,
        size: DEFAULT_TEXT_FONT_SIZE,
        bpp: 4,
      };
      loaded.project.assets.fonts.push(asset);
      byId.set(def.id, asset);
      changed = true;
    } else if (hit.path !== rel && !fs.existsSync(path.join(loaded.root, hit.path))) {
      hit.path = rel;
      changed = true;
    }
  }

  return changed;
}
