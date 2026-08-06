import fs from "node:fs";
import path from "node:path";
import { openProject, normalizeImageAssets, normalizeFontAssets, buildPackageLogicManifest, type LoadedProject, type ScreenDocument } from "@forgeui/core";
import { Diagnostic, ErrorCodes } from "@forgeui/shared";
import { buildAssetsManifest } from "./assets-manifest.js";
import { writeFontSubsetSidecars } from "./font-subset.js";

export interface PackOptions {
  outDir?: string;
}

export interface PackResult {
  ok: boolean;
  /** false when a full ui/ tree + manifest was written */
  skeleton: boolean;
  outDir: string;
  diagnostics: Diagnostic[];
}

const PACKAGER_VERSION = "1.0.0";
const MIN_LOADER_VERSION = "1.0.0";

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function copyTree(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function lvglMajor(version: string): number {
  const m = /^(\d+)/.exec(version.trim());
  return m ? Number(m[1]) : 9;
}

function buildManifest(loaded: LoadedProject) {
  const p = loaded.project;
  return {
    schemaVersion: "1.0.0",
    format: "forgeui-package",
    packageVersion: PACKAGER_VERSION,
    minLoaderVersion: MIN_LOADER_VERSION,
    name: p.name,
    ...(p.platform ? { platform: p.platform } : {}),
    display: { ...p.display },
    lvglMajor: lvglMajor(p.lvglVersion),
    lvglVersion: p.lvglVersion,
    entryScreen: p.defaultScreen,
    entrySymbol: p.entrySymbol,
    screens: p.screens.map((s) => s.id),
    assetCount: normalizeImageAssets(p).length,
    fontCount: normalizeFontAssets(p).length,
  };
}

function buildProjectMeta(loaded: LoadedProject) {
  const p = loaded.project;
  return {
    schemaVersion: p.schemaVersion,
    name: p.name,
    ...(p.platform ? { platform: p.platform } : {}),
    display: { ...p.display },
    lvglVersion: p.lvglVersion,
    previewBackend: p.previewBackend,
    deliveryMode: p.deliveryMode,
    entrySymbol: p.entrySymbol,
    defaultScreen: p.defaultScreen,
    screens: p.screens.map((s) => ({ id: s.id, file: `screens/${s.id}.json` })),
    assets: p.assets ?? { images: [], fonts: [] },
    colors: p.colors ?? [],
    themes: p.themes ?? [],
    naming: p.naming ?? { cPrefix: "ui_", screenPrefix: "screen_" },
  };
}

function writeScreen(outScreensDir: string, id: string, screen: ScreenDocument): void {
  writeJson(path.join(outScreensDir, `${id}.json`), screen);
}

function removeLegacyStub(outDir: string): void {
  for (const rel of ["ui.stub", "README.md"]) {
    const p = path.join(outDir, rel);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

/**
 * Packer boundary (AR-012).
 * Writes manifest + normalized ui/ JSON + assets/ for deliveryMode both|dynamic_ui.
 */
export async function packProject(projectRoot: string, opts: PackOptions = {}): Promise<PackResult> {
  const diagnostics: Diagnostic[] = [];
  const loaded = openProject(projectRoot);
  const mode = loaded.project.deliveryMode;
  const packageRel = loaded.project.export?.packageDir ?? "packages/latest";
  const outDir = path.resolve(opts.outDir ?? path.join(loaded.root, packageRel));

  if (mode === "static_c") {
    diagnostics.push({
      level: "info",
      code: "E_PACK_SKIPPED",
      message: "deliveryMode=static_c; pack skipped (A1-only). Set both|dynamic_ui to emit UI package.",
    });
    return { ok: true, skeleton: false, outDir, diagnostics };
  }

  const uiDir = path.join(outDir, "ui");
  const screensDir = path.join(uiDir, "screens");
  const assetsDir = path.join(outDir, "assets");

  fs.mkdirSync(screensDir, { recursive: true });
  removeLegacyStub(outDir);

  writeJson(path.join(outDir, "manifest.json"), buildManifest(loaded));
  writeJson(path.join(outDir, "package-logic.json"), buildPackageLogicManifest());
  writeJson(path.join(uiDir, "project.meta.json"), buildProjectMeta(loaded));

  for (const ref of loaded.project.screens) {
    const screen = loaded.screens.get(ref.id);
    if (!screen) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_SEM_001,
        message: `Missing screen data for ${ref.id}`,
      });
      return { ok: false, skeleton: false, outDir, diagnostics };
    }
    writeScreen(screensDir, ref.id, screen);
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  copyTree(path.join(loaded.root, "assets"), assetsDir);

  for (const img of normalizeImageAssets(loaded.project)) {
    const rel = img.path.replace(/^assets\//, "");
    const bundled = path.join(assetsDir, rel);
    if (!fs.existsSync(bundled)) {
      diagnostics.push({
        level: "warning",
        code: ErrorCodes.E_SEM_001,
        message: `Registered asset missing from bundle: ${img.path}`,
        path: bundled,
      });
    }
  }

  const fontSidecars = writeFontSubsetSidecars(loaded, assetsDir);
  for (const font of fontSidecars.manifest.fonts) {
    if (!font.bundled) {
      diagnostics.push({
        level: "warning",
        code: ErrorCodes.E_SEM_001,
        message: `Registered font missing from bundle: ${font.path}`,
        path: path.join(assetsDir, font.path.replace(/^assets\//, "")),
      });
    }
  }

  writeJson(path.join(assetsDir, "manifest.json"), buildAssetsManifest(assetsDir));

  fs.writeFileSync(
    path.join(outDir, "README.md"),
    `# ForgeUI UI package\n\nGenerated for \`${loaded.project.name}\` (deliveryMode=${mode}).\n\n- \`manifest.json\` — Loader compatibility header\n- \`package-logic.json\` — FR-090～093 action whitelist (AC-013)\n- \`ui/project.meta.json\` + \`ui/screens/*.json\` — normalized UI tree\n- \`assets/\` — bundled images/fonts\n`,
    "utf8",
  );

  diagnostics.push({
    level: "info",
    code: "E_PACK_OK",
    message: `Wrote A2 UI package to ${outDir}`,
    path: outDir,
  });

  return { ok: true, skeleton: false, outDir, diagnostics };
}
