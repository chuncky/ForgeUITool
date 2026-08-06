import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  createProject,
  openProject,
  saveProject,
  updateProjectMeta,
  defaultI18nConfig,
  upsertI18nString,
  createTimelineAnimation,
  createAnimTrack,
  addChildNode,
} from "@forgeui/core";

describe("FR-042/071 CodeGen emit", () => {
  it("generate writes ui_i18n and ui_anim when enabled", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-i18n-anim-"));
    createProject({ root: tmp, name: "i18n-anim", fromTemplate: "blank" });
    const loaded = openProject(tmp);

    const i18n = defaultI18nConfig();
    i18n.enabled = true;
    upsertI18nString(i18n, "hello", { values: { en: "Hello", "zh-CN": "你好" } });

    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");
    const anim = createTimelineAnimation([], { name: "fade", duration: 800 });
    createAnimTrack(anim, { nodeId: btn.id, property: "opacity" });
    createAnimTrack(anim, { nodeId: sid, property: "x" });

    updateProjectMeta(loaded, { i18n, animations: [anim] });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_i18n.h"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_i18n.c"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_anim.h"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_anim.c"))).toBe(true);

    const i18nC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui_i18n.c"), "utf8");
    expect(i18nC).toContain("ui_i18n_get");
    expect(i18nC).toContain("Hello");
    expect(i18nC).toContain("你好");

    const animC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui_anim.c"), "utf8");
    expect(animC).toContain(`ui_anim_play_${anim.id.replace(/[^A-Za-z0-9_]/g, "_")}`);
    expect(animC).toContain("lv_anim_start");
    expect(animC).toContain(`screen_${sid}_get()`);
    expect(animC).toMatch(new RegExp(`extern lv_obj_t \\*ui_${sid}_${btn.id}`));
    expect(animC).not.toContain("TODO: bind node");
    expect(result.diagnostics.some((d) => d.code === "E_I18N_OK")).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "E_ANIM_OK")).toBe(true);
  });
});
