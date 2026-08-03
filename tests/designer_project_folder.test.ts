import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("project name button (FR-010e)", () => {
  it("WorkspaceToolbar project name opens folder", () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain('icon="folder-open"');
    expect(toolbar).toContain("revealProjectFolder");
    expect(toolbar).toContain("打开项目文件夹");
  });

  it("shell:openProjectFolder IPC is wired", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"shell:openProjectFolder"');
    expect(main).toContain("shell.openPath");
    expect(preload).toContain("openProjectFolder");
  });
});
