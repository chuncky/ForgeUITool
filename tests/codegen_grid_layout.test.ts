import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";

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

describe("V1-C layout_type grid codegen", () => {
  it("emits LV_LAYOUT_GRID with FR track descriptors", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-grid-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "container",
      id: "box_grid",
      name: "GridBox",
      frame: { x: 8, y: 8, w: 200, h: 120 },
      props: { layout_type: "grid", grid_columns: 3, grid_rows: 2 },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("LV_LAYOUT_GRID");
    expect(screenC).toContain("lv_obj_set_grid_dsc_array");
    expect(screenC).toContain("LV_GRID_FR(1)");
    expect(screenC).toContain("LV_GRID_TEMPLATE_LAST");
  });
});
