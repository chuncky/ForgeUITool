/**
 * Product LVGL (xos-package) long_mode CodeGen: LV_LABEL_LONG_* (not Beken LONG_MODE_*).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate, lvLabelLongModeExpr } from "@forgeui/codegen";
import {
  addChildNode,
  createProject,
  openProject,
  saveProject,
  updateNodeProps,
} from "@forgeui/core";

const roots: string[] = [];

afterEach(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  roots.length = 0;
});

function blank(name: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `forgeui-${name}-`));
  roots.push(root);
  createProject({ root, name, fromTemplate: "blank" });
  return openProject(root);
}

describe("lvLabelLongModeExpr (product LVGL)", () => {
  it("maps Forge enums to LV_LABEL_LONG_*", () => {
    expect(lvLabelLongModeExpr("WRAP")).toBe("LV_LABEL_LONG_WRAP");
    expect(lvLabelLongModeExpr("DOTS")).toBe("LV_LABEL_LONG_DOT");
    expect(lvLabelLongModeExpr("DOT")).toBe("LV_LABEL_LONG_DOT");
    expect(lvLabelLongModeExpr("SCROLL")).toBe("LV_LABEL_LONG_SCROLL");
    expect(lvLabelLongModeExpr("SCROLL_CIRCULAR")).toBe("LV_LABEL_LONG_SCROLL_CIRCULAR");
    expect(lvLabelLongModeExpr("CLIP")).toBe("LV_LABEL_LONG_CLIP");
    expect(lvLabelLongModeExpr(undefined)).toBe("LV_LABEL_LONG_WRAP");
  });
});

describe("product LVGL long_mode codegen", () => {
  it("label emits LV_LABEL_LONG_DOT + fixed size", async () => {
    const loaded = blank("lm-label");
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label", { frame: { x: 10, y: 10, w: 80, h: 24 } });
    updateNodeProps(loaded, sid, lbl.id, {
      props: { text: "Hello very long label text for dots", long_mode: "DOTS" },
    });
    saveProject(loaded);

    const result = await generate(loaded.root);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(loaded.root, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("LV_LABEL_LONG_DOT");
    expect(screenC).not.toContain("LV_LABEL_LONG_MODE_");
    expect(screenC).toMatch(/lv_obj_set_size\([^,]+,\s*80,\s*24\)/);
  });

  it("button child label: long_mode + LV_PCT(100) + align center", async () => {
    const loaded = blank("lm-btn");
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button", { frame: { x: 10, y: 10, w: 100, h: 40 } });
    updateNodeProps(loaded, sid, btn.id, {
      props: { text: "Long button caption text", long_mode: "DOTS" },
    });
    saveProject(loaded);

    const result = await generate(loaded.root);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(loaded.root, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("LV_LABEL_LONG_DOT");
    expect(screenC).not.toContain("LV_LABEL_LONG_MODE_");
    expect(screenC).toContain("lv_obj_set_width(label, LV_PCT(100))");
    expect(screenC).toContain("lv_obj_align(label, LV_ALIGN_CENTER, 0, 0)");
    expect(screenC).not.toContain("lv_obj_center(label)");
  });

  it("WRAP long_mode emits LV_LABEL_LONG_WRAP", async () => {
    const loaded = blank("lm-wrap");
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, {
      props: { text: "wrap me please across lines", long_mode: "WRAP" },
    });
    saveProject(loaded);
    const result = await generate(loaded.root);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(loaded.root, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("LV_LABEL_LONG_WRAP");
    expect(screenC).not.toContain("LV_LABEL_LONG_MODE_WRAP");
  });
});
