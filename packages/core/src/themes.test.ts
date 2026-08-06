import { describe, expect, it } from "vitest";
import {
  colorRefId,
  formatColorRef,
  isColorRef,
  resolveColorValue,
  slugThemeId,
  uniqueId,
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

  it("builds unique ids", () => {
    const set = new Set(["btn", "btn_2"]);
    expect(uniqueId("btn", set)).toBe("btn_3");
    expect(slugThemeId("  Blue Theme  ")).toBe("blue_theme");
  });
});
