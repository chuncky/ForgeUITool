import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("workspace toolbar icons (FR-010f)", () => {
  it("ToolbarButton component exists with icon+label and icon-only modes", () => {
    const btn = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/ToolbarButton.vue"),
      "utf8",
    );
    expect(btn).toContain("ToolbarIcon");
    expect(btn).toContain("icon-only");
    expect(btn).toContain("tb-btn");
    expect(btn).toContain("tb-label");
  });

  it("toolbar icon map covers all workspace items", () => {
    const icons = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/icons/toolbar.ts"),
      "utf8",
    );
    for (const id of [
      "folder-open",
      "settings",
      "widgets",
      "palette",
      "assets",
      "undo",
      "redo",
      "save",
      "history",
      "code",
      "ai",
      "c-lang",
      "delivery",
    ]) {
      expect(icons).toContain(`"${id}"`);
    }
  });

  it("WorkspaceToolbar uses ToolbarButton with icon-only undo/redo", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("ToolbarButton");
    expect(toolbar).toContain('icon="undo"');
    expect(toolbar).toContain('icon="redo"');
    expect(toolbar).toContain("icon-only");
    expect(toolbar).toContain("撤回 (Ctrl+Z)");
    expect(toolbar).toContain("重做 (Ctrl+Y)");
    expect(toolbar).not.toMatch(/label="撤回"/);
    expect(toolbar).not.toMatch(/label="重做"/);
    expect(toolbar).not.toMatch(/>撤回</);
    expect(toolbar).not.toMatch(/>重做</);
  });

  it("WorkspaceToolbar shows icon+label for main actions", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain('label="项目设置"');
    expect(toolbar).toContain('label="控件库"');
    expect(toolbar).toContain(':disabled="!store.loaded || !store.dirty"');
    expect(toolbar).toContain(':disabled="!store.canUndo"');
    expect(toolbar).toContain(':disabled="!store.canRedo"');
  });
});
