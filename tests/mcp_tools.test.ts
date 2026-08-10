import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyMutation, openProject, updateNodeProps } from "@forgeui/core";
import { callMcpTool, listMcpTools } from "@forgeui/mcp";
import { encodeRgbaPng } from "../packages/mcp/src/png-utils.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function writeTestPng(file: string, w: number, h: number): void {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0x10;
    rgba[i + 1] = 0x20;
    rgba[i + 2] = 0x30;
    rgba[i + 3] = 0xff;
  }
  fs.writeFileSync(file, encodeRgbaPng(w, h, rgba));
}

describe("MCP tools (read path)", () => {
  it("lists forgeui_* tools from MCP design §5.1", () => {
    const names = listMcpTools().map((t) => t.name);
    expect(names).toContain("forgeui_get_editor_state");
    expect(names).toContain("forgeui_batch_get");
    expect(names).toContain("forgeui_ping");
    expect(names).not.toContain("forgeui_get_project_meta");
    const shot = listMcpTools().find((t) => t.name === "forgeui_get_page_screenshot");
    expect(shot?.implemented).toBe(true);
  });

  it("forgeui_ping returns ok", async () => {
    const r = (await callMcpTool("forgeui_ping", {})) as {
      ok: boolean;
      server: string;
      version: string;
      toolCount: number;
      implementedToolCount: number;
    };
    expect(r).toMatchObject({ ok: true, server: "forgeui-mcp", version: "0.1.0" });
    expect(r.toolCount).toBe(12);
    expect(r.implementedToolCount).toBe(12);
  });

  it("get_editor_state reads hello project", async () => {
    const r = (await callMcpTool("forgeui_get_editor_state", {
      projectRoot: templateRoot,
    })) as { ok: boolean; project: { name: string }; screenIds: string[] };
    expect(r.ok).toBe(true);
    expect(r.project.name).toBe("hello_dual");
    expect(r.screenIds).toEqual(["home", "settings"]);
  });

  it("batch_get project summary + validate", async () => {
    const r = (await callMcpTool("forgeui_batch_get", {
      projectRoot: templateRoot,
      requests: [{ type: "get_project_summary" }, { type: "validate" }],
    })) as { results: Array<{ ok: boolean }> };
    expect(r.results[0]?.ok).toBe(true);
    expect(r.results[1]?.ok).toBe(true);
  });

  it("batch_get get_node + list_widget_types + list_assets", async () => {
    const r = (await callMcpTool("forgeui_batch_get", {
      projectRoot: templateRoot,
      requests: [
        { type: "get_node", screenId: "home", nodeId: "lbl_title" },
        { type: "list_widget_types" },
        { type: "list_assets" },
      ],
    })) as {
      results: Array<{ ok: boolean; data?: { type?: string; id?: string; images?: unknown[] } }>;
    };
    expect(r.results[0]?.ok).toBe(true);
    expect(r.results[0]?.data?.id).toBe("lbl_title");
    expect(r.results[0]?.data?.type).toBe("label");
    expect(r.results[1]?.ok).toBe(true);
    expect(Array.isArray(r.results[1]?.data)).toBe(true);
    expect((r.results[1]?.data as unknown[]).length).toBeGreaterThan(30);
    expect(r.results[2]?.ok).toBe(true);
    expect(r.results[2]?.data?.images).toBeDefined();
  });

  it("batch_get widget spec + event metadata + list_events", async () => {
    const r = (await callMcpTool("forgeui_batch_get", {
      projectRoot: templateRoot,
      requests: [
        { type: "get_widget_spec", widgetType: "button" },
        { type: "list_event_triggers" },
        { type: "list_event_action_types" },
        { type: "list_events", screenId: "home", targetId: "btn_next" },
      ],
    })) as {
      results: Array<{ ok: boolean; data?: { type?: string; events?: unknown[] } | string[] }>;
    };
    expect(r.results[0]?.ok).toBe(true);
    expect(r.results[0]?.data?.type).toBe("button");
    expect(r.results[1]?.ok).toBe(true);
    expect(r.results[1]?.data).toContain("CLICKED");
    expect(r.results[2]?.ok).toBe(true);
    expect(r.results[2]?.data).toContain("CHANGE_SCREEN");
    expect(r.results[3]?.ok).toBe(true);
    expect(Array.isArray(r.results[3]?.data)).toBe(true);
    expect((r.results[3]?.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("batch_get get_editor_state + get_page_screenshot aliases", async () => {
    const r = (await callMcpTool("forgeui_batch_get", {
      projectRoot: templateRoot,
      requests: [
        { type: "get_editor_state", screenId: "home", includeSpecs: false },
        { type: "get_page_screenshot", screenId: "home", maxWidth: 320 },
      ],
    })) as {
      results: Array<{ ok: boolean; data?: { project?: { name: string }; base64?: string } }>;
    };
    expect(r.results[0]?.ok).toBe(true);
    expect(r.results[0]?.data?.project?.name).toBe("hello_dual");
    expect(r.results[1]?.ok).toBe(true);
    expect(r.results[1]?.data?.base64).toMatch(/^iVBOR/);
  });

  it("batch_update adds button to hello home", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mcp-add-"));
    fs.cpSync(templateRoot, tmp, { recursive: true });
    const r = (await callMcpTool("forgeui_batch_update", {
      projectRoot: tmp,
      operations: [
        {
          type: "add_node",
          screenId: "home",
          parentId: "home",
          widgetType: "button",
          name: "mcp_btn",
        },
      ],
    })) as { ok: boolean; results: Array<{ ok: boolean }> };
    expect(r.ok).toBe(true);
    expect(r.results[0]?.ok).toBe(true);
    const reopened = openProject(tmp);
    expect(reopened.screens.get("home")!.children.some((c) => c.name === "mcp_btn")).toBe(true);
  });

  it("forgeui_get_page_screenshot returns wireframe PNG", async () => {
    const r = (await callMcpTool("forgeui_get_page_screenshot", {
      projectRoot: templateRoot,
      screenId: "home",
      maxWidth: 240,
    })) as { ok: boolean; mime: string; base64: string; width: number; height: number; mode: string };
    expect(r.ok).toBe(true);
    expect(r.mime).toBe("image/png");
    expect(r.mode).toBe("wireframe");
    expect(r.width).toBe(240);
    expect(r.base64.length).toBeGreaterThan(100);
    const buf = Buffer.from(r.base64, "base64");
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("forgeui_create_image_asset imports sized PNG", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mcp-img-"));
    fs.cpSync(templateRoot, tmp, { recursive: true });
    const png = path.join(tmp, "icon_test.png");
    writeTestPng(png, 32, 32);
    const r = (await callMcpTool("forgeui_create_image_asset", {
      projectRoot: tmp,
      name: "icon_test",
      imagePath: png,
      targetWidth: 32,
      targetHeight: 32,
    })) as { ok: boolean; assetId: string; relativePath: string };
    expect(r.ok).toBe(true);
    expect(r.assetId).toBe("icon_test");
    expect(fs.existsSync(path.join(tmp, r.relativePath))).toBe(true);
    const loaded = openProject(tmp);
    expect(loaded.project.assets?.images?.some((a) => (typeof a === "string" ? false : a.id === "icon_test"))).toBe(
      true,
    );
  });

  it("forgeui_create_image_asset rejects size mismatch", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mcp-bad-"));
    fs.cpSync(templateRoot, tmp, { recursive: true });
    const png = path.join(tmp, "bad.png");
    writeTestPng(png, 16, 16);
    await expect(
      callMcpTool("forgeui_create_image_asset", {
        projectRoot: tmp,
        name: "bad_icon",
        imagePath: png,
        targetWidth: 32,
        targetHeight: 32,
      }),
    ).rejects.toThrow(/IMAGE_SIZE_MISMATCH/);
  });
});

describe("applyMutation (AR-020)", () => {
  it("validates after mutation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mut-"));
    fs.cpSync(templateRoot, tmp, { recursive: true });
    const loaded = openProject(tmp);
    const result = applyMutation(loaded, () => {
      updateNodeProps(loaded, "home", "lbl_title", {
        props: { text: "Mutated" },
      });
    });
    expect(result.ok).toBe(true);
    const again = openProject(tmp);
    const lbl = again.screens.get("home")!.children.find((c) => c.id === "lbl_title");
    expect(lbl?.props.text).toBe("Mutated");
  });
});
