import type { Importer, MutationResult } from "./types.js";
import { importFigmaJson } from "./figma-import.js";

export class FigmaImporter implements Importer {
  readonly id = "figma";

  canHandle(file: string): boolean {
    return (
      /\.(figma\.json|fig\.json)$/i.test(file) ||
      /figma.*\.json$/i.test(file) ||
      /\.(fig|figma)$/i.test(file) ||
      /figma\.com/i.test(file)
    );
  }

  async import(file: string, destRoot: string): Promise<MutationResult> {
    return importFigmaJson(file, destRoot);
  }
}

export { importFigmaJson } from "./figma-import.js";
export type { FigmaExportDocument, FigmaExportNode, FigmaExportPage } from "./figma-types.js";
export { figmaDocumentToScreens, isFigmaExportDocument } from "./figma-map.js";
