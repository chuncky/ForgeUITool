import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { encodeRgbaPng } from "../packages/mcp/src/png-utils.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("D-07 custom_func user zone", () => {
  it("creates custom_func once and preserves user edits", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-custom-func-"));
    copyDir(templateRoot, tmp);
    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const customC = path.join(tmp, "forgeui_generated/custom/custom_func.c");
    expect(fs.existsSync(customC)).toBe(true);
    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.c"), "utf8");
    expect(uiC).toContain("forgeui_custom_init()");

    const marker = "/* CUSTOM_FUNC_USER */";
    fs.writeFileSync(customC, `#include "custom_func.h"\n\nvoid forgeui_custom_init(void) { ${marker} }\n`, "utf8");
    await generate(tmp);
    expect(fs.readFileSync(customC, "utf8")).toContain(marker);
  });
});

describe("D-07 image c_array emit", () => {
  it("writes image stubs and binds lv_image_set_src", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-image-emit-"));
    copyDir(templateRoot, tmp);

    const projectPath = path.join(tmp, "project.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    project.assets = {
      images: [{ id: "logo", path: "assets/images/logo.png" }],
      fonts: project.assets?.fonts ?? [],
    };
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    const assetsDir = path.join(tmp, "assets/images");
    fs.mkdirSync(assetsDir, { recursive: true });
    const logoRgba = new Uint8Array([0, 128, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255]);
    fs.writeFileSync(path.join(assetsDir, "logo.png"), encodeRgbaPng(2, 2, logoRgba));

    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "image",
      id: "img_logo",
      name: "Logo",
      frame: { x: 8, y: 8, w: 32, h: 32 },
      props: { src: "assets/images/logo.png" },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const imgC = path.join(tmp, "forgeui_generated/image/forgeui_img_logo.c");
    expect(fs.existsSync(imgC)).toBe(true);
    expect(fs.readFileSync(imgC, "utf8")).toContain("lv_image_dsc_t forgeui_img_logo");
    expect(fs.readFileSync(imgC, "utf8")).toContain(".w = 2");
    expect(fs.readFileSync(imgC, "utf8")).not.toContain("Stub 1×1");

    const screenHome = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenHome).toContain('#include "../image/forgeui_img_logo.h"');
    expect(screenHome).toContain("lv_image_set_src(");
    expect(screenHome).toContain("&forgeui_img_logo");
  });

  it("binds imagebutton dual state and animimg frames", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-img-widgets-"));
    copyDir(templateRoot, tmp);

    const assetsDir = path.join(tmp, "assets/images");
    fs.mkdirSync(assetsDir, { recursive: true });
    const px = (r: number, g: number, b: number) => new Uint8Array([r, g, b, 255, 0, 0, 0, 255, 0, 255, 0, 255, 255, 255, 255, 255]);
    fs.writeFileSync(path.join(assetsDir, "btn_off.png"), encodeRgbaPng(2, 2, px(10, 20, 30)));
    fs.writeFileSync(path.join(assetsDir, "btn_on.png"), encodeRgbaPng(2, 2, px(40, 50, 60)));
    fs.writeFileSync(path.join(assetsDir, "f1.png"), encodeRgbaPng(2, 2, px(1, 2, 3)));
    fs.writeFileSync(path.join(assetsDir, "f2.png"), encodeRgbaPng(2, 2, px(4, 5, 6)));

    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "imagebutton",
      id: "ibtn",
      name: "ImgBtn",
      frame: { x: 10, y: 10, w: 32, h: 32 },
      props: { src_released: "assets/images/btn_off.png", src_pressed: "assets/images/btn_on.png" },
      style: {},
      events: [],
      children: [],
    });
    home.children.push({
      type: "animimg",
      id: "anim",
      name: "Anim",
      frame: { x: 50, y: 10, w: 32, h: 32 },
      props: { duration: 150, repeat: true },
      extraData: {
        frames: [{ src: "assets/images/f1.png" }, { src: "assets/images/f2.png" }],
      },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenHome = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenHome).toContain("LV_IMAGEBUTTON_STATE_RELEASED");
    expect(screenHome).toContain("LV_IMAGEBUTTON_STATE_PRESSED");
    expect(screenHome).toContain("&forgeui_img_btn_off");
    expect(screenHome).toContain("&forgeui_img_btn_on");
    expect(screenHome).toContain("lv_animimg_set_src");
    expect(screenHome).toContain("&forgeui_img_f1");
    expect(screenHome).toContain("&forgeui_img_f2");
    expect(screenHome).toContain("lv_animimg_start");
  });
});
