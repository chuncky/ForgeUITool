import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("loader C reference + font import wiring", () => {
  it("forge_loader.h declares open/check/apply API", () => {
    const h = fs.readFileSync(path.join(repoRoot, "packages/loader/c/include/forge_loader.h"), "utf8");
    expect(h).toContain("forge_loader_open_file");
    expect(h).toContain("E_LOADER_FMT");
  });

  it("forge_loader.c validates A2 package layout", () => {
    const c = fs.readFileSync(path.join(repoRoot, "packages/loader/c/src/forge_loader.c"), "utf8");
    expect(c).toContain("validate_package_layout");
    expect(c).toContain("assets/manifest.json");
    expect(c).toContain("E_LOADER_RES");
    expect(c).toContain("E_LOADER_VER");
    expect(c).toContain("forge_loader_apply");
    expect(c).toContain("ui_nav_load_screen");
    expect(c).not.toMatch(/forge_loader_apply[\s\S]*E_LOADER_NOT_IMPL/);
  });

  it("AC-005 board bringup checklist doc exists", () => {
    const md = fs.readFileSync(path.join(repoRoot, "docs/AC-005_BOARD_BRINGUP.md"), "utf8");
    expect(md).toContain("qm10xd");
    expect(md).toContain("forge_loader_open_file");
  });

  it("designer imports fonts via IPC", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"project:importFonts"');
    expect(preload).toContain("importFonts");
  });
});
