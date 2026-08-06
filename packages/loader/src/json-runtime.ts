import fs from "node:fs";
import path from "node:path";
import type { Node, ScreenDocument } from "@forgeui/core";
import { ErrorCodes } from "@forgeui/shared";
import { ReferenceLoader } from "./reference.js";
import type { DeviceCaps, RuntimeApplyResult, RuntimeScreen } from "./types.js";

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** Count widget nodes in a screen tree (excludes the screen root). */
export function countRuntimeWidgets(root: Node): number {
  let n = 0;
  const walk = (node: Node) => {
    for (const child of node.children) {
      n++;
      walk(child);
    }
  };
  walk(root);
  return n;
}

/**
 * Host-side A2 JSON runtime loader: validates package layout then parses
 * `ui/screens/*.json` into in-memory screen trees (M6 / AR-012 step 1).
 */
export class JsonRuntimeLoader {
  private readonly validator = new ReferenceLoader();

  async apply(packageDir: string, caps: DeviceCaps): Promise<RuntimeApplyResult> {
    const validation = await this.validator.load(packageDir, caps);
    if (!validation.ok) {
      return { ok: false, diagnostics: validation.diagnostics };
    }

    const manifestPath = path.join(packageDir, "manifest.json");
    const metaPath = path.join(packageDir, "ui", "project.meta.json");
    const manifest = readJson<{ entryScreen?: string; screens?: string[] }>(manifestPath);
    const meta = readJson<{
      defaultScreen?: string;
      screens?: Array<{ id: string; file: string }>;
    }>(metaPath);

    const screenRefs = meta.screens ?? [];
    if (!screenRefs.length) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: "ui/project.meta.json has no screens",
            path: metaPath,
          },
        ],
      };
    }

    const screens: RuntimeScreen[] = [];
    for (const ref of screenRefs) {
      const screenFile = path.join(packageDir, "ui", "screens", `${ref.id}.json`);
      if (!fs.existsSync(screenFile)) {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_FMT,
              message: `ui/screens/${ref.id}.json missing`,
              path: screenFile,
            },
          ],
        };
      }
      let doc: ScreenDocument;
      try {
        doc = readJson<ScreenDocument>(screenFile);
      } catch {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_FMT,
              message: `ui/screens/${ref.id}.json is not valid JSON`,
              path: screenFile,
            },
          ],
        };
      }
      if (doc.type !== "screen") {
        return {
          ok: false,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_LOADER_FMT,
              message: `ui/screens/${ref.id}.json root type must be "screen"`,
              path: screenFile,
            },
          ],
        };
      }
      screens.push({ id: ref.id, name: doc.name, document: doc });
    }

    const entryScreen =
      manifest.entryScreen ?? meta.defaultScreen ?? manifest.screens?.[0] ?? screenRefs[0]?.id;

    if (entryScreen && !screens.some((s) => s.id === entryScreen)) {
      return {
        ok: false,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_LOADER_FMT,
            message: `entryScreen ${entryScreen} not found in parsed screens`,
            path: manifestPath,
          },
        ],
      };
    }

    return {
      ok: true,
      diagnostics: [
        {
          level: "info",
          code: "E_LOADER_RUNTIME_OK",
          message: `Parsed ${screens.length} screen(s) from A2 JSON; entry=${entryScreen ?? "?"}`,
          path: packageDir,
        },
      ],
      entryScreen,
      screens,
      packageDir,
    };
  }

  /** Return parsed entry screen document when apply succeeded. */
  entryDocument(result: RuntimeApplyResult): ScreenDocument | undefined {
    if (!result.ok || !result.entryScreen) return undefined;
    return result.screens?.find((s) => s.id === result.entryScreen)?.document;
  }
}

/** FR-086: flatten JsonRuntimeLoader.apply into designer pack-preview payload. */
export function summarizePackRuntime(result: RuntimeApplyResult): {
  widgetCount: number;
  screenCount: number;
  entryScreen: string | null;
  screens: Array<{ id: string; name: string; document: ScreenDocument }>;
} {
  const screens = result.ok ? (result.screens ?? []) : [];
  let widgetCount = 0;
  for (const s of screens) {
    widgetCount += countRuntimeWidgets(s.document);
  }
  return {
    widgetCount,
    screenCount: screens.length,
    entryScreen: result.entryScreen ?? null,
    screens: screens.map((s) => ({
      id: s.id,
      name: s.name,
      document: s.document,
    })),
  };
}
