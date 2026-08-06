import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPreviewHost, compareSdlWasmDualRun } from "@forgeui/preview-host";
import { generate } from "@forgeui/codegen";
import { openProject, saveProject } from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("FR-065 Wasm IR ↔ CodeGen dual-run (AC-008)", () => {
  it("hello-dual-screen IR screens match project + codegen", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-dual-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    loaded.project.previewBackend = "wasm";
    saveProject(loaded);

    const gen = await generate(tmp);
    expect(gen.ok).toBe(true);

    const host = createPreviewHost();
    const result = await host.run(tmp, { backend: "wasm", prepareOnly: true, skipGenerate: true });
    expect(result.ok).toBe(true);
    const buildDir = result.session!.buildDir;

    const report = compareSdlWasmDualRun(tmp, buildDir);
    expect(report.mismatches, report.mismatches.join("; ")).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.irScreenIds.length).toBeGreaterThanOrEqual(2);
    expect(report.codegenScreenIds).toEqual(report.projectScreenIds);
    for (const row of report.nodeCounts) {
      expect(row.ir).toBe(row.project);
      expect(row.ir).toBeGreaterThan(0);
    }
  });
});
