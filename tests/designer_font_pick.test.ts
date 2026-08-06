import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("V1-B text_font asset picker", () => {
  it("wires font pick through ui store, AssetsDialog, StyleGroup", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const ui = fs.readFileSync(path.join(root, "apps/designer/src/stores/ui.ts"), "utf8");
    const assets = fs.readFileSync(path.join(root, "apps/designer/src/components/AssetsDialog.vue"), "utf8");
    const style = fs.readFileSync(
      path.join(root, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    expect(ui).toContain("openAssetsForFontPick");
    expect(ui).toContain("pickFontAsset");
    expect(assets).toContain("fontPickHandler");
    expect(assets).toContain("onPickFont");
    expect(style).toContain("pickFont");
    expect(style).toContain("fontOptions");
    expect(style).toContain("@${fontId}");
  });
});
