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

describe("V1-C bg_image style codegen", () => {
  it("emits lv_obj_set_style_bg_image_src and dedupes image C file by path", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-bgimg-"));
    copyDir(templateRoot, tmp);

    const assetsDir = path.join(tmp, "assets/images");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, "tile.png"), encodeRgbaPng(2, 2, new Uint8Array(16).fill(128)));

    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    const bgStyle = {
      main: { default: { bg_image: "assets/images/tile.png" } },
    };
    home.children[0].style = { ...home.children[0].style, ...bgStyle };
    home.children.push({
      type: "button",
      id: "btn_bg",
      name: "BgBtn",
      frame: { x: 8, y: 60, w: 80, h: 40 },
      props: { text: "Bg" },
      style: bgStyle,
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_obj_set_style_bg_image_src");
    expect(screenC).toContain("&forgeui_img_tile");
    expect(screenC).toContain('#include "../image/forgeui_img_tile.h"');

    const imageDir = path.join(tmp, "forgeui_generated/image");
    const tileFiles = fs.readdirSync(imageDir).filter((f) => f.includes("tile"));
    expect(tileFiles.filter((f) => f.endsWith(".c"))).toHaveLength(1);
  });
});
