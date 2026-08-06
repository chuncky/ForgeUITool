import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("align FR-013b UI", () => {
  it("PageTreePanel widget menu has six align actions", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/PageTreePanel.vue"),
      "utf8",
    );
    for (const a of ["align-left", "align-center-h", "align-right", "align-top", "align-center-v", "align-bottom"]) {
      expect(src).toContain(a);
    }
  });

  it("project store exposes multi-select and alignSelection", () => {
    const store = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/stores/project.ts"),
      "utf8",
    );
    expect(store).toContain("selectedIds");
    expect(store).toContain("alignSelection");
    expect(store).toContain("additive");
  });
});
