import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  createProject,
  importFontAsset,
  openProject,
  saveProject,
  updateNodeProps,
  addChildNode,
} from "@forgeui/core";

describe("M7 text_font style codegen", () => {
  it("emits lv_obj_set_style_text_font and font include from imported font", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-style-font-"));
    createProject({ root: tmp, name: "fontstyle", fromTemplate: "blank" });
    const src = path.join(tmp, "ui.ttf");
    fs.writeFileSync(src, "dummy");
    const loaded = openProject(tmp);
    importFontAsset(loaded, src, { size: 16 });
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, {
      styleKeys: {
        part: "main",
        state: "default",
        props: { text_font: "ui" },
      },
    });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_" + sid + ".c"),
      "utf8",
    );
    expect(screenC).toContain('#include "../fonts/font_ui_16.h"');
    expect(screenC).toContain("lv_obj_set_style_text_font");
    expect(screenC).toContain("forgeui_font_ui_16");
  });

  it("text_font + text_font_size picks size like BK font_family+font_size", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-size-"));
    createProject({ root: tmp, name: "fontsize", fromTemplate: "blank" });
    const src = path.join(tmp, "ui.ttf");
    fs.writeFileSync(src, "dummy");
    const loaded = openProject(tmp);
    importFontAsset(loaded, src, { size: 16 });
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, {
      styleKeys: {
        part: "main",
        state: "default",
        props: { text_font: "ui", text_font_size: 24 },
      },
    });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_" + sid + ".c"),
      "utf8",
    );
    expect(screenC).toContain('#include "../fonts/font_ui_24.h"');
    expect(screenC).toContain("forgeui_font_ui_24");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/fonts/font_ui_24.h"))).toBe(true);
  });

  it("text_font_size alone emits builtin montserrat (BK default family)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-onlysize-"));
    createProject({ root: tmp, name: "onlysize", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, {
      styleKeys: {
        part: "main",
        state: "default",
        props: { text_font_size: 20 },
      },
    });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_" + sid + ".c"),
      "utf8",
    );
    expect(screenC).toContain("lv_obj_set_style_text_font");
    expect(screenC).toContain("&lv_font_montserrat_20");
  });
});
