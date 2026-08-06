import fs from "node:fs";
import path from "node:path";
import {
  createProject,
  openProject,
  saveProject,
  validateProjectDir,
  type ProjectDocument,
} from "@forgeui/core";
import { ErrorCodes, type Diagnostic } from "@forgeui/shared";
import { figmaDocumentToScreens, isFigmaExportDocument } from "./figma-map.js";
import type { FigmaExportDocument } from "./figma-types.js";
import type { MutationResult } from "./types.js";

function parseFigmaFile(file: string): { ok: true; doc: FigmaExportDocument } | { ok: false; diagnostics: Diagnostic[] } {
  const abs = path.resolve(file);
  if (/\.fig$/i.test(abs) && !/\.fig\.json$/i.test(abs)) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IMPORT_NOT_IMPL,
          message: "Binary .fig files are not supported. Export forgeui-figma JSON from the Figma plugin or REST adapter.",
        },
      ],
    };
  }
  if (/figma\.com/i.test(abs)) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IMPORT_NOT_IMPL,
          message: "Figma URLs are not supported directly. Save a forgeui-figma JSON export file.",
        },
      ],
    };
  }
  if (!fs.existsSync(abs)) {
    return {
      ok: false,
      diagnostics: [{ level: "error", code: ErrorCodes.E_IO_001, message: `File not found: ${abs}` }],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IO_001,
          message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }
  if (!isFigmaExportDocument(raw)) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IMPORT_NOT_IMPL,
          message: 'Expected format "forgeui-figma" with formatVersion 1',
        },
      ],
    };
  }
  if (!raw.pages.length) {
    return {
      ok: false,
      diagnostics: [{ level: "error", code: ErrorCodes.E_SEM_001, message: "Figma export has no pages" }],
    };
  }
  return { ok: true, doc: raw };
}

/** Import forgeui-figma JSON into a new project directory (transactional — AR-031). */
export function importFigmaJson(file: string, destRoot: string): MutationResult {
  const parsed = parseFigmaFile(file);
  if (!parsed.ok) return { ok: false, diagnostics: parsed.diagnostics };

  const dest = path.resolve(destRoot);
  if (fs.existsSync(path.join(dest, "project.json"))) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IO_001,
          message: `destination already has project.json: ${dest}`,
        },
      ],
    };
  }

  const doc = parsed.doc;
  const display = {
    width: doc.display?.width ?? doc.pages[0]!.frame.w,
    height: doc.display?.height ?? doc.pages[0]!.frame.h,
    colorDepth: doc.display?.colorDepth ?? 16,
    rotation: 0,
  };

  const { screens, defaultScreenId } = figmaDocumentToScreens(doc);

  createProject({
    root: dest,
    name: doc.name,
    platform: doc.platform,
    display,
    fromTemplate: "blank",
  });

  const loaded = openProject(dest);
  const project: ProjectDocument = {
    ...loaded.project,
    name: doc.name,
    display,
    defaultScreen: defaultScreenId,
    screens: screens.map((s) => ({ id: s.id, file: `screens/${s.id}.json` })),
  };
  loaded.project = project;
  loaded.screens.clear();
  for (const screen of screens) {
    loaded.screens.set(screen.id, screen);
  }
  saveProject(loaded);

  for (const entry of fs.readdirSync(path.join(dest, "screens"))) {
    const id = entry.replace(/\.json$/, "");
    if (!screens.some((s) => s.id === id)) {
      fs.unlinkSync(path.join(dest, "screens", entry));
    }
  }

  const validation = validateProjectDir(dest);
  if (!validation.ok) {
    fs.rmSync(dest, { recursive: true, force: true });
    return { ok: false, diagnostics: validation.diagnostics };
  }

  return {
    ok: true,
    projectRoot: dest,
    diagnostics: [
      {
        level: "info",
        code: "E_FIGMA_IMPORT_OK",
        message: `Imported ${screens.length} screen(s) from Figma adapter JSON into ${dest}`,
      },
    ],
  };
}
