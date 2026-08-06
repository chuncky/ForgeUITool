import { ErrorCodes, ForgeError } from "@forgeui/shared";
import { SdlBackend } from "./sdl.js";
import { WasmBackend } from "./wasm.js";
import { hotReloadPreviewIr } from "./wasm/forge-bridge.js";
import type { PreviewBackend, PreviewBuildLogSink, PreviewHost, PreviewRunResult } from "./types.js";

export class DefaultPreviewHost implements PreviewHost {
  private backends = new Map<string, PreviewBackend>([
    ["sdl", new SdlBackend()],
    ["wasm", new WasmBackend()],
  ]);

  getBackend(id: string): PreviewBackend {
    const b = this.backends.get(id);
    if (!b) throw new ForgeError(ErrorCodes.E_PREV_001, `Unknown preview backend: ${id}`);
    return b;
  }

  async run(
    projectRoot: string,
    opts: {
      backend?: string;
      prepareOnly?: boolean;
      buildOnly?: boolean;
      runOnly?: boolean;
      skipGenerate?: boolean;
      onBuildLog?: PreviewBuildLogSink;
    } = {},
  ): Promise<PreviewRunResult> {
    const backend = this.getBackend(opts.backend ?? "sdl");
    return backend.start(projectRoot, {
      prepareOnly: opts.prepareOnly,
      buildOnly: opts.buildOnly,
      runOnly: opts.runOnly,
      skipGenerate: opts.skipGenerate,
      onBuildLog: opts.onBuildLog,
    });
  }

  /** FR-063: refresh IR into resident Wasm/IR preview session (no full rebuild). */
  async hotReload(projectRoot: string): Promise<{
    ok: boolean;
    buildDir: string;
    message: string;
    diagnostics: import("@forgeui/shared").Diagnostic[];
  }> {
    const result = hotReloadPreviewIr(projectRoot);
    return {
      ok: result.ok,
      buildDir: result.buildDir,
      message: result.message,
      diagnostics: [
        {
          level: result.ok ? "info" : "warning",
          code: result.ok ? "E_PREV_HOT_RELOAD" : "E_PREV_HOT_RELOAD_SKIP",
          message: result.message,
          path: result.buildDir,
        },
      ],
    };
  }
}

export function createPreviewHost(): PreviewHost {
  return new DefaultPreviewHost();
}
