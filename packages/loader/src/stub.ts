import fs from "node:fs";
import path from "node:path";
import { ErrorCodes } from "@forgeui/shared";
import type { DeviceCaps, LoadResult, Loader } from "./types.js";

export class StubLoader implements Loader {
  async load(packageDir: string, _caps: DeviceCaps): Promise<LoadResult> {
    const manifest = path.join(packageDir, "manifest.json");
    if (!fs.existsSync(manifest)) {
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
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_PACK_NOT_IMPL,
          message: "Loader runtime consume is stubbed until V1 (AR-012)",
          path: packageDir,
        },
      ],
    };
  }
}
