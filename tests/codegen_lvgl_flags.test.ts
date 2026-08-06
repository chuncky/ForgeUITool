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

describe("V1-B lvgl_flags CodeGen", () => {
  it("emits add_flag / clear_flag for props.lvgl_flags", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-lvgl-flags-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", {
      props: {
        text: "Next",
        lvgl_flags: ["CLICKABLE", "CHECKABLE", "PRESS_LOCK"],
      },
    });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("lv_obj_add_flag");
    expect(screenC).toContain("LV_OBJ_FLAG_CLICKABLE");
    expect(screenC).toContain("LV_OBJ_FLAG_CHECKABLE");
    expect(screenC).toContain("LV_OBJ_FLAG_PRESS_LOCK");
    expect(screenC).toContain("lv_obj_clear_flag");
    expect(screenC).toContain("LV_OBJ_FLAG_SCROLLABLE");
  });

  it("skips flag emission when lvgl_flags is absent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-lvgl-flags-absent-"));
    copyDir(templateRoot, tmp);
    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).not.toContain("lv_obj_add_flag");
    expect(screenC).not.toContain("lv_obj_clear_flag");
  });
});
