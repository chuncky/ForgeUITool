export const ErrorCodes = {
  E_SCHEMA_001: "E_SCHEMA_001",
  E_SEM_001: "E_SEM_001",
  E_VER_001: "E_VER_001",
  E_PLAT_001: "E_PLAT_001",
  E_SDK_001: "E_SDK_001",
  E_GEN_001: "E_GEN_001",
  E_PREV_001: "E_PREV_001",
  E_PACK_NOT_IMPL: "E_PACK_NOT_IMPL",
  E_PREVIEW_WASM_NOT_IMPL: "E_PREVIEW_WASM_NOT_IMPL",
  E_IMPORT_NOT_IMPL: "E_IMPORT_NOT_IMPL",
  E_LOADER_VER: "E_LOADER_VER",
  E_LOADER_RES: "E_LOADER_RES",
  E_LOADER_FMT: "E_LOADER_FMT",
  E_MCP_NOT_IMPL: "E_MCP_NOT_IMPL",
  E_MCP_WORKSPACE: "E_MCP_WORKSPACE",
  E_MCP_ARGS: "E_MCP_ARGS",
  E_MCP_BRIDGE: "E_MCP_BRIDGE",
  E_IO_001: "E_IO_001",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type DiagnosticLevel = "error" | "warning" | "info";

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  path?: string;
}

export interface ValidateResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export const SUPPORTED_LVGL_VERSIONS = ["9.10"] as const;
export type SupportedLvglVersion = (typeof SUPPORTED_LVGL_VERSIONS)[number];

export const SUPPORTED_PLATFORMS = ["qm10xd", "qm10xv", "qm10xh"] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const MVP_PLATFORM: SupportedPlatform = "qm10xd";
export const DEFAULT_LVGL_VERSION: SupportedLvglVersion = "9.10";
export const DEFAULT_DELIVERY_MODE = "both" as const;
export const DEFAULT_ENTRY_SYMBOL = "ui_init";

export const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class ForgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = "ForgeError";
  }
}

export { softCleanPreviewBuildOut } from "./preview-build.js";
