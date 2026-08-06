import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("color library FR-018", () => {
  it("ColorLibraryDialog component exists", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ColorLibraryDialog.vue"),
      "utf8",
    );
    expect(src).toContain("颜色库");
    expect(src).toContain("命名色");
    expect(src).not.toContain("样式主题");
  });

  it("WorkspaceToolbar enables color library when project loaded", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("colorLibrary");
    expect(toolbar).toContain("showColorLibrary");
    expect(toolbar).toContain("颜色库 FR-018");
  });

  it("StyleGroup has save/apply theme actions and color library pick", () => {
    const style = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    expect(style).toContain("saveTheme");
    expect(style).toContain("applyTheme");
    expect(style).toContain("openColorsForPick");
    expect(style).toContain("@colorId");
  });

  it("project store exposes colorLibrary and theme helpers", () => {
    const store = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/stores/project.ts"),
      "utf8",
    );
    expect(store).toContain("colorLibrary");
    expect(store).toContain("setColorLibrary");
    expect(store).toContain("saveStyleTheme");
    expect(store).toContain("deleteStyleTheme");
  });
});
