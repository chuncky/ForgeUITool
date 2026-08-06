import fs from "node:fs";
import path from "node:path";
import type { ProjectDocument } from "./types.js";

export const DEFAULT_CODEGEN_DIR = "forgeui_generated";
export const DEFAULT_CUSTOM_SUBDIR = "custom";

export interface CodegenPaths {
  codegenDir: string;
  customSubdir: string;
  codegenAbs: string;
  customAbs: string;
}

export function resolveExportFields(project: ProjectDocument): {
  codegenDir: string;
  customSubdir: string;
} {
  const exp = project.export ?? {};
  if (exp.codegenDir) {
    return {
      codegenDir: exp.codegenDir,
      customSubdir: exp.customSubdir ?? DEFAULT_CUSTOM_SUBDIR,
    };
  }
  if (exp.generatedDir && exp.generatedDir !== DEFAULT_CODEGEN_DIR) {
    return {
      codegenDir: exp.generatedDir,
      customSubdir: exp.userDir ?? DEFAULT_CUSTOM_SUBDIR,
    };
  }
  return {
    codegenDir: DEFAULT_CODEGEN_DIR,
    customSubdir: DEFAULT_CUSTOM_SUBDIR,
  };
}

export function resolveCodegenPaths(projectRoot: string, project: ProjectDocument): CodegenPaths {
  const { codegenDir, customSubdir } = resolveExportFields(project);
  const root = path.resolve(projectRoot);
  return {
    codegenDir,
    customSubdir,
    codegenAbs: path.join(root, codegenDir),
    customAbs: path.join(root, codegenDir, customSubdir),
  };
}

export function normalizeExportFields(project: ProjectDocument): void {
  const prev = project.export ?? {};
  project.export = {
    imageMode: prev.imageMode ?? "c_array",
    lvglInclude: prev.lvglInclude ?? "lvgl/lvgl.h",
    codegenDir: DEFAULT_CODEGEN_DIR,
    customSubdir: DEFAULT_CUSTOM_SUBDIR,
    packageDir: prev.packageDir ?? "packages/latest",
    eventStubStyle: prev.eventStubStyle ?? "custom",
    micropython: prev.micropython ?? false,
  };
}

export function needsLegacyCodegenMigration(projectRoot: string, project: ProjectDocument): boolean {
  if (project.export?.codegenDir === DEFAULT_CODEGEN_DIR) {
    const newRoot = path.join(path.resolve(projectRoot), DEFAULT_CODEGEN_DIR);
    return !fs.existsSync(newRoot) && fs.existsSync(path.join(path.resolve(projectRoot), "generated"));
  }
  if (project.export?.codegenDir) return false;
  const root = path.resolve(projectRoot);
  const newRoot = path.join(root, DEFAULT_CODEGEN_DIR);
  if (fs.existsSync(newRoot)) return false;
  return fs.existsSync(path.join(root, "generated")) || fs.existsSync(path.join(root, "user"));
}

/** Move legacy `generated/` + `user/` into `forgeui_generated/` + `custom/`. */
export function migrateLegacyCodegenLayout(projectRoot: string, project: ProjectDocument): boolean {
  const root = path.resolve(projectRoot);
  const legacyGen = path.join(root, "generated");
  const legacyUser = path.join(root, "user");
  const codegenAbs = path.join(root, DEFAULT_CODEGEN_DIR);
  const customAbs = path.join(codegenAbs, DEFAULT_CUSTOM_SUBDIR);

  if (!needsLegacyCodegenMigration(root, project)) {
    normalizeExportFields(project);
    return false;
  }

  fs.mkdirSync(codegenAbs, { recursive: true });

  if (fs.existsSync(legacyGen)) {
    for (const entry of fs.readdirSync(legacyGen)) {
      fs.renameSync(path.join(legacyGen, entry), path.join(codegenAbs, entry));
    }
    fs.rmdirSync(legacyGen);
  }

  if (fs.existsSync(legacyUser)) {
    fs.mkdirSync(customAbs, { recursive: true });
    for (const entry of fs.readdirSync(legacyUser)) {
      fs.renameSync(path.join(legacyUser, entry), path.join(customAbs, entry));
    }
    fs.rmdirSync(legacyUser);
  }

  normalizeExportFields(project);
  return true;
}

/** True when cmake include + main ui.c exist (safe to compile preview). */
export function codegenArtifactsReady(projectRoot: string, project: ProjectDocument): boolean {
  const paths = resolveCodegenPaths(projectRoot, project);
  return (
    fs.existsSync(path.join(paths.codegenAbs, "forgeui_generated.cmake")) &&
    fs.existsSync(path.join(paths.codegenAbs, "ui.c"))
  );
}

/** Delete tool-generated files under codegen root; never removes `custom/`. */
export function cleanCodegenExceptCustom(codegenAbs: string, customSubdir: string): void {
  if (!fs.existsSync(codegenAbs)) return;
  for (const entry of fs.readdirSync(codegenAbs)) {
    if (entry === customSubdir) continue;
    fs.rmSync(path.join(codegenAbs, entry), { recursive: true, force: true });
  }
}
