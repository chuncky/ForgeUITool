import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { openProject, saveProject, updateNodeProps } from "@forgeui/core";

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

describe("M7 outline style codegen", () => {
  it("emits outline width/color/opacity from style", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-style-outline-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", {
      styleKeys: {
        part: "main",
        state: "default",
        props: {
          outline_width: 3,
          outline_color: "#6366f1ff",
          outline_opacity: 200,
        },
      },
    });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("lv_obj_set_style_outline_width");
    expect(screenC).toContain("lv_obj_set_style_outline_color");
    expect(screenC).toContain("lv_obj_set_style_outline_opa");
    expect(screenC).toContain("0x6366F1");
  });
});
