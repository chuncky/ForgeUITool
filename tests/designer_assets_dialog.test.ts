import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("assets dialog V1.30 (BK 资源管理)", () => {
  it("AssetsDialog has images|fonts|i18n tabs and delete/prune actions", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/AssetsDialog.vue"),
      "utf8",
    );
    expect(src).toContain("资源管理");
    expect(src).toContain("mainTab === 'images'");
    expect(src).toContain("mainTab === 'fonts'");
    expect(src).toContain("mainTab === 'i18n'");
    expect(src).toMatch(/^\s*图片\s*$/m);
    expect(src).toMatch(/^\s*字体\s*$/m);
    expect(src).toMatch(/^\s*多语言\s*$/m);
    expect(src).toContain("I18nPanel");
    expect(src).toContain("deleteSelectedImage");
    expect(src).toContain("deleteSelectedFont");
    expect(src).toContain("pruneOrphans");
    expect(src).toContain("resolveProjectAssetDataUrl");
  });

  it("I18nPanel is embedded; toolbar opens assets not standalone i18n", () => {
    expect(fs.existsSync(path.join(repoRoot, "apps/designer/src/components/I18nPanel.vue"))).toBe(
      true,
    );
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("openAssets()");
    expect(toolbar).not.toContain("showI18n = true");
    expect(toolbar).toContain("previewLocale");
    const ui = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/ui.ts"), "utf8");
    expect(ui).toContain("assetsMainTab");
    expect(ui).toContain("openI18n");
  });

  it("IPC/preload/store expose deleteImage deleteFont pruneOrphanImages", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    const store = fs.readFileSync(path.join(repoRoot, "apps/designer/src/stores/project.ts"), "utf8");
    expect(main).toContain("project:deleteImage");
    expect(main).toContain("project:deleteFont");
    expect(main).toContain("project:pruneOrphanImages");
    expect(preload).toContain("deleteImage");
    expect(preload).toContain("deleteFont");
    expect(preload).toContain("pruneOrphanImages");
    expect(store).toContain("deleteImage");
    expect(store).toContain("deleteFont");
    expect(store).toContain("pruneOrphanImages");
  });

  it("BottomAuxPanel opens assets tabs", () => {
    const aux = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/BottomAuxPanel.vue"),
      "utf8",
    );
    expect(aux).toContain("openAssets()");
    expect(aux).toContain("openAssets('i18n')");
  });
});
