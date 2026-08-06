import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  createProject,
  importFontAsset,
  openProject,
  updateNodeProps,
  addChildNode,
  saveProject,
} from "@forgeui/core";

describe("M7 font subset FR-041", () => {
  it("generate writes charset + stub font C for imported TTF", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-gen-"));
    createProject({ root: tmp, name: "fontgen", fromTemplate: "blank" });
    const src = path.join(tmp, "ui.ttf");
    fs.writeFileSync(src, "dummy");
    const loaded = openProject(tmp);
    importFontAsset(loaded, src, { size: 16 });
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, { props: { text: "OK" } });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const charset = path.join(tmp, "forgeui_generated/fonts/font_ui_16.charset.txt");
    expect(fs.existsSync(charset)).toBe(true);
    expect(fs.readFileSync(charset, "utf8")).toContain("O");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/fonts/font_ui_16.c"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/fonts/font_ui_16.h"))).toBe(true);
  });
});
