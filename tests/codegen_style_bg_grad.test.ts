import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { openProject, saveProject, updateNodeProps } from "@forgeui/core";
import { STYLE_SUBGROUPS } from "../apps/designer/src/utils/style-fields";

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

describe("V1-B bg_grad style", () => {
  it("StyleGroup background exposes bg_grad_dir and bg_grad_color", () => {
    const bg = STYLE_SUBGROUPS.find((g) => g.id === "background");
    expect(bg?.fields.some((f) => f.key === "bg_grad_dir")).toBe(true);
    expect(bg?.fields.some((f) => f.key === "bg_grad_color")).toBe(true);
  });

  it("emits lv_obj_set_style_bg_grad_* from style", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-bg-grad-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", {
      styleKeys: {
        part: "main",
        state: "default",
        props: {
          bg_color: "#1e293bff",
          bg_grad_dir: "ver",
          bg_grad_color: "#334155ff",
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
    expect(screenC).toContain("lv_obj_set_style_bg_grad_dir");
    expect(screenC).toContain("LV_GRAD_DIR_VER");
    expect(screenC).toContain("lv_obj_set_style_bg_grad_color");
    expect(screenC).toContain("0x334155");
  });
});
