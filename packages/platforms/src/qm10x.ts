import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openProject, resolveCodegenPaths, type ProjectDocument } from "@forgeui/core";
import { ErrorCodes, ForgeError, type Diagnostic } from "@forgeui/shared";
import type { CopyResult, GlobalConfig, PlatformPlugin } from "./types.js";

export type Qm10xPlatformId = "qm10xd" | "qm10xv" | "qm10xh";

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

const SDK_HINTS: Record<Qm10xPlatformId, string[]> = {
  qm10xd: ["C:/qm10x/sdk/qm10xd", "/opt/qm10x/sdk/qm10xd"],
  qm10xv: ["C:/qm10x/sdk/qm10xv", "/opt/qm10x/sdk/qm10xv"],
  qm10xh: ["C:/qm10x/sdk/qm10xh", "/opt/qm10x/sdk/qm10xh"],
};

const ENV_VARS: Record<Qm10xPlatformId, string> = {
  qm10xd: "FORGEUI_QM10XD_SDK",
  qm10xv: "FORGEUI_QM10XV_SDK",
  qm10xh: "FORGEUI_QM10XH_SDK",
};

/** Shared qm10x family export-sdk behavior (FR-007). */
export class Qm10xPlatformPlugin implements PlatformPlugin {
  readonly id: Qm10xPlatformId;
  readonly displayName: string;

  constructor(id: Qm10xPlatformId) {
    this.id = id;
    this.displayName = id;
  }

  defaultSdkPathHints(): string[] {
    const env = process.env[ENV_VARS[this.id]] ?? "";
    return [env, ...SDK_HINTS[this.id]].filter(Boolean);
  }

  resolveSdkPath(project: ProjectDocument, globalCfg?: GlobalConfig): string | null {
    if (project.sdk?.path) return path.resolve(project.sdk.path);
    const fromCfg = globalCfg?.sdkPaths?.[this.id];
    if (fromCfg) return path.resolve(fromCfg);
    const fromEnv = process.env[ENV_VARS[this.id]];
    if (fromEnv) return path.resolve(fromEnv);
    return null;
  }

  helloDocPath(): string {
    return path.join(this.boardTemplateDir(), "HELLO.md");
  }

  boardTemplateDir(): string {
    return resolveBoardDir(this.id);
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
      message: `Copied ${copiedFiles.length} files to ${sdkCodegenDir} (${this.id}). SDK CMake: include(.../${paths.codegenDir}/forgeui_generated.cmake)`,
      path: sdkCodegenDir,
    });

    return { ok: true, copiedFiles, targetDir: sdkCodegenDir, diagnostics };
  }
}

export const qm10xdPlugin = new Qm10xPlatformPlugin("qm10xd");
export const qm10xvPlugin = new Qm10xPlatformPlugin("qm10xv");
export const qm10xhPlugin = new Qm10xPlatformPlugin("qm10xh");

/** @deprecated use qm10xdPlugin */
export class Qm10xdPlatformPlugin extends Qm10xPlatformPlugin {
  constructor() {
    super("qm10xd");
  }
}

export function resolveBoardTemplateDir(id: Qm10xPlatformId): string {
  return resolveBoardDir(id);
}
