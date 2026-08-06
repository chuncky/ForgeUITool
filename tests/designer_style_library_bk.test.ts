/**
 * BK-aligned style library (FR-018): SaveStyleDialog + StyleLibraryDialog wiring.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { styleThemePreviewChrome, formatStyleCreatedAt } from "../apps/designer/src/utils/style-theme-preview";

const root = join(__dirname, "..");

describe("style library (BK)", () => {
  it("preview chrome maps bg/text/radius", () => {
    const s = styleThemePreviewChrome({
      bg_color: "#2d75b9ff",
      text_color: "#ffffffff",
      radius: 5,
      border_width: 0,
    });
    expect(s.background).toMatch(/#2d75b9/i);
    expect(s.color).toMatch(/#fff/i);
    expect(s.borderRadius).toBe("5px");
  });

  it("formatStyleCreatedAt produces locale string", () => {
    const s = formatStyleCreatedAt("2026-08-05T09:31:00.000Z");
    expect(s.length).toBeGreaterThan(0);
  });

  it("StyleGroup opens Save / Library dialogs (no window.prompt)", () => {
    const src = readFileSync(join(root, "apps/designer/src/components/prop-panel/StyleGroup.vue"), "utf8");
    expect(src).toContain("openSaveStyle");
    expect(src).toContain("openStyleLibrary");
    expect(src).toMatch(/title="打开样式库"/);
    expect(src).toMatch(/>\s*样式库\s*</);
    expect(src).not.toContain("window.prompt");
  });

  it("SaveStyleDialog + StyleLibraryDialog mounted and BK fields present", () => {
    const workbench = readFileSync(join(root, "apps/designer/src/components/DesignerWorkbench.vue"), "utf8");
    expect(workbench).toContain("SaveStyleDialog");
    expect(workbench).toContain("StyleLibraryDialog");

    const save = readFileSync(join(root, "apps/designer/src/components/SaveStyleDialog.vue"), "utf8");
    expect(save).toContain("样式名称");
    expect(save).toContain("样式描述");
    expect(save).toContain("样式图标");
    expect(save).toContain("maxlength=\"50\"");
    expect(save).toContain("maxlength=\"200\"");

    const lib = readFileSync(join(root, "apps/designer/src/components/StyleLibraryDialog.vue"), "utf8");
    expect(lib).toContain("样式库");
    expect(lib).toContain("应用");
    expect(lib).toContain("删除");
    expect(lib).toContain("创建于");
    expect(lib).toContain("deleteStyleTheme");
    expect(lib).toContain("applyStyleTheme");
  });

  it("SaveStyleDialog / store persist keys covered by schema contract", () => {
    const store = readFileSync(join(root, "apps/designer/src/stores/project.ts"), "utf8");
    expect(store).toContain("createdAt:");
    expect(store).toContain("widgetType:");
    expect(store).toContain("description");
    // Cross-link: schema contract test owns the full key list
    const contract = readFileSync(join(root, "tests/schema_themes_style_library.test.ts"), "utf8");
    expect(contract).toContain("NAMED_STYLE_THEME_SCHEMA_KEYS");
    expect(contract).toContain('"createdAt"');
    expect(contract).toContain('"widgetType"');
    expect(contract).toContain('"description"');
  });
});
