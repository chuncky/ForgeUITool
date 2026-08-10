import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("designer i18n + animation UI (FR-042/043/071)", () => {
  it("ships i18n inside AssetsDialog and AnimationTimelineDialog in workbench/toolbar", () => {
    const workbench = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    const assets = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/AssetsDialog.vue"),
      "utf8",
    );
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(workbench).toContain("AssetsDialog");
    expect(workbench).toContain("AnimationTimelineDialog");
    expect(assets).toContain("I18nPanel");
    expect(assets).toContain("mainTab === 'i18n'");
    expect(toolbar).toContain("openAssets()");
    expect(toolbar).toContain("showAnimations");
    expect(toolbar).toContain("previewLocale");
    expect(toolbar).toContain("onPreviewLocale");
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/utils/i18n-display.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/I18nPanel.vue"))).toBe(
      true,
    );
    expect(main).toContain("project:exportXliff");
    expect(main).toContain("project:importXliff");
    expect(main).toContain("project:seedI18n");
    expect(
      fs.existsSync(path.join(repoRoot, "apps/designer/src/components/AnimationTimelineDialog.vue")),
    ).toBe(true);
  });
});
