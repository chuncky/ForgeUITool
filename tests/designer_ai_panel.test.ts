import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMcpConfigSnippet,
  ensureForgeAiWorkspace,
  isForgeAiWorkspaceReady,
} from "../apps/designer/electron/ai-workspace.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("AI design panel (Loop#19)", () => {
  it("ensureForgeAiWorkspace writes workspace.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-aiws-"));
    const aiDir = ensureForgeAiWorkspace(tmp, { bridgePort: 39201 });
    expect(aiDir).toContain(".forge-ai");
    expect(isForgeAiWorkspaceReady(tmp)).toBe(true);
    const ws = JSON.parse(fs.readFileSync(path.join(aiDir, "workspace.json"), "utf8"));
    expect(ws.projectRoot).toBe(path.resolve(tmp));
  });

  it("buildMcpConfigSnippet references server-main.js", () => {
    const cfg = buildMcpConfigSnippet(repoRoot);
    expect(cfg.mcpServers.forgeui_designer.args[0]).toContain("server-main.js");
    expect(cfg.mcpServers.forgeui_designer.env.FORGEUI_BRIDGE).toContain("39201");
  });

  it("AiAssistDialog is a functional panel", () => {
    const vue = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/AiAssistDialog.vue"),
      "utf8",
    );
    expect(vue).toContain("getAiPanelState");
    expect(vue).toContain("setupAiWorkspace");
    expect(vue).toContain("copyMcp");
    expect(vue).not.toContain("知道了");
  });

  it("electron exposes ai panel IPC", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"ai:getPanelState"');
    expect(main).toContain('"ai:setupWorkspace"');
    expect(preload).toContain("getAiPanelState");
  });
});
