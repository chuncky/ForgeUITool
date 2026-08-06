import type { Diagnostic } from "@forgeui/shared";

export interface PreviewSession {
  backendId: string;
  buildDir: string;
  pid?: number;
  logs: string[];
}

export interface PreviewPrepareResult {
  ok: boolean;
  buildDir: string;
  diagnostics: Diagnostic[];
  /** true when CMake + LVGL are available for a real binary build */
  canBuild: boolean;
}

export interface PreviewRunResult {
  ok: boolean;
  session?: PreviewSession;
  diagnostics: Diagnostic[];
  /** cmake configure/build stdout+stderr for UI log panel */
  buildLogs?: string[];
  /** Wall-clock ms for prepare+configure+build+launch */
  elapsedMs?: number;
}

export type PreviewBuildLogSink = (line: string) => void;

export interface PreviewBackend {
  readonly id: "sdl" | "wasm";
  prepare(projectRoot: string, opts?: { fetchSdl?: boolean; skipGenerate?: boolean }): Promise<PreviewPrepareResult>;
  start(
    projectRoot: string,
    opts?: {
      prepareOnly?: boolean;
      buildOnly?: boolean;
      runOnly?: boolean;
      wait?: boolean;
      skipGenerate?: boolean;
      onBuildLog?: PreviewBuildLogSink;
    },
  ): Promise<PreviewRunResult>;
  stop(session: PreviewSession): Promise<void>;
}

export interface PreviewHost {
  getBackend(id: string): PreviewBackend;
  run(
    projectRoot: string,
    opts?: {
      backend?: string;
      prepareOnly?: boolean;
      buildOnly?: boolean;
      runOnly?: boolean;
      skipGenerate?: boolean;
      onBuildLog?: PreviewBuildLogSink;
    },
  ): Promise<PreviewRunResult>;
  /** FR-063 resident IR hot-reload (no-op / skip if session missing). */
  hotReload?(projectRoot: string): Promise<{
    ok: boolean;
    buildDir: string;
    message: string;
    diagnostics: Diagnostic[];
  }>;
}
