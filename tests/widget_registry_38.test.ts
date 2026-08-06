import { describe, expect, it } from "vitest";
import { listPaletteWidgetSpecs, listWidgetSpecs } from "@forgeui/core";

/** Beken component-specs palette: 38 types (excludes page/screen). */
const BEKEN_38 = [
  "container",
  "win",
  "label",
  "spangroup",
  "table",
  "list",
  "button",
  "imagebutton",
  "textarea",
  "checkbox",
  "switch",
  "slider",
  "dropdown",
  "roller",
  "spinbox",
  "image",
  "animimg",
  "canvas",
  "arc",
  "line",
  "qrcode",
  "barcode",
  "led",
  "bar",
  "spinner",
  "msgbox",
  "menu",
  "tabview",
  "tileview",
  "digitalclock",
  "calendar",
  "keyboard",
  "scale",
  "linechart",
  "barchart",
  "scatterchart",
  "chart",
] as const;

describe("widget registry 38/38 (FR-015 V1-A)", () => {
  it("registers all 38 Beken palette widget types", () => {
    const types = new Set(listPaletteWidgetSpecs().map((w) => w.type));
    const missing = BEKEN_38.filter((t) => !types.has(t));
    expect(missing, `missing: ${missing.join(", ")}`).toEqual([]);
    expect(listPaletteWidgetSpecs().length).toBe(38);
  });

  it("includes screen separately in full spec list", () => {
    expect(listWidgetSpecs().some((w) => w.type === "screen")).toBe(true);
    expect(listWidgetSpecs().length).toBe(39);
  });
});
