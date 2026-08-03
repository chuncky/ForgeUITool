import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openProject, resolveCodegenPaths, type ProjectDocument } from "@forgeui/core";
import { ErrorCodes, ForgeError, type Diagnostic } from "@forgeui/shared";
import type { CopyResult, GlobalConfig, PlatformPlugin } from "./types.js";

function copyDirContents(src: string, dest: string, out: string[]): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirContents(from, to, out);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      out.push(to);
    }
  }
}

function resolveBoardDir(id: string): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../../templates/boards/${id}`),
    path.resolve(process.cwd(), `templates/boards/${id}`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new ForgeError(ErrorCodes.E_PLAT_001, `board template missing: ${id}`);
}

export class Qm10xdPlatformPlugin implements PlatformPlugin {
  readonly id = "qm10xd" as const;
  readonly displayName = "qm10xd";

  defaultSdkPathHints(): string[] {
    return [
      process.env.FORGEUI_QM10XD_SDK ?? "",
      "C:/qm10x/sdk/qm10xd",
      "/opt/qm10x/sdk/qm10xd",
    ].filter(Boolean);
  }

  resolveSdkPath(project: ProjectDocument, globalCfg?: GlobalConfig): string | null {
    if (project.sdk?.path) return path.resolve(project.sdk.path);
    if (globalCfg?.sdkPaths?.qm10xd) return path.resolve(globalCfg.sdkPaths.qm10xd);
    if (process.env.FORGEUI_QM10XD_SDK) return path.resolve(process.env.FORGEUI_QM10XD_SDK);
    return null;
  }

  helloDocPath(): string {
    return path.join(this.boardTemplateDir(), "HELLO.md");
  }

  boardTemplateDir(): string {
    return resolveBoardDir("qm10xd");
  }

  async copyGenerated(
    projectRoot: string,
    sdkPath: string,
    opts: { force?: boolean } = {},
  ): Promise<CopyResult> {
    const diagnostics: Diagnostic[] = [];
    const loaded = openProject(projectRoot);
    const paths = resolveCodegenPaths(loaded.root, loaded.project);
    const rel = loaded.project.sdk?.copyTargetRel || "ui";
    const targetDir = path.join(path.resolve(sdkPath), rel);
    const sdkCodegenDir = path.join(targetDir, paths.codegenDir);

    if (!fs.existsSync(sdkPath)) {
      return {
        ok: false,
        copiedFiles: [],
        targetDir,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_SDK_001,
            message: `SDK path does not exist: ${sdkPath}`,
            path: sdkPath,
          },
        ],
      };
    }

    if (!fs.existsSync(paths.codegenAbs)) {
      return {
        ok: false,
        copiedFiles: [],
        targetDir,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_GEN_001,
            message: `${paths.codegenDir}/ missing; run forgeui generate first`,
            path: paths.codegenAbs,
          },
        ],
      };
    }

    if (!fs.existsSync(path.join(paths.codegenAbs, "forgeui_generated.cmake"))) {
      return {
        ok: false,
        copiedFiles: [],
        targetDir,
        diagnostics: [
          {
            level: "error",
            code: ErrorCodes.E_GEN_001,
            message: `forgeui_generated.cmake missing; run forgeui generate first`,
            path: paths.codegenAbs,
          },
        ],
      };
    }

    if (fs.existsSync(targetDir) && !opts.force) {
      const existing = fs.readdirSync(targetDir);
      if (existing.length > 0) {
        return {
          ok: false,
          copiedFiles: [],
          targetDir,
          diagnostics: [
            {
              level: "error",
              code: ErrorCodes.E_SDK_001,
              message: `Target ${targetDir} is not empty; pass --force to overwrite generated copy`,
              path: targetDir,
            },
          ],
        };
      }
    }

    if (opts.force && fs.existsSync(sdkCodegenDir)) {
      fs.rmSync(sdkCodegenDir, { recursive: true, force: true });
    }

    const copiedFiles: string[] = [];
    copyDirContents(paths.codegenAbs, sdkCodegenDir, copiedFiles);

    const note = path.join(targetDir, "FORGEUI_INTEGRATION.md");
    fs.copyFileSync(this.helloDocPath(), note);
    copiedFiles.push(note);

    diagnostics.push({
      level: "info",
      code: "E_SDK_COPIED",
      message: `Copied ${copiedFiles.length} files to ${sdkCodegenDir}. SDK CMake: include(.../${paths.codegenDir}/forgeui_generated.cmake)`,
      path: sdkCodegenDir,
    });

    return { ok: true, copiedFiles, targetDir: sdkCodegenDir, diagnostics };
  }
}

/** V1 stubs — registered but copyGenerated throws until implemented */
class StubPlatformPlugin implements PlatformPlugin {
  constructor(
    readonly id: "qm10xv" | "qm10xh",
    readonly displayName: string,
  ) {}
  defaultSdkPathHints(): string[] {
    return [];
  }
  resolveSdkPath(): string | null {
    return null;
  }
  helloDocPath(): string {
    return "";
  }
  boardTemplateDir(): string {
    return "";
  }
  async copyGenerated(): Promise<CopyResult> {
    throw new ForgeError(
      ErrorCodes.E_PLAT_001,
      `Platform ${this.id} export-sdk is planned for V1 (MVP = qm10xd)`,
    );
  }
}

const registry: PlatformPlugin[] = [
  new Qm10xdPlatformPlugin(),
  new StubPlatformPlugin("qm10xv", "qm10xv"),
  new StubPlatformPlugin("qm10xh", "qm10xh"),
];

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
  opts: { force?: boolean; sdkPath?: string; globalCfg?: GlobalConfig } = {},
): Promise<CopyResult> {
  const loaded = openProject(projectRoot);
  const plugin = getPlatformPlugin(loaded.project.platform);
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
          message:
            "SDK path not configured. Set project.sdk.path, FORGEUI_QM10XD_SDK, or pass --sdk <path>",
        },
      ],
    };
  }
  return plugin.copyGenerated(projectRoot, sdkPath, { force: opts.force });
}
