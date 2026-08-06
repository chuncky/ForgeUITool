/**
 * 属性改 bg_image / text_font 后必须能链接进预览：
 * 1) CodeGen 把 image/*.c、fonts/*.c 写入 forgeui_generated.cmake 显式列表
 * 2) Preview configure fingerprint 在资产 .c 增减时变化（强制 cmake 重配，避免 GLOB 陈旧）
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listGeneratedCRelPaths } from "../packages/codegen/src/generate";
import {
  computeConfigureFingerprint,
  generatedAssetSourcesListing,
  needsReconfigure,
  PREVIEW_TEMPLATE_VERSION,
  writeBuildCache,
} from "../packages/preview-host/src/cache";

function fpFor(projectRoot: string, templateDir: string) {
  return computeConfigureFingerprint({
    templateVersion: PREVIEW_TEMPLATE_VERSION,
    projectRoot,
    templateDir,
    lvglRoot: "/lvgl",
    sdl2Root: "/sdl2",
    repoRoot: "/repo",
    display: { width: 480, height: 320, colorDepth: 16 },
    lvglVersion: "9.10.0",
    generator: "MinGW Makefiles",
  });
}

describe("preview link: image/font assets after property edit", () => {
  it("listGeneratedCRelPaths includes image/ and fonts/ .c", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-gen-c-"));
    const gen = path.join(tmp, "forgeui_generated");
    fs.mkdirSync(path.join(gen, "screens"), { recursive: true });
    fs.mkdirSync(path.join(gen, "image"), { recursive: true });
    fs.mkdirSync(path.join(gen, "fonts"), { recursive: true });
    fs.writeFileSync(path.join(gen, "ui.c"), "/*ui*/");
    fs.writeFileSync(path.join(gen, "screens", "screen_home.c"), "/*s*/");
    fs.writeFileSync(path.join(gen, "image", "forgeui_img_bread_bg_1.c"), "/*img*/");
    fs.writeFileSync(path.join(gen, "fonts", "font_montserratMedium_16.c"), "/*font*/");

    const list = listGeneratedCRelPaths(gen);
    expect(list).toEqual(
      expect.arrayContaining([
        "ui.c",
        "screens/screen_home.c",
        "image/forgeui_img_bread_bg_1.c",
        "fonts/font_montserratMedium_16.c",
      ]),
    );
    expect(generatedAssetSourcesListing(tmp)).toContain("image/forgeui_img_bread_bg_1.c");
    expect(generatedAssetSourcesListing(tmp)).toContain("fonts/font_montserratMedium_16.c");
  });

  it("adding image .c after screens-only project changes configure fingerprint → reconfigure", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fp-img-"));
    const gen = path.join(tmp, "forgeui_generated");
    const templateDir = path.join(tmp, "tpl");
    const outDir = path.join(tmp, "out");
    fs.mkdirSync(path.join(gen, "screens"), { recursive: true });
    fs.mkdirSync(templateDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const n of ["CMakeLists.txt", "main.c", "hal.c", "lv_conf.h", "optimize_drivers.cmake"]) {
      fs.writeFileSync(path.join(templateDir, n), n);
    }
    fs.writeFileSync(path.join(gen, "ui.c"), "ui");
    fs.writeFileSync(path.join(gen, "screens", "home.c"), "s");

    const before = fpFor(tmp, templateDir);
    fs.writeFileSync(path.join(outDir, "CMakeCache.txt"), "# cache");
    writeBuildCache(outDir, {
      fingerprint: before,
      configuredAt: new Date().toISOString(),
      buildType: "Release",
    });
    expect(needsReconfigure(outDir, before)).toBe(false);

    // 模拟属性面板选背景图后 CodeGen 写出 image/*.c
    fs.mkdirSync(path.join(gen, "image"), { recursive: true });
    fs.writeFileSync(path.join(gen, "image", "forgeui_img_btn.c"), "const int x;");
    const afterImg = fpFor(tmp, templateDir);
    expect(afterImg).not.toBe(before);
    expect(needsReconfigure(outDir, afterImg)).toBe(true);

    // 模拟选字体后写出 fonts/*.c
    writeBuildCache(outDir, {
      fingerprint: afterImg,
      configuredAt: new Date().toISOString(),
      buildType: "Release",
    });
    fs.mkdirSync(path.join(gen, "fonts"), { recursive: true });
    fs.writeFileSync(path.join(gen, "fonts", "font_x_16.c"), "const int y;");
    const afterFont = fpFor(tmp, templateDir);
    expect(afterFont).not.toBe(afterImg);
    expect(needsReconfigure(outDir, afterFont)).toBe(true);
  });

  it("forgeui_generated.cmake.hbs lists image and font sources explicitly", () => {
    const hbs = fs.readFileSync(
      path.join(__dirname, "../packages/codegen/templates/c/forgeui_generated.cmake.hbs"),
      "utf8",
    );
    expect(hbs).toContain("{{#each sources}}");
    expect(hbs).toContain("CONFIGURE_DEPENDS");
    expect(hbs).toMatch(/image\/\*|\.c and fonts/i);
  });

  it("screen that references forgeui_img_/forgeui_font_ requires matching .c in listing", () => {
    // 契约：若 screen.c 引用符号，codegen 目录必须有对应 .c（链接前提）
    const screen = `
#include "../image/forgeui_img_bread_bg_1.h"
#include "../fonts/font_montserratMedium_16.h"
lv_obj_set_style_bg_image_src(btn, &forgeui_img_bread_bg_1, 0);
lv_obj_set_style_text_font(btn, forgeui_font_montserratMedium_16, 0);
`;
    const imgRefs = [...screen.matchAll(/forgeui_img_([A-Za-z0-9_]+)/g)].map((m) => m[0]);
    const fontRefs = [...screen.matchAll(/forgeui_font_([A-Za-z0-9_]+)/g)].map((m) => m[0]);
    expect(imgRefs).toContain("forgeui_img_bread_bg_1");
    expect(fontRefs).toContain("forgeui_font_montserratMedium_16");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-link-req-"));
    const gen = path.join(tmp, "forgeui_generated");
    fs.mkdirSync(path.join(gen, "image"), { recursive: true });
    fs.mkdirSync(path.join(gen, "fonts"), { recursive: true });
    fs.writeFileSync(path.join(gen, "image", "forgeui_img_bread_bg_1.c"), "/*ok*/");
    fs.writeFileSync(path.join(gen, "fonts", "font_montserratMedium_16.c"), "/*ok*/");
    const list = listGeneratedCRelPaths(gen);
    for (const sym of imgRefs) {
      expect(list.some((p) => p.includes(sym))).toBe(true);
    }
    expect(list.some((p) => p.includes("font_montserratMedium_16"))).toBe(true);
  });
});
