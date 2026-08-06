import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addCustomWidgetInstance,
  addChildNode,
  createProject,
  openProject,
  saveNodeAsCustomWidget,
  saveProject,
  listCustomWidgets,
} from "./index.js";

describe("custom widgets FR-019", () => {
  it("saveNodeAsCustomWidget stores subtree in project.customWidgets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cw-"));
    createProject({ root: tmp, name: "cw", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");
    addChildNode(loaded, sid, btn.id, "label");

    const def = saveNodeAsCustomWidget(loaded, sid, btn.id, { name: "按钮组" });
    expect(def.id).toBeTruthy();
    expect(def.name).toBe("按钮组");
    expect(def.root.type).toBe("button");
    expect(def.root.children).toHaveLength(1);
    expect(listCustomWidgets(loaded)).toHaveLength(1);

    saveProject(loaded);
    const reopened = openProject(tmp);
    expect(reopened.project.customWidgets).toHaveLength(1);
    expect(reopened.project.customWidgets![0]!.name).toBe("按钮组");
  });

  it("addCustomWidgetInstance clones with fresh ids", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cw2-"));
    createProject({ root: tmp, name: "cw2", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const src = addChildNode(loaded, sid, sid, "container");
    saveNodeAsCustomWidget(loaded, sid, src.id, { id: "panel_a", name: "Panel A" });

    const inst = addCustomWidgetInstance(loaded, sid, sid, "panel_a", {
      frame: { x: 40, y: 50 },
    });
    expect(inst.type).toBe("container");
    expect(inst.id).not.toBe(src.id);
    expect(inst.frame.x).toBe(40);
    expect(inst.frame.y).toBe(50);
  });
});
