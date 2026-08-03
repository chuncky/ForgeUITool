import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("delivery menu (FR-010d)", () => {
  it("WorkspaceToolbar has 交付 menu separate from C language", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("交付 ▾");
    expect(toolbar).toContain("导出到 SDK");
    expect(toolbar).toContain("打包 UI 包");
    expect(toolbar).toContain("deliveryMenuOpen");
    expect(toolbar).toContain("static_c");
    // C menu block should not contain delivery actions
    const cMenuBlock = toolbar.slice(toolbar.indexOf("C语言"), toolbar.indexOf("交付"));
    expect(cMenuBlock).not.toContain("导出到 SDK");
    expect(cMenuBlock).not.toContain("打包 UI 包");
  });

  it("ui store exposes deliveryMenuOpen", () => {
    const ui = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/ui.ts"), "utf8");
    expect(ui).toContain("deliveryMenuOpen");
  });

  it("ProjectSettingsDialog has delivery secondary actions", () => {
    const dialog = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ProjectSettingsDialog.vue"),
      "utf8",
    );
    expect(dialog).toContain("交付");
    expect(dialog).toContain("导出到 SDK");
    expect(dialog).toContain("打包 UI 包");
    expect(dialog).toContain("static_c");
  });

  it("project store blocks pack when deliveryMode is static_c", () => {
    const store = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/project.ts"), "utf8");
    expect(store).toContain('deliveryMode === "static_c"');
    expect(store).toMatch(/async function exportSdk\(/);
    expect(store).toMatch(/async function pack\(/);
  });
});
