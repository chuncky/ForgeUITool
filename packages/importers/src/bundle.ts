import fs from "node:fs";
import path from "node:path";
import { createProject, openProject, resolveCodegenPaths, saveProject, type ProjectDocument, type ScreenDocument } from "@forgeui/core";
import { ErrorCodes, type Diagnostic } from "@forgeui/shared";
import type { Importer, MutationResult } from "./types.js";

interface BundleManifest {
  format: "forgeui-bundle";
  formatVersion: number;
  includeGenerated: boolean;
  project: ProjectDocument;
  screens: Record<string, ScreenDocument>;
  userFiles?: Record<string, string>;
}

function collectCustomFiles(root: string, project: ProjectDocument): Record<string, string> {
  const paths = resolveCodegenPaths(root, project);
  const customDir = paths.customAbs;
  const out: Record<string, string> = {};
  if (!fs.existsSync(customDir)) return out;
  const relPrefix = `${paths.codegenDir}/${paths.customSubdir}`;
  const walk = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, r);
      else out[`${relPrefix}/${r}`] = fs.readFileSync(abs, "utf8");
    }
  };
  walk(customDir, "");
  return out;
}

/** Shareable single-file export (not authoritative project format — D-06). */
export function bundleProject(
  projectRoot: string,
  outFile: string,
  opts: { includeGenerated?: boolean } = {},
): { ok: boolean; diagnostics: Diagnostic[] } {
  const loaded = openProject(projectRoot);
  const includeGenerated = opts.includeGenerated === true;
  const screens: Record<string, ScreenDocument> = {};
  for (const [id, doc] of loaded.screens) screens[id] = doc;
  const bundle: BundleManifest = {
    format: "forgeui-bundle",
    formatVersion: 1,
    includeGenerated,
    project: loaded.project,
    screens,
    userFiles: collectCustomFiles(loaded.root, loaded.project),
  };
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return {
    ok: true,
    diagnostics: [
      {
        level: "info",
        code: "E_BUNDLE_OK",
        message: `Wrote ${outFile} (authoritative form remains multi-file project)`,
      },
    ],
  };
}

export function unbundleProject(bundleFile: string, destRoot: string): MutationResult {
  const diagnostics: Diagnostic[] = [];
  if (!fs.existsSync(bundleFile)) {
    return {
      ok: false,
      diagnostics: [
        { level: "error", code: ErrorCodes.E_IO_001, message: `bundle not found: ${bundleFile}` },
      ],
    };
  }
  const raw = JSON.parse(fs.readFileSync(bundleFile, "utf8")) as BundleManifest;
  if (raw.format !== "forgeui-bundle") {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IMPORT_NOT_IMPL,
          message: "Not a forgeui-bundle file",
        },
      ],
    };
  }

  fs.mkdirSync(destRoot, { recursive: true });
  if (fs.existsSync(path.join(destRoot, "project.json"))) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IO_001,
          message: `destination already has project.json: ${destRoot}`,
        },
      ],
    };
  }

  const project = raw.project;
  createProject({
    root: destRoot,
    name: project.name,
    platform: project.platform,
    display: project.display,
    fromTemplate: "blank",
  });
  const loaded = openProject(destRoot);
  const blankHome = path.join(destRoot, "screens/home.json");
  if (fs.existsSync(blankHome) && !raw.screens.home) fs.unlinkSync(blankHome);

  loaded.project = project;
  loaded.screens.clear();
  for (const [id, doc] of Object.entries(raw.screens)) {
    loaded.screens.set(id, doc);
  }
  saveProject(loaded);

  if (raw.userFiles) {
    for (const [rel, content] of Object.entries(raw.userFiles)) {
      const abs = path.join(destRoot, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }
  }

  diagnostics.push({
    level: "info",
    code: "E_UNBUNDLE_OK",
    message: `Unbundled into ${destRoot}`,
  });
  return { ok: true, diagnostics, projectRoot: destRoot };
}

export class ForgeuiBundleImporter implements Importer {
  readonly id = "forgeui-bundle";

  canHandle(file: string): boolean {
    return /\.forgeui$/i.test(file);
  }

  async import(file: string, destRoot: string): Promise<MutationResult> {
    return unbundleProject(file, destRoot);
  }
}
