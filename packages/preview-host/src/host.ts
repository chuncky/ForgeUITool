import { ErrorCodes, ForgeError } from "@forgeui/shared";
import { SdlBackend } from "./sdl.js";
import type { PreviewBackend, PreviewBuildLogSink, PreviewHost, PreviewRunResult } from "./types.js";

class WasmBackendStub implements PreviewBackend {
  readonly id = "wasm" as const;
  async prepare(): Promise<never> {
    throw new ForgeError(ErrorCodes.E_PREVIEW_WASM_NOT_IMPL, "Wasm preview backend is stubbed (V2)");
  }
  async start(): Promise<never> {
    throw new ForgeError(ErrorCodes.E_PREVIEW_WASM_NOT_IMPL, "Wasm preview backend is stubbed (V2)");
  }
  async stop(): Promise<void> {}
}

export class DefaultPreviewHost implements PreviewHost {
  private backends = new Map<string, PreviewBackend>([
    ["sdl", new SdlBackend()],
    ["wasm", new WasmBackendStub()],
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
}

export function createPreviewHost(): PreviewHost {
  return new DefaultPreviewHost();
}
