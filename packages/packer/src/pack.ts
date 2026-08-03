import fs from "node:fs";
import path from "node:path";
import { openProject } from "@forgeui/core";
import { Diagnostic, ErrorCodes } from "@forgeui/shared";

export interface PackOptions {
  outDir?: string;
}

export interface PackResult {
  ok: boolean;
  /** true when only a skeleton package was written (A2 full pack = V1) */
  skeleton: boolean;
  outDir: string;
  diagnostics: Diagnostic[];
}

/**
 * Packer boundary (AR-012).
 * MVP: for deliveryMode both|dynamic_ui write a versioned skeleton under packageDir.
 * Full binary UI pack + Loader consume = V1 (AC-010～012).
 */
export async function packProject(projectRoot: string, opts: PackOptions = {}): Promise<PackResult> {
  const diagnostics: Diagnostic[] = [];
  const loaded = openProject(projectRoot);
  const mode = loaded.project.deliveryMode;
  const packageRel = loaded.project.export?.packageDir ?? "packages/latest";
  const outDir = path.resolve(opts.outDir ?? path.join(loaded.root, packageRel));

  if (mode === "static_c") {
    diagnostics.push({
      level: "info",
      code: "E_PACK_SKIPPED",
      message: "deliveryMode=static_c; pack skipped (A1-only). Set both|dynamic_ui to emit package skeleton.",
    });
    return { ok: true, skeleton: false, outDir, diagnostics };
  }

  fs.mkdirSync(outDir, { recursive: true });
  const manifest = {
    format: "forgeui-package",
    formatVersion: 1,
    name: loaded.project.name,
    platform: loaded.project.platform,
    lvglVersion: loaded.project.lvglVersion,
    display: loaded.project.display,
    entrySymbol: loaded.project.entrySymbol,
    defaultScreen: loaded.project.defaultScreen,
    screens: loaded.project.screens.map((s) => s.id),
    note: "Skeleton package for A2 path; full Packer/Loader fill lands in V1.",
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(outDir, "README.md"),
    `# ForgeUI package skeleton\n\nGenerated for deliveryMode=${mode}.\nLoader full consume is V1 (AR-012).\n`,
    "utf8",
  );
  // Placeholder payload — not a runtime UI blob yet
  fs.writeFileSync(path.join(outDir, "ui.stub"), "FORGEUI_PACKAGE_STUB_V0\n", "utf8");

  diagnostics.push({
    level: "warning",
    code: ErrorCodes.E_PACK_NOT_IMPL,
    message: `Wrote A2 package skeleton to ${outDir} (full binary pack = V1)`,
    path: outDir,
  });

  return { ok: true, skeleton: true, outDir, diagnostics };
}
