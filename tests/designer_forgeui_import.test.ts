import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer .forgeui import (Loop#9)", () => {
  it("IPC project:importForgeui is wired in main and preload", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"project:importForgeui"');
    expect(main).toContain("unbundleProject");
    expect(main).toContain("packages/importers/dist/index.js");
    expect(preload).toContain("importForgeui");
  });

  it("project store exposes importForgeui", () => {
    const store = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/project.ts"), "utf8");
    expect(store).toContain("async function importForgeui");
    expect(store).toContain("desktop().importForgeui");
    expect(store).toContain("importForgeui,");
  });

  it("HomeView and WorkspaceGate offer import entry points", () => {
    const home = fs.readFileSync(path.join(repoRoot, "apps/designer/src/views/HomeView.vue"), "utf8");
    const gate = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/WorkspaceGate.vue"), "utf8");
    expect(home).toContain("importBundle");
    expect(home).toContain("导入 .forgeui");
    expect(gate).toContain("importBundle");
    expect(gate).toContain("导入 .forgeui");
    expect(gate).not.toContain("forgeui unbundle");
  });
});
