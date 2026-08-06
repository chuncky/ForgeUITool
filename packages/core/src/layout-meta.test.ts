import { describe, expect, it } from "vitest";
import { normalizeRotation, parseLayoutType } from "./types.js";

describe("layout rotation / layout_type (V1-C)", () => {
  it("normalizeRotation wraps degrees", () => {
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(-10)).toBe(350);
  });

  it("parseLayoutType accepts flex and grid modes", () => {
    expect(parseLayoutType("flex_row")).toBe("flex_row");
    expect(parseLayoutType("grid")).toBe("grid");
    expect(parseLayoutType("unknown")).toBe("none");
  });
});
