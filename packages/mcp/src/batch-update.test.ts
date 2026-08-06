import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addChildNode, createProject, openProject } from "@forgeui/core";
import { applyBatchUpdate } from "@forgeui/mcp";

describe("forgeui_batch_update", () => {
  it("add_node creates widget on screen", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-batch-"));
    createProject({ root: tmp, name: "b", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const result = applyBatchUpdate(loaded, [
      { type: "add_node", screenId: sid, parentId: sid, widgetType: "button", ref: "btn1" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.results[0]?.ok).toBe(true);
    const screen = loaded.screens.get(sid)!;
    expect(screen.children.some((c) => c.type === "button")).toBe(true);
  });

  it("rejects multi-page batch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-batch-mp-"));
    createProject({ root: tmp, name: "b2", fromTemplate: "hello-dual-screen" });
    const loaded = openProject(tmp);
    expect(() =>
      applyBatchUpdate(loaded, [
        { type: "add_node", screenId: "home", parentId: "home", widgetType: "button" },
        { type: "add_node", screenId: "settings", parentId: "settings", widgetType: "label" },
      ]),
    ).toThrow(/BATCH_UPDATE_MULTI_PAGE_FORBIDDEN/);
  });
});
