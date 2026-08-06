import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openProject } from "@forgeui/core";
import { FigmaImporter, importFigmaJson } from "@forgeui/importers";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(repoRoot, "tests/fixtures/figma-demo.figma.json");

describe("Figma importer (Loop#21)", () => {
  it("imports forgeui-figma JSON into project", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fig-"));
    const result = importFigmaJson(fixture, tmp);
    expect(result.ok).toBe(true);
    const loaded = openProject(tmp);
    expect(loaded.project.name).toBe("Figma Demo");
    expect(loaded.project.screens.some((s) => s.id === "main")).toBe(true);
    const main = loaded.screens.get("main")!;
    expect(main.children.some((c) => c.type === "label")).toBe(true);
    expect(main.children.some((c) => c.type === "button")).toBe(true);
  });

  it("rejects binary .fig path", async () => {
    const fig = new FigmaImporter();
    expect(fig.canHandle("design.fig")).toBe(true);
    const r = await fig.import("design.fig", "/tmp/x");
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]?.code).toBe("E_IMPORT_NOT_IMPL");
    expect(r.diagnostics[0]?.message).toMatch(/Binary .fig/);
  });

  it("designer exposes figma import IPC", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain("project:importFigma");
    expect(preload).toContain("importFigma");
  });
});
