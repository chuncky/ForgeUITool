import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("FR-016c style bg_image asset picker", () => {
  it("wires StyleGroup imageSrc through openAssetsForImagePick", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const style = fs.readFileSync(
      path.join(root, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    const fields = fs.readFileSync(path.join(root, "apps/designer/src/utils/style-fields.ts"), "utf8");
    const ui = fs.readFileSync(path.join(root, "apps/designer/src/stores/ui.ts"), "utf8");

    expect(fields).toContain('key: "bg_image"');
    expect(fields).toContain('type: "imageSrc"');
    expect(ui).toContain("openAssetsForImagePick");
    expect(style).toContain("sf.type === 'imageSrc'");
    expect(style).toContain("pickImage");
    expect(style).toContain("openAssetsForImagePick");
    expect(style).toContain("imageOptions");
    expect(style).toContain("从资源管理选择图片");
    // Must not be a bare text-only imageSrc branch without picker
    expect(style).toContain("image-row");
  });
});
