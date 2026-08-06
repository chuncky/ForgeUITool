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

describe("V1-C frame.rotation codegen", () => {
  it("emits lv_obj_set_style_transform_rotation when rotation set", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-rot-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    const lbl = home.children.find((c: { id: string }) => c.id === "lbl_title");
    lbl.frame.rotation = 45;
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_obj_set_style_transform_rotation");
    expect(screenC).toContain(", 450,");
    expect(screenC).toContain("transform_pivot_x");
  });
});
