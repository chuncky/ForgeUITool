import type { Diagnostic } from "@forgeui/shared";
import type { ScreenDocument } from "@forgeui/core";

export interface DeviceCaps {
  width: number;
  height: number;
  colorDepth: number;
  lvglVersion: string;
}

export interface LoadResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface RuntimeScreen {
  id: string;
  name: string;
  document: ScreenDocument;
}

export interface RuntimeApplyResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  entryScreen?: string;
  screens?: RuntimeScreen[];
  packageDir?: string;
}

/** Device-side package consumer (AR-012). Full impl = V1. */
export interface Loader {
  load(packageDir: string, caps: DeviceCaps): Promise<LoadResult>;
}
