import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate, writeFontHeader, fontCIdent, fontBaseName } from "@forgeui/codegen";
import { openProject, saveProject, addChildNode, setNodeEvents } from "@forgeui/core";

const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".forge") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("font header C macros", () => {
  it("sanitizes hyphens in #ifndef / #define guards (SourceHanSansCN-Bold)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-guard-"));
    const id = "SourceHanSansCN-Bold";
    const size = 16;
    const base = fontBaseName(id, size);
    const cName = fontCIdent(id, size);
    const hPath = path.join(tmp, `${base}.h`);
    writeFontHeader(base, cName, hPath, true, 0);
    const h = fs.readFileSync(hPath, "utf8");
    expect(h).toContain("#ifndef FORGEUI_FONT_SOURCEHANSANSCN_BOLD_16_H");
    expect(h).toContain("#define FORGEUI_FONT_SOURCEHANSANSCN_BOLD_16_H");
    expect(h).not.toMatch(/#ifndef[^\n]*-/);
    expect(h).toContain(`extern const lv_font_t *${cName};`);
  });
});

describe("CALL_FUNCTION appends to existing ui_events.h/.c", () => {
  it("appends on_btn_ok decl+stub when custom files already exist", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-handler-append-"));
    copyDir(templateRoot, tmp);
    await generate(tmp);

    const hPath = path.join(tmp, "forgeui_generated/custom/ui_events.h");
    const cPath = path.join(tmp, "forgeui_generated/custom/ui_events.c");
    expect(fs.readFileSync(hPath, "utf8")).toContain("on_btn_next");
    expect(fs.readFileSync(hPath, "utf8")).not.toContain("on_btn_ok");

    const loaded = openProject(tmp);
    const btn = addChildNode(loaded, "home", "home", "button");
    setNodeEvents(loaded, "home", btn.id, [
      {
        id: "evt_ok",
        trigger: "CLICKED",
        actions: [{ type: "CALL_FUNCTION", handler: "on_btn_ok" }],
      },
    ]);
    saveProject(loaded);

    const second = await generate(tmp);
    expect(second.ok).toBe(true);

    const h = fs.readFileSync(hPath, "utf8");
    const c = fs.readFileSync(cPath, "utf8");
    expect(h).toContain("void on_btn_ok(void);");
    expect(h).toContain("void on_btn_next(void);");
    expect(c).toContain("void on_btn_ok(void)");
    expect(c).toContain("on_btn_next");

    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.c"), "utf8");
    expect(uiC).toContain("on_btn_ok()");
  });
});
