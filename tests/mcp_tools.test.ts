import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyMutation, openProject, updateNodeProps } from "@forgeui/core";
import { callMcpTool, listMcpTools } from "@forgeui/mcp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

describe("MCP tools (read path)", () => {
  it("lists forgeui_* tools from MCP design §5.1", () => {
    const names = listMcpTools().map((t) => t.name);
    expect(names).toContain("forgeui_get_editor_state");
    expect(names).toContain("forgeui_batch_get");
    expect(names).toContain("forgeui_ping");
    expect(names).not.toContain("forgeui_get_project_meta");
  });

  it("forgeui_ping returns ok", async () => {
    const r = await callMcpTool("forgeui_ping", {});
    expect(r).toMatchObject({ ok: true });
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

  it("batch_update still stub", async () => {
    await expect(
      callMcpTool("forgeui_batch_update", { projectRoot: templateRoot, operations: [] }),
    ).rejects.toThrow(/E_MCP_NOT_IMPL/);
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
