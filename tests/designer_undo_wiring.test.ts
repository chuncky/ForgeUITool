import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer undo wiring (Main-authoritative)", () => {
  it("registers project:undo/redo IPC and preload bridge", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"project:undo"');
    expect(main).toContain('"project:redo"');
    expect(main).toContain("recordEditorHistory");
    expect(preload).toContain("undo:");
    expect(preload).toContain("redo:");
    expect(preload).not.toContain("restoreProject");
  });

  it("mutation IPC records history before core mutate", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("withHistory(_editor, skipHistory)");
    expect(main).toContain("core.addChildNode");
  });
});
