import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { packProject } from "@forgeui/packer";
import {
  createProject,
  openProject,
  saveProject,
  updateProjectMeta,
  createVariable,
  estimateProjectMemory,
  normalizeTargets,
  buildPackageLogicManifest,
  isPackageAllowedAction,
  isFirmwareOnlyAction,
  addChildNode,
  setNodeEvents,
} from "@forgeui/core";
import { UI_STRINGS } from "../apps/designer/src/i18n/ui-locale";

describe("FR-020 designer UI locale map", () => {
  it("has zh-CN and en keys for toolbar", () => {
    expect(UI_STRINGS["zh-CN"].widgetLibrary).toBe("控件库");
    expect(UI_STRINGS.en.widgetLibrary).toBe("Widgets");
    expect(UI_STRINGS.en.save).toBe("Save");
  });
});

describe("FR-035 / FR-056 / FR-055 / FR-076 / FR-090", () => {
  it("variables + weak stubs + micropython + memory + package-logic", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-v2-batch-"));
    createProject({ root: tmp, name: "v2batch", fromTemplate: "blank" });
    let loaded = openProject(tmp);
    const vars = [createVariable([], { name: "counter", type: "int" })];
    updateProjectMeta(loaded, {
      variables: vars,
      targets: [
        { id: "main", name: "Main", width: 480, height: 320, colorDepth: 16 },
        { id: "wide", name: "Wide", width: 800, height: 480, colorDepth: 16 },
      ],
    });
    loaded.project.export = {
      ...(loaded.project.export ?? {}),
      eventStubStyle: "weak",
      micropython: true,
    };
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");
    setNodeEvents(loaded, sid, btn.id, [
      { trigger: "CLICKED", actions: [{ type: "CALL_FUNCTION", handler: "on_demo" }] },
      {
        trigger: "PRESSED",
        actions: [
          { type: "SET_VAR", variableId: vars[0]!.id, value: 1 },
          { type: "SWITCH_LANGUAGE", locale: "en" },
        ],
      },
    ]);
    saveProject(loaded);

    const mem = estimateProjectMemory(openProject(tmp));
    expect(mem.totalBytes).toBeGreaterThan(0);
    expect(normalizeTargets(openProject(tmp).project)).toHaveLength(2);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_vars.c"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/micropython/ui.py"))).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "E_VARS_OK")).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "E_MPY_OK")).toBe(true);

    const eventsC = fs.readFileSync(path.join(tmp, "forgeui_generated/custom/ui_events.c"), "utf8");
    expect(eventsC).toContain("__attribute__((weak))");
    expect(eventsC).toContain("on_demo");

    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.c"), "utf8");
    expect(uiC).toContain("forgeui_var_set_int");
    expect(uiC).toMatch(/event_set_var_/);
    expect(uiC).toMatch(/event_switch_lang_/);
    loaded = openProject(tmp);
    loaded.project.deliveryMode = "both";
    saveProject(loaded);
    const pack = await packProject(tmp);
    expect(pack.ok).toBe(true);
    const logicPath = path.join(pack.outDir, "package-logic.json");
    expect(fs.existsSync(logicPath)).toBe(true);
    const logic = JSON.parse(fs.readFileSync(logicPath, "utf8"));
    expect(logic.allowedActions).toContain("SET_VAR");
    expect(logic.firmwareOnlyActions).toContain("CALL_FUNCTION");

    expect(isPackageAllowedAction("CHANGE_SCREEN")).toBe(true);
    expect(isFirmwareOnlyAction("CALL_FUNCTION")).toBe(true);
    expect(buildPackageLogicManifest().schemaVersion).toBe("1");
  });
});

describe("designer V2 dialogs wiring", () => {
  it("ships logic graph + memory dialogs and toolbar locale", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const wb = fs.readFileSync(path.join(root, "apps/designer/src/components/DesignerWorkbench.vue"), "utf8");
    const tb = fs.readFileSync(path.join(root, "apps/designer/src/components/WorkspaceToolbar.vue"), "utf8");
    const actionRow = fs.readFileSync(
      path.join(root, "apps/designer/src/components/event-panel/ActionRow.vue"),
      "utf8",
    );
    expect(wb).toContain("LogicGraphDialog");
    expect(wb).toContain("MemoryEstimateDialog");
    expect(tb).toContain("onUiLocale");
    expect(tb).toContain("showLogicGraph");
    expect(tb).toContain("packPreview");
    expect(actionRow).toContain("SET_VAR");
    expect(actionRow).toContain("SWITCH_LANGUAGE");
    const storeSrc = fs.readFileSync(path.join(root, "apps/designer/src/stores/project.ts"), "utf8");
    expect(storeSrc).toContain("packPreview()");
    expect(fs.readFileSync(path.join(root, "apps/designer/src/components/NewProjectDialog.vue"), "utf8")).not.toContain(
      "目标平台",
    );
  });
});
