import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BUILTIN_FONTS,
  DEFAULT_TEXT_FONT_ID,
  DEFAULT_TEXT_FONT_SIZE,
  addChildNode,
  createProject,
  defaultTextFontRef,
  ensureBuiltinFontsInProject,
  getWidgetSpec,
  openProject,
  resolveBuiltinFontsDir,
} from "../packages/core/src/index.js";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome.js";
import { CANVAS_DEFAULT_FONT_SIZE } from "../apps/designer/src/utils/lvgl-font-metrics.js";

describe("builtin fonts + default style seeds", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
    roots.length = 0;
  });

  it("ships SourceHanSansCN-Bold and 2312_v9 under xos-package/res/ttf", () => {
    const dir = resolveBuiltinFontsDir();
    expect(dir).toBeTruthy();
    for (const f of BUILTIN_FONTS) {
      expect(fs.existsSync(path.join(dir!, f.fileName)), f.fileName).toBe(true);
    }
  });

  it("createProject copies builtins into assets/fonts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-prj-"));
    roots.push(root);
    const loaded = createProject({ root, name: "fonts", platform: "qm10xd" });
    expect(ensureBuiltinFontsInProject(loaded, resolveBuiltinFontsDir())).toBe(false); // already done
    const ids = (loaded.project.assets?.fonts ?? []).map((f) =>
      typeof f === "string" ? f : (f as { id?: string }).id,
    );
    expect(ids).toContain(DEFAULT_TEXT_FONT_ID);
    expect(fs.existsSync(path.join(root, "assets/fonts/SourceHanSansCN-Bold.ttf"))).toBe(true);
  });

  it("addChildNode seeds text_font + text_font_size=16; button text_align center", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-seed-"));
    roots.push(root);
    createProject({ root, name: "seed", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;

    const btn = addChildNode(loaded, screenId, screenId, "button");
    const btnStyle = btn.style as { main?: { default?: Record<string, unknown> } };
    expect(btnStyle.main?.default?.text_font).toBe(defaultTextFontRef());
    expect(btnStyle.main?.default?.text_font_size).toBe(DEFAULT_TEXT_FONT_SIZE);
    expect(btnStyle.main?.default?.text_align).toBe("center");

    const lbl = addChildNode(loaded, screenId, screenId, "label");
    const lblStyle = lbl.style as { main?: { default?: Record<string, unknown> } };
    expect(lblStyle.main?.default?.text_font).toBe(defaultTextFontRef());
    expect(lblStyle.main?.default?.text_font_size).toBe(16);

    expect(getWidgetSpec("button")?.defaultStyle?.main?.default?.text_align).toBe("center");
  });

  it("canvas defaults: size 16; button unset align → center textAlign", () => {
    expect(CANVAS_DEFAULT_FONT_SIZE).toBe(16);
    const chrome = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "按钮" },
      style: { main: { default: { bg_color: "#2196F3ff", text_color: "#ffffffff" } } },
    });
    expect(chrome.fontSize).toBe("16px");
    expect(chrome.textAlign).toBe("center");
    expect(chrome.justifyContent).toBe("center");
  });
});
