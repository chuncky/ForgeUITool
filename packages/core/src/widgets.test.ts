import { describe, expect, it } from "vitest";
import {
  filterPaletteWidgets,
  groupPaletteWidgetsByCategory,
  listPaletteWidgetSpecs,
  listWidgetSpecs,
  WIDGET_CATEGORY_LABELS,
} from "./widgets.js";

describe("widget library registry", () => {
  it("excludes screen from palette list", () => {
    const palette = listPaletteWidgetSpecs();
    expect(palette.some((w) => w.type === "screen")).toBe(false);
    expect(palette.length).toBeGreaterThan(0);
  });

  it("groups widgets by category in stable order", () => {
    const groups = groupPaletteWidgetsByCategory(listPaletteWidgetSpecs());
    expect(groups[0]?.category).toBe("layout");
    expect(groups.find((g) => g.category === "button")?.widgets.some((w) => w.type === "button")).toBe(
      true,
    );
    for (const g of groups) {
      expect(g.label).toBe(WIDGET_CATEGORY_LABELS[g.category]);
    }
  });

  it("registers V1-A sample widgets with multi-part styles", () => {
    const specs = listWidgetSpecs();
    const list = specs.find((w) => w.type === "list");
    const spinner = specs.find((w) => w.type === "spinner");
    expect(list?.styleParts).toContain("main_item");
    expect(spinner?.styleParts).toContain("indicator");
    expect(specs.some((w) => w.type === "roller")).toBe(true);
    expect(specs.some((w) => w.type === "imagebutton")).toBe(true);
    expect(specs.some((w) => w.type === "tabview")).toBe(true);
    expect(specs.some((w) => w.type === "keyboard")).toBe(true);
    expect(listPaletteWidgetSpecs().length).toBe(38);
  });
});
