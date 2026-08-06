import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("designer i18n + animation UI (FR-042/043/071)", () => {
  it("ships I18nDialog and AnimationTimelineDialog wired into workbench/toolbar", () => {
    const workbench = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(workbench).toContain("I18nDialog");
    expect(workbench).toContain("AnimationTimelineDialog");
    expect(toolbar).toContain("showI18n");
    expect(toolbar).toContain("showAnimations");
    expect(toolbar).toContain("previewLocale");
    expect(toolbar).toContain("onPreviewLocale");
    expect(
      fs.existsSync(path.join(repoRoot, "apps/designer/src/utils/i18n-display.ts")),
    ).toBe(true);
    expect(main).toContain("project:exportXliff");
    expect(main).toContain("project:importXliff");
    expect(main).toContain("project:seedI18n");
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/I18nDialog.vue"))).toBe(true);
    expect(
      fs.existsSync(path.join(repoRoot, "apps/designer/src/components/AnimationTimelineDialog.vue")),
    ).toBe(true);
  });
});
