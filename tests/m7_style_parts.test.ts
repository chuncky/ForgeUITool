import { describe, expect, it } from "vitest";
import { lvglSelector } from "@forgeui/codegen";

describe("M7 style part mapping", () => {
  it("maps widget-specific style parts to LVGL selectors", () => {
    expect(lvglSelector("main_tabbaritem", "default")).toBe("LV_PART_ITEMS | LV_STATE_DEFAULT");
    expect(lvglSelector("series", "default")).toBe("LV_PART_ITEMS | LV_STATE_DEFAULT");
    expect(lvglSelector("selected", "pressed")).toBe("LV_PART_SELECTED | LV_STATE_PRESSED");
    expect(lvglSelector("main_header", "default")).toBe("LV_PART_MAIN | LV_STATE_DEFAULT");
    expect(lvglSelector("cursor", "focused")).toBe("LV_PART_CURSOR | LV_STATE_FOCUSED");
  });
});
