import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getWidgetSpec } from "@forgeui/core";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("extraData editors (Loop#31+)", () => {
  it("chart widgets declare series extraDataEditor", () => {
    for (const type of ["linechart", "barchart", "scatterchart", "chart"]) {
      const spec = getWidgetSpec(type);
      expect(spec?.extraDataEditor).toBe("series");
      expect(spec?.defaultExtraData?.series).toBeDefined();
    }
  });

  it("designer wires SeriesExtraDataEditor", () => {
    const group = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/ExtraDataGroup.vue"),
      "utf8",
    );
    const editor = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/extra-data/SeriesExtraDataEditor.vue"),
      "utf8",
    );
    expect(group).toContain("SeriesExtraDataEditor");
    expect(group).toContain("'series'");
    expect(editor).toContain("添加系列");
  });

  it("table declares cells extraDataEditor", () => {
    const spec = getWidgetSpec("table");
    expect(spec?.extraDataEditor).toBe("cells");
    expect(spec?.defaultExtraData?.cells).toBeDefined();
  });

  it("designer wires CellsExtraDataEditor", () => {
    const group = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/ExtraDataGroup.vue"),
      "utf8",
    );
    expect(group).toContain("CellsExtraDataEditor");
    expect(group).toContain("'cells'");
  });

  it("keyboard declares keymap extraDataEditor", () => {
    const spec = getWidgetSpec("keyboard");
    expect(spec?.extraDataEditor).toBe("keymap");
    expect(spec?.defaultExtraData?.rows).toBeDefined();
  });

  it("designer wires KeymapExtraDataEditor", () => {
    const group = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/ExtraDataGroup.vue"),
      "utf8",
    );
    expect(group).toContain("KeymapExtraDataEditor");
    expect(group).toContain("'keymap'");
  });

  it("animimg declares frames extraDataEditor", () => {
    const spec = getWidgetSpec("animimg");
    expect(spec?.extraDataEditor).toBe("frames");
    expect(spec?.defaultExtraData?.frames).toBeDefined();
  });

  it("designer wires FramesExtraDataEditor", () => {
    const group = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/ExtraDataGroup.vue"),
      "utf8",
    );
    expect(group).toContain("FramesExtraDataEditor");
    expect(group).toContain("'frames'");
  });
});
