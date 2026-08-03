import type { Diagnostic } from "@forgeui/shared";

export interface MutationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  projectRoot?: string;
}

/** AR-030～031 importer extension point */
export interface Importer {
  id: string;
  canHandle(file: string): boolean;
  import(file: string, destRoot: string): Promise<MutationResult>;
}
