import { describe, expect, it } from "vitest";
import { normalizeStyle, styleProp, patchStyleProps } from "./style.js";

describe("normalizeStyle", () => {
  it("reads MVP flat main.default", () => {
    const n = normalizeStyle({ main: { default: { bg_color: "#112233" } } });
    expect(n.parts.main.default.bg_color).toBe("#112233");
  });

  it("reads V1 parts/states", () => {
    const n = normalizeStyle({
      parts: {
        main: {
          default: { bg_color: "#001122" },
          pressed: { bg_color: "#003344" },
        },
      },
    });
    expect(styleProp(
      { parts: { main: { pressed: { bg_color: "#003344" } } } },
      "main",
      "pressed",
      "bg_color",
    )).toBe("#003344");
    expect(n.parts.main.pressed.bg_color).toBe("#003344");
  });

  it("patchStyleProps merges into main.default without clobbering", () => {
    const next = patchStyleProps(
      { main: { default: { bg_color: "#112233", text_color: "#ffffff" } } },
      "main",
      "default",
      { bg_color: "#aabbcc" },
    );
    expect((next as { main: { default: { bg_color: string; text_color: string } } }).main.default.bg_color).toBe(
      "#aabbcc",
    );
    expect((next as { main: { default: { text_color: string } } }).main.default.text_color).toBe("#ffffff");
  });
});
