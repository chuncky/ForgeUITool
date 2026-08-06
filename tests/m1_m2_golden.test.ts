import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject, openProject, validateProjectDir } from "@forgeui/core";
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

describe("G-01 validate hello_dual", () => {
  it("validates the hello-dual-screen template", () => {
    const result = validateProjectDir(templateRoot);
    expect(result.diagnostics.filter((d) => d.level === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("G-02 generate ui_init", () => {
  it("generates ui.c containing ui_init and ui_nav", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-"));
    copyDir(templateRoot, tmp);
    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui.c"), "utf8");
    expect(uiC).toContain("void ui_init(void)");
    expect(uiC).toContain("ui_nav_load_screen");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui_nav.c"))).toBe(true);
    const navC = fs.readFileSync(path.join(tmp, "forgeui_generated/ui_nav.c"), "utf8");
    expect(navC).toContain('strcmp(screen_id, "settings")');
    expect(uiC).toContain("screen_home_create");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/custom/ui_events.c"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/custom/custom_func.c"))).toBe(true);
    expect(uiC).toContain("forgeui_custom_init()");
    expect(fs.readFileSync(path.join(tmp, "forgeui_generated/custom/ui_events.c"), "utf8")).toContain("on_btn_next");
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/forgeui_generated.cmake"))).toBe(true);
  });
});

describe("G-04 legacy generated+user migration", () => {
  it("migrates sibling generated/ and user/ on first generate", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-migrate-"));
    copyDir(templateRoot, tmp);
    const legacyGen = path.join(tmp, "generated");
    const legacyUser = path.join(tmp, "user");
    fs.mkdirSync(legacyGen, { recursive: true });
    fs.mkdirSync(legacyUser, { recursive: true });
    fs.writeFileSync(path.join(legacyGen, "old_ui.c"), "// legacy");
    fs.writeFileSync(path.join(legacyUser, "ui_events.c"), "void on_btn_next(void) {}\n");
    fs.rmSync(path.join(tmp, "forgeui_generated"), { recursive: true, force: true });
    const projectPath = path.join(tmp, "project.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    project.export = {
      ...project.export,
      generatedDir: "generated",
      userDir: "user",
    };
    delete project.export.codegenDir;
    delete project.export.customSubdir;
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(legacyGen)).toBe(false);
    expect(fs.existsSync(legacyUser)).toBe(false);
    expect(fs.readFileSync(path.join(tmp, "forgeui_generated/custom/ui_events.c"), "utf8")).toContain(
      "on_btn_next",
    );
    const migrated = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    expect(migrated.export.codegenDir).toBe("forgeui_generated");
  });
});

describe("G-03 user zone not overwritten", () => {
  it("keeps edited custom/ui_events.c on regenerate", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-"));
    copyDir(templateRoot, tmp);
    await generate(tmp);
    const userFile = path.join(tmp, "forgeui_generated/custom/ui_events.c");
    const marker = "/* BUSINESS_MARKER_DO_NOT_LOSE */";
    fs.writeFileSync(
      userFile,
      `#include "ui_events.h"\n\nvoid on_btn_next(void)\n{\n    ${marker}\n}\n`,
      "utf8",
    );
    const second = await generate(tmp);
    expect(second.ok).toBe(true);
    const content = fs.readFileSync(userFile, "utf8");
    expect(content).toContain(marker);
    expect(second.filesSkipped.some((f) => f.replace(/\\/g, "/").endsWith("forgeui_generated/custom/ui_events.c"))).toBe(
      true,
    );
  });
});

describe("create blank project", () => {
  it("creates and opens a blank project", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-blank-"));
    const root = path.join(tmp, "proj");
    createProject({ root, name: "blank_demo", fromTemplate: "blank" });
    const loaded = openProject(root);
    expect(loaded.project.platform).toBeUndefined();
    expect(loaded.project.lvglVersion).toBe("9.10");
    expect(loaded.project.deliveryMode).toBe("both");
    expect(loaded.screens.has("home")).toBe(true);
  });
});

describe("invalid project", () => {
  it("fails when lvglVersion is wrong", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-bad-"));
    copyDir(templateRoot, tmp);
    const projectPath = path.join(tmp, "project.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    project.lvglVersion = "8.3";
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
    const result = validateProjectDir(tmp);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "E_VER_001" || d.code === "E_SCHEMA_001")).toBe(
      true,
    );
  });
});
