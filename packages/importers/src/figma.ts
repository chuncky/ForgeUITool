import { ErrorCodes } from "@forgeui/shared";
import type { Importer, MutationResult } from "./types.js";

export class FigmaImporter implements Importer {
  readonly id = "figma";

  canHandle(file: string): boolean {
    return /\.(fig|figma)$/i.test(file) || /figma\.com/i.test(file);
  }

  async import(_file: string, _destRoot: string): Promise<MutationResult> {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IMPORT_NOT_IMPL,
          message: "FigmaImporter is stubbed until V2/V3 (AR-031)",
        },
      ],
    };
  }
}
