import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ErrorCodes, type Diagnostic } from "@forgeui/shared";
import type { DeviceCaps, LoadResult, Loader } from "./types.js";

interface AssetsManifestFile {
  path: string;
  size: number;
  sha256: string;
}

interface AssetsManifest {
  schemaVersion?: string;
  files?: AssetsManifestFile[];
}

interface FontSubsetsManifest {
  schemaVersion?: string;
  fonts?: Array<{ id: string; path: string; bundled?: boolean }>;
}

interface PackageManifest {
  schemaVersion?: string;
  packageVersion?: string;
  minLoaderVersion?: string;
  platform?: string;
  display?: { width?: number; height?: number; colorDepth?: number };
  lvglMajor?: number;
  lvglVersion?: string;
  entryScreen?: string;
  screens?: string[];
}

interface ProjectMeta {
  defaultScreen?: string;
  screens?: Array<{ id: string; file: string }>;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function parseMajor(version: string): number {
  const m = /^(\d+)/.exec(version.trim());
  return m ? Number(m[1]) : 0;
}

function validateAssetsManifest(packageDir: string): Diagnostic | null {
  const manifestPath = path.join(packageDir, "assets", "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;

  let manifest: AssetsManifest;
  try {
    manifest = readJson<AssetsManifest>(manifestPath);
  } catch {
    return {
      level: "error",
      code: ErrorCodes.E_LOADER_FMT,
      message: "assets/manifest.json is not valid JSON",
      path: manifestPath,
    };
  }

  for (const entry of manifest.files ?? []) {
    const filePath = path.join(packageDir, "assets", entry.path);
    if (!fs.existsSync(filePath)) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `bundled asset missing: assets/${entry.path}`,
        path: filePath,
      };
    }
    const buf = fs.readFileSync(filePath);
    if (buf.length !== entry.size) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `asset size mismatch: assets/${entry.path}`,
        path: filePath,
      };
    }
    const hash = createHash("sha256").update(buf).digest("hex");
    if (hash !== entry.sha256) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `asset sha256 mismatch: assets/${entry.path}`,
        path: filePath,
      };
    }
  }
  return null;
}

function validateFontSubsets(packageDir: string): Diagnostic | null {
  const subsetsPath = path.join(packageDir, "assets", "fonts", "subsets.json");
  if (!fs.existsSync(subsetsPath)) return null;

  let manifest: FontSubsetsManifest;
  try {
    manifest = readJson<FontSubsetsManifest>(subsetsPath);
  } catch {
    return {
      level: "error",
      code: ErrorCodes.E_LOADER_FMT,
      message: "assets/fonts/subsets.json is not valid JSON",
      path: subsetsPath,
    };
  }

  for (const font of manifest.fonts ?? []) {
    if (font.bundled === false) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `font marked unbundled: ${font.path}`,
        path: subsetsPath,
      };
    }
    const rel = font.path.replace(/^assets\//, "");
    const filePath = path.join(packageDir, "assets", rel);
    if (!fs.existsSync(filePath)) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `font file missing: ${font.path}`,
        path: filePath,
      };
    }
    const charsetPath = path.join(packageDir, "assets", "fonts", `${font.id}.charset.txt`);
    if (!fs.existsSync(charsetPath)) {
      return {
        level: "error",
        code: ErrorCodes.E_LOADER_FMT,
        message: `font charset sidecar missing: fonts/${font.id}.charset.txt`,
        path: charsetPath,
      };
    }
  }
  return null;
}

/** Reference Loader: validates A2 package layout + device compatibility (AR-012). */
export class ReferenceLoader implements Loader {
  async load(packageDir: string, caps: DeviceCaps): Promise<LoadResult> {
    const diagnostics: Diagnostic[] = [];
    const manifestPath = path.join(packageDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: `manifest.json missing under ${packageDir}`,
            path: packageDir,
          },
        ],
      };
    }

    let manifest: PackageManifest;
    try {
      manifest = readJson(manifestPath);
    } catch {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: "manifest.json is not valid JSON",
            path: manifestPath,
          },
        ],
      };
    }

    const metaPath = path.join(packageDir, "ui", "project.meta.json");
    if (!fs.existsSync(metaPath)) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: "ui/project.meta.json missing",
            path: metaPath,
          },
        ],
      };
    }

    const meta = readJson<ProjectMeta>(metaPath);
    const screenIds = manifest.screens ?? meta.screens?.map((s) => s.id) ?? [];
    for (const id of screenIds) {
      const screenFile = path.join(packageDir, "ui", "screens", `${id}.json`);
      if (!fs.existsSync(screenFile)) {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_FMT,
              message: `ui/screens/${id}.json missing`,
              path: screenFile,
            },
          ],
        };
      }
    }

    const entry = manifest.entryScreen ?? meta.defaultScreen;
    if (entry && !screenIds.includes(entry)) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: `entryScreen ${entry} not found in package screens`,
          },
        ],
      };
    }

    const disp = manifest.display;
    if (disp) {
      if (disp.width !== undefined && disp.width !== caps.width) {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_RES,
              message: `display width mismatch: package ${disp.width} vs device ${caps.width}`,
            },
          ],
        };
      }
      if (disp.height !== undefined && disp.height !== caps.height) {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_RES,
              message: `display height mismatch: package ${disp.height} vs device ${caps.height}`,
            },
          ],
        };
      }
      if (disp.colorDepth !== undefined && disp.colorDepth !== caps.colorDepth) {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_RES,
              message: `colorDepth mismatch: package ${disp.colorDepth} vs device ${caps.colorDepth}`,
            },
          ],
        };
      }
    }

    const pkgMajor = manifest.lvglMajor ?? parseMajor(manifest.lvglVersion ?? "");
    const devMajor = parseMajor(caps.lvglVersion);
    if (pkgMajor && devMajor && pkgMajor !== devMajor) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_VER,
            message: `LVGL major mismatch: package ${pkgMajor} vs device ${devMajor}`,
          },
        ],
      };
    }

    const assetErr = validateAssetsManifest(packageDir);
    if (assetErr) {
      return { ok: false, diagnostics: [assetErr] };
    }

    const fontErr = validateFontSubsets(packageDir);
    if (fontErr) {
      return { ok: false, diagnostics: [fontErr] };
    }

    diagnostics.push({
      level: "info",
      code: "E_LOADER_OK",
      message: `Package validated (${screenIds.length} screens, entry=${entry ?? "?"})`,
      path: packageDir,
    });

    return { ok: true, diagnostics };
  }
}
