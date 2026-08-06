import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { addChildNode, createProject, openProject, saveProject, setNodeEvents } from "@forgeui/core";

describe("FR-032 SET_PROP designer + CodeGen", () => {
  it("ActionRow exposes node/prop/value pickers", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const actionRow = fs.readFileSync(
      path.join(root, "apps/designer/src/components/event-panel/ActionRow.vue"),
      "utf8",
    );
    const eventPanel = fs.readFileSync(
      path.join(root, "apps/designer/src/components/EventPanel.vue"),
      "utf8",
    );
    expect(actionRow).toContain("SET_PROP");
    expect(actionRow).toContain("目标控件");
    expect(actionRow).toContain("onSetPropValue");
    expect(eventPanel).toContain("flatNodes");
  });

  it("emits event_set_prop callbacks wired to widget symbols", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fr032-"));
    createProject({ root: tmp, name: "fr032", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const label = addChildNode(loaded, sid, sid, "label");
    const btn = addChildNode(loaded, sid, sid, "button");
    setNodeEvents(loaded, sid, btn.id, [
      {
        trigger: "CLICKED",
        actions: [{ type: "SET_PROP", nodeId: label.id, prop: "text", value: "Hi" }],
      },
      {
        trigger: "PRESSED",
        actions: [{ type: "SET_PROP", nodeId: label.id, prop: "hidden", value: true }],
      },
    ]);
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.c"), "utf8");
    const uiH = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.h"), "utf8");
    expect(uiC).toMatch(/event_set_prop_/);
    expect(uiC).toContain("lv_label_set_text");
    expect(uiC).toContain('"Hi"');
    expect(uiC).toContain("LV_OBJ_FLAG_HIDDEN");
    expect(uiH).toMatch(/event_set_prop_/);

    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens", `screen_${sid}.c`),
      "utf8",
    );
    expect(screenC).toMatch(/event_set_prop_/);
  });
});
