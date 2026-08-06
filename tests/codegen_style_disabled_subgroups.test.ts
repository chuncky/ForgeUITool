import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  isStyleKeyDisabled,
  openProject,
  saveProject,
  updateNodeProps,
  withDisabledSubgroups,
} from "@forgeui/core";

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

describe("V1-B style subgroup eye toggle", () => {
  it("serializes disabledSubgroups and skips those keys in CodeGen", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-style-eye-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", {
      styleKeys: {
        part: "main",
        state: "default",
        props: {
          bg_color: "#112233ff",
          shadow_width: 8,
          shadow_color: "#00000088",
          text_color: "#ffffffff",
        },
      },
    });
    const screen = loaded.screens.get("home")!;
    const btn = [...(function* walk(n: { id: string; children?: unknown[] }): Generator<{ id: string; style?: Record<string, unknown> }> {
      yield n as { id: string; style?: Record<string, unknown> };
      for (const c of n.children ?? []) yield* walk(c as { id: string; children?: unknown[] });
    })(screen)].find((n) => n.id === "btn_next");
    expect(btn).toBeTruthy();
    btn!.style = withDisabledSubgroups(btn!.style, ["shadow"]);
    expect(isStyleKeyDisabled(btn!.style, "shadow_width")).toBe(true);
    expect(isStyleKeyDisabled(btn!.style, "bg_color")).toBe(false);
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(
      path.join(tmp, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("lv_obj_set_style_bg_color");
    expect(screenC).not.toContain("lv_obj_set_style_shadow_width");
  });

  it("StyleGroup exposes eye toggle wiring", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    expect(src).toContain("update-disabled-subgroups");
    expect(src).toContain("toggleSubgroup");
    expect(src).toContain("class=\"eye\"");
  });
});
