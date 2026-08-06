import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { addChildNode, openProject, saveProject, updateNodeProps } from "@forgeui/core";
import { STYLE_SUBGROUPS, styleSubgroupsForWidget } from "../apps/designer/src/utils/style-fields";

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

describe("V1-B image img_recolor / img_opa", () => {
  it("exposes image subgroup for image widgets", () => {
    const img = STYLE_SUBGROUPS.find((g) => g.id === "image");
    expect(img?.fields.some((f) => f.key === "img_recolor")).toBe(true);
    expect(img?.fields.some((f) => f.key === "img_opa")).toBe(true);
    expect(styleSubgroupsForWidget("image").map((g) => g.id)).toEqual([
      "background",
      "border",
      "image",
    ]);
    expect(styleSubgroupsForWidget("imagebutton").map((g) => g.id)).toContain("image");
    expect(styleSubgroupsForWidget("imagebutton").map((g) => g.id)).toContain("border");
  });

  it("emits image_recolor and image_opa style APIs", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-img-style-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const img = addChildNode(loaded, "home", "home", "image");
    updateNodeProps(loaded, "home", img.id, {
      styleKeys: {
        part: "main",
        state: "default",
        props: {
          img_recolor: "#ff6600ff",
          img_opa: 180,
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
    expect(screenC).toContain("lv_obj_set_style_image_recolor");
    expect(screenC).toContain("0xFF6600");
    expect(screenC).toContain("lv_obj_set_style_image_opa");
    expect(screenC).toMatch(/lv_obj_set_style_image_opa\([^,]+,\s*180,/);
  });
});
