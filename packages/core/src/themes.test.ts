import { describe, expect, it } from "vitest";
import {
  colorRefId,
  flattenNamedColors,
  formatColorRef,
  isColorRef,
  resolveColorValue,
  slugThemeId,
  uniqueId,
  type ColorPaletteTheme,
  type NamedColor,
} from "./themes.js";

describe("themes (FR-018)", () => {
  it("detects and formats color refs", () => {
    expect(isColorRef("@primary")).toBe(true);
    expect(isColorRef("#aabbccff")).toBe(false);
    expect(colorRefId("@accent")).toBe("accent");
    expect(formatColorRef("primary")).toBe("@primary");
  });

  it("resolves named colors", () => {
    const colors: NamedColor[] = [{ id: "primary", name: "Primary", value: "#112233ff" }];
    expect(resolveColorValue("@primary", colors)).toBe("#112233ff");
    expect(resolveColorValue("#aabbccff", colors)).toBe("#aabbccff");
    expect(resolveColorValue("@missing", colors)).toBe("@missing");
  });

  it("resolves colors inside colorThemes palettes", () => {
    const colors: NamedColor[] = [{ id: "mine", name: "Mine", value: "#111111ff" }];
    const colorThemes: ColorPaletteTheme[] = [
      {
        id: "brand",
        name: "Brand",
        colors: [{ id: "accent", name: "Accent", value: "#ff6600ff" }],
      },
    ];
    expect(resolveColorValue("@accent", colors, colorThemes)).toBe("#ff6600ff");
    expect(flattenNamedColors(colors, colorThemes)).toHaveLength(2);
    const updated = structuredClone(colorThemes);
    updated[0]!.colors[0]!.value = "#00ff00ff";
    expect(resolveColorValue("@accent", colors, updated)).toBe("#00ff00ff");
  });

  it("builds unique ids", () => {
    const set = new Set(["btn", "btn_2"]);
    expect(uniqueId("btn", set)).toBe("btn_3");
    expect(slugThemeId("  Blue Theme  ")).toBe("blue_theme");
  });
});
