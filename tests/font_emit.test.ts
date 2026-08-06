import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isLikelyFontFile,
  normalizeLvFontConvSource,
  writeFontHeader,
} from "@forgeui/codegen";

describe("M7 lv_font_conv font emit helpers", () => {
  it("isLikelyFontFile rejects dummy bytes and accepts TTF magic", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-magic-"));
    const dummy = path.join(tmp, "dummy.ttf");
    const ttf = path.join(tmp, "real.ttf");
    fs.writeFileSync(dummy, "dummy");
    fs.writeFileSync(ttf, Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00]));
    expect(isLikelyFontFile(dummy)).toBe(false);
    expect(isLikelyFontFile(ttf)).toBe(true);
  });

  it("normalizeLvFontConvSource adds pointer alias and lvgl include path", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-norm-"));
    const cPath = path.join(tmp, "font_ui_16.c");
    fs.writeFileSync(
      cPath,
      `#include "lvgl.h"

const lv_font_t font_ui_16 = { .line_height = 16 };
`,
      "utf8",
    );

    expect(normalizeLvFontConvSource(cPath, "forgeui_font_ui_16", "font_ui_16")).toBe(true);
    const out = fs.readFileSync(cPath, "utf8");
    expect(out).toContain('#include "font_ui_16.h"');
    expect(out).toContain('#include "lvgl/lvgl.h"');
    expect(out).toContain("const lv_font_t *forgeui_font_ui_16 = &font_ui_16;");
  });

  it("writeFontHeader emits extern pointer for stub and real fonts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-h-"));
    const hPath = path.join(tmp, "font_ui_16.h");
    writeFontHeader("font_ui_16", "forgeui_font_ui_16", hPath, false, 12);
    const h = fs.readFileSync(hPath, "utf8");
    expect(h).toContain("extern const lv_font_t *forgeui_font_ui_16");
    expect(h).toContain("Bitmap font from lv_font_conv");
  });
});
