import { describe, expect, it } from "vitest";
import { STYLE_SUBGROUPS, styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";

describe("style subgroups (V1-B)", () => {
  it("exposes background/font/border/shadow/padding groups", () => {
    const ids = STYLE_SUBGROUPS.map((g) => g.id);
    expect(ids).toContain("background");
    expect(ids).toContain("font");
    expect(ids).toContain("border");
    expect(ids).toContain("shadow");
    expect(ids).toContain("padding");
    expect(ids).toContain("outline");
  });

  it("font subgroup includes text_decor", () => {
    const font = STYLE_SUBGROUPS.find((g) => g.id === "font");
    expect(font?.fields.some((f) => f.key === "text_decor")).toBe(true);
  });

  it("label uses font subgroup only", () => {
    expect(styleSubgroupsForWidget("label").map((g) => g.id)).toEqual(["font"]);
  });

  it("button uses full layout subgroups except line", () => {
    const ids = styleSubgroupsForWidget("button").map((g) => g.id);
    expect(ids).not.toContain("line");
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });
});
