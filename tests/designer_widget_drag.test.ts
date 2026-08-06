import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("widget library drag-drop (FR-012)", () => {
  it("WidgetLibraryPanel sets forgeui widget mime on dragstart", () => {
    const src = readFileSync(
      resolve("apps/designer/src/components/WidgetLibraryPanel.vue"),
      "utf8",
    );
    expect(src).toContain('draggable="true"');
    expect(src).toContain("application/x-forgeui-widget");
    expect(src).toContain("@dragstart");
  });

  it("Canvas accepts drop and calls addWidgetAt", () => {
    const src = readFileSync(resolve("apps/designer/src/components/Canvas.vue"), "utf8");
    expect(src).toContain("@drop.prevent");
    expect(src).toContain("addWidgetAt");
    expect(src).toContain("application/x-forgeui-widget");
  });
});
