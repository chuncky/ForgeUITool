import { describe, expect, it } from "vitest";
import { decodePngRgba, rgbaToLvglArgb8888 } from "../packages/codegen/src/png-decode.js";
import { encodeRgbaPng } from "../packages/mcp/src/png-utils.js";

describe("png-decode", () => {
  it("decodes 2×2 RGBA PNG to LVGL byte order", () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 128, 255, 255, 255, 255,
    ]);
    const png = encodeRgbaPng(2, 2, rgba);
    const decoded = decodePngRgba(png);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.rgba).toEqual(rgba);

    const lvgl = rgbaToLvglArgb8888(decoded.rgba);
    expect(lvgl[0]).toBe(0);
    expect(lvgl[1]).toBe(0);
    expect(lvgl[2]).toBe(255);
    expect(lvgl[3]).toBe(255);
  });
});
