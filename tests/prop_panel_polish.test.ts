import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { widgetIconChar, WIDGET_ICON_CHARS } from "../apps/designer/src/utils/widget-icons";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("V1 prop panel polish", () => {
  it("shares widget icons and animates PropGroup collapse", () => {
    expect(widgetIconChar("button")).toBe(WIDGET_ICON_CHARS.button);
    expect(widgetIconChar("label")).toBe("T");
    const group = fs.readFileSync(path.join(root, "apps/designer/src/components/prop-panel/PropGroup.vue"), "utf8");
    expect(group).toContain("grid-template-rows");
    expect(group).toContain("group-collapse");
    expect(group).toContain("group-clip");
    const propPanel = fs.readFileSync(path.join(root, "apps/designer/src/components/PropPanel.vue"), "utf8");
    expect(propPanel).toContain("overflow-y: auto");
    const header = fs.readFileSync(
      path.join(root, "apps/designer/src/components/prop-panel/PropIdentityHeader.vue"),
      "utf8",
    );
    expect(header).toContain("widgetIconChar");
    expect(header).toContain("type-icon");
  });
});
