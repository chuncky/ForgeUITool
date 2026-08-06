import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, openProject } from "@forgeui/core";
import { callMcpTool, listMcpTools } from "@forgeui/mcp";

describe("MCP switch_language + animations", () => {
  it("lists new tools", () => {
    const names = listMcpTools().map((t) => t.name);
    expect(names).toContain("forgeui_switch_language");
    expect(names).toContain("forgeui_list_animations");
    expect(names).toContain("forgeui_upsert_animation");
  });

  it("switch_language enables previewLocale", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mcp-i18n-"));
    createProject({ root: tmp, name: "mcp-i18n", fromTemplate: "blank" });
    const r = (await callMcpTool("forgeui_switch_language", {
      projectRoot: tmp,
      locale: "zh-CN",
    })) as { ok: boolean; locale: string };
    expect(r.ok).toBe(true);
    expect(r.locale).toBe("zh-CN");
    const loaded = openProject(tmp);
    expect(loaded.project.i18n?.enabled).toBe(true);
    expect(loaded.project.i18n?.previewLocale).toBe("zh-CN");
  });

  it("upsert_animation creates track then list returns it", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mcp-anim-"));
    createProject({ root: tmp, name: "mcp-anim", fromTemplate: "blank" });
    const up = (await callMcpTool("forgeui_upsert_animation", {
      projectRoot: tmp,
      name: "fade",
      duration: 500,
      nodeId: "home",
      property: "opacity",
    })) as { ok: boolean; animation: { id: string; trackCount: number } };
    expect(up.ok).toBe(true);
    expect(up.animation.trackCount).toBe(1);

    const list = (await callMcpTool("forgeui_list_animations", { projectRoot: tmp })) as {
      ok: boolean;
      animations: Array<{ id: string; trackCount: number }>;
    };
    expect(list.ok).toBe(true);
    expect(list.animations).toHaveLength(1);
    expect(list.animations[0]?.trackCount).toBe(1);
  });
});
