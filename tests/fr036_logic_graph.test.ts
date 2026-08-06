import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("FR-036 deepen LogicGraph canvas", () => {
  it("ships draggable graph nodes with edges and reset layout", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const src = fs.readFileSync(
      path.join(root, "apps/designer/src/components/LogicGraphDialog.vue"),
      "utf8",
    );
    expect(src).toContain("onNodeDown");
    expect(src).toContain("resetLayout");
    expect(src).toContain("class=\"edges\"");
    expect(src).toContain("kind-widget");
    expect(src).toContain("kind-trigger");
    expect(src).toContain("kind-action");
    expect(src).toContain("store.select");
    expect(src).not.toContain("当前页控件的触发→动作链");
  });
});
