import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, openProject, saveProject, validateProjectDir } from "@forgeui/core";
import { generate } from "@forgeui/codegen";

describe("D-08 platform-agnostic project", () => {
  it("validates and generates without project.platform", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-d08-"));
    createProject({ root: tmp, name: "noplat", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    expect(loaded.project.platform).toBeUndefined();
    delete loaded.project.platform;
    saveProject(loaded);

    const v = validateProjectDir(tmp);
    expect(v.ok, JSON.stringify(v.diagnostics)).toBe(true);

    const gen = await generate(tmp);
    expect(gen.ok).toBe(true);
    expect(fs.existsSync(path.join(tmp, "forgeui_generated/ui.c"))).toBe(true);
  });
});
