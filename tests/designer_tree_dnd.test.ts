import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("page tree drag-reparent (FR-013b)", () => {
  it("ComponentTreeNode supports HTML5 DnD for reorder/reparent", () => {
    const src = readFileSync(
      resolve("apps/designer/src/components/ComponentTreeNode.vue"),
      "utf8",
    );
    expect(src).toContain(':draggable="!node.locked"');
    expect(src).toContain("application/x-forgeui-tree-node");
    expect(src).toContain("moveNodeById");
    expect(src).toContain("drop-inside");
    expect(src).toContain("drop-before");
    expect(src).toContain("drop-after");
  });

  it("project store exposes moveNodeById and uses widgetSpec.isContainer", () => {
    const src = readFileSync(resolve("apps/designer/src/stores/project.ts"), "utf8");
    expect(src).toContain("async function moveNodeById");
    expect(src).toContain("desktop().moveNode");
    expect(src).toContain("widgetSpec(node.type)?.isContainer");
    expect(src).not.toContain('node.type === "button"');
  });

  it("button is not a container in widget specs", () => {
    const src = readFileSync(resolve("packages/core/src/widgets.ts"), "utf8");
    const buttonBlock = src.slice(src.indexOf('type: "button"'), src.indexOf('type: "button"') + 400);
    expect(buttonBlock).toContain("isContainer: false");
  });
});
