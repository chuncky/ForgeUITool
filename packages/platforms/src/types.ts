import type { ProjectDocument } from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";

export interface CopyResult {
  ok: boolean;
  copiedFiles: string[];
  targetDir: string;
  diagnostics: Diagnostic[];
}

export interface GlobalConfig {
  /** Optional SDK path hints keyed by delivery adapter id (e.g. qm10xd) */
  sdkPaths?: Partial<Record<string, string>>;
}

export interface PlatformPlugin {
  id: string;
  displayName: string;
  defaultSdkPathHints(): string[];
  resolveSdkPath(project: ProjectDocument, globalCfg?: GlobalConfig): string | null;
  copyGenerated(
    projectRoot: string,
    sdkPath: string,
    opts?: { force?: boolean },
  ): Promise<CopyResult>;
  helloDocPath(): string;
  boardTemplateDir(): string;
}
