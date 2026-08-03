import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  addScreen,
  openProject,
  removeScreen,
  renameScreen,
  setNodeEvents,
  saveProject,
} from "@forgeui/core";
import { packProject } from "@forgeui/packer";
import { StubLoader } from "@forgeui/loader";
import { listMcpTools, callMcpTool } from "@forgeui/mcp";
import { bundleProject, unbundleProject, FigmaImporter } from "@forgeui/importers";

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

describe("M5 screen CRUD + events", () => {
  it("adds renames removes screens and sets events", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-m5-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const page = addScreen(loaded, { id: "page_extra" });
    expect(page.id).toBe("page_extra");
    expect(loaded.screens.has("page_extra")).toBe(true);
    renameScreen(loaded, "page_extra", "page_renamed", "Renamed");
    expect(loaded.screens.has("page_renamed")).toBe(true);
    expect(loaded.screens.has("page_extra")).toBe(false);

    setNodeEvents(loaded, "home", "btn_next", [
      {
        trigger: "CLICKED",
        actions: [
          { type: "CHANGE_SCREEN", target: "settings" },
          { type: "CALL_FUNCTION", handler: "on_btn_next" },
        ],
      },
    ]);
    const btn = loaded.screens.get("home")!.children.find((c) => c.id === "btn_next");
    expect(btn?.events[0]?.actions).toHaveLength(2);

    removeScreen(loaded, "page_renamed");
    expect(loaded.screens.has("page_renamed")).toBe(false);
    saveProject(loaded);
    const again = openProject(tmp);
    expect(again.project.screens.map((s) => s.id).sort()).toEqual(["home", "settings"]);
  });
});

describe("M6 packer skeleton + AR stubs", () => {
  it("packs skeleton for deliveryMode=both", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-pack-"));
    copyDir(templateRoot, tmp);
    const result = await packProject(tmp);
    expect(result.ok).toBe(true);
    expect(result.skeleton).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "manifest.json"))).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "E_PACK_NOT_IMPL")).toBe(true);

    const loader = new StubLoader();
    const load = await loader.load(result.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    expect(load.ok).toBe(false);
  });

  it("lists MCP tools and supports read-only calls", async () => {
    expect(listMcpTools().map((t) => t.name)).toContain("forgeui_generate");
    await expect(callMcpTool("forgeui_batch_update", { projectRoot: templateRoot, operations: [] })).rejects.toThrow(
      /E_MCP_NOT_IMPL/,
    );
    const ping = await callMcpTool("forgeui_ping", {});
    expect(ping).toMatchObject({ ok: true });
  });

  it("figma importer stub", async () => {
    const fig = new FigmaImporter();
    expect(fig.canHandle("design.fig")).toBe(true);
    const r = await fig.import("design.fig", "/tmp/x");
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]?.code).toBe("E_IMPORT_NOT_IMPL");
  });

  it("bundle / unbundle roundtrip", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-bun-"));
    const src = path.join(tmp, "src");
    const out = path.join(tmp, "hello.forgeui");
    const dest = path.join(tmp, "dest");
    copyDir(templateRoot, src);
    const b = bundleProject(src, out);
    expect(b.ok).toBe(true);
    const u = unbundleProject(out, dest);
    expect(u.ok).toBe(true);
    const loaded = openProject(dest);
    expect(loaded.project.screens.length).toBe(2);
  });
});
