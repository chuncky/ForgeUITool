import { ForgeError, ErrorCodes } from "@forgeui/shared";
import type { GlobalConfig } from "./types.js";
import { qm10xdPlugin, qm10xvPlugin, qm10xhPlugin } from "./qm10x.js";
import type { PlatformPlugin } from "./types.js";
import { openProject } from "@forgeui/core";
import type { CopyResult } from "./types.js";

const registry: PlatformPlugin[] = [qm10xdPlugin, qm10xvPlugin, qm10xhPlugin];

export function getPlatformPlugin(id: string): PlatformPlugin {
  const p = registry.find((x) => x.id === id);
  if (!p) throw new ForgeError(ErrorCodes.E_PLAT_001, `Unknown platform: ${id}`);
  return p;
}

export function listPlatformPlugins(): PlatformPlugin[] {
  return [...registry];
}

export async function exportToSdk(
  projectRoot: string,
  opts: { force?: boolean; sdkPath?: string; globalCfg?: GlobalConfig; adapterId?: string } = {},
): Promise<CopyResult> {
  const loaded = openProject(projectRoot);
  // D-08: adapter id is delivery hint only; default first registered adapter for path hints
  const adapterId = opts.adapterId ?? loaded.project.platform ?? listPlatformPlugins()[0]?.id ?? "qm10xd";
  const plugin = getPlatformPlugin(adapterId);
  const sdkPath = opts.sdkPath ?? plugin.resolveSdkPath(loaded.project, opts.globalCfg);
  if (!sdkPath) {
    return {
      ok: false,
      copiedFiles: [],
      targetDir: "",
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_SDK_001,
          message: `SDK path not configured. Set project.sdk.path, env hint for ${plugin.id}, or pass --sdk <path>`,
        },
      ],
    };
  }
  return plugin.copyGenerated(projectRoot, sdkPath, { force: opts.force });
}
