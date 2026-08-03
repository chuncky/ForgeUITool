import type { Diagnostic } from "@forgeui/shared";

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

/** Device-side package consumer (AR-012). Full impl = V1. */
export interface Loader {
  load(packageDir: string, caps: DeviceCaps): Promise<LoadResult>;
}
