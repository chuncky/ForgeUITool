import { describe, expect, it } from "vitest";
import {
  filterPaletteWidgets,
  groupPaletteWidgetsByCategory,
  listPaletteWidgetSpecs,
} from "@forgeui/core";

describe("widget library panel data (FR-010a / FR-014a)", () => {
  it("palette excludes screen and groups into bekEN-like categories", () => {
    const palette = listPaletteWidgetSpecs();
    const groups = groupPaletteWidgetsByCategory(palette);
    expect(groups.length).toBeGreaterThanOrEqual(4);
    expect(groups.some((g) => g.label === "按钮" && g.widgets.some((w) => w.type === "button"))).toBe(
      true,
    );
  });

  it("search filters widgets without affecting category grouping input", () => {
    const filtered = filterPaletteWidgets(listPaletteWidgetSpecs(), "滑条");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.type).toBe("slider");
  });
});
