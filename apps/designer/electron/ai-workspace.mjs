import fs from "node:fs";
import path from "node:path";

/**
 * Ensure `.forge-ai/` per MCP §3.3 — workspace.json + README for external IDE hosts.
 */
export function ensureForgeAiWorkspace(projectRoot, opts = {}) {
  const root = path.resolve(projectRoot);
  const aiDir = path.join(root, ".forge-ai");
  fs.mkdirSync(aiDir, { recursive: true });

  const workspace = {
    projectRoot: root,
    openedAt: new Date().toISOString(),
    designerVersion: opts.designerVersion ?? "0.1.0",
  };
  fs.writeFileSync(path.join(aiDir, "workspace.json"), `${JSON.stringify(workspace, null, 2)}\n`, "utf8");

  const readme = `# ForgeUI AI Workspace

Open **this folder** in Cursor (or compatible MCP host), then use \`forgeui_designer\` tools.

- Bridge: \`http://127.0.0.1:${opts.bridgePort ?? 39201}\`
- Every MCP call must include \`aiWorkspacePath\` = absolute path to this directory.
- Designer writes enter an **AI transaction** — confirm via bottom bar before disk save.

Launch from Designer toolbar **AI设计** so paths stay in sync.
`;
  fs.writeFileSync(path.join(aiDir, "README.md"), readme, "utf8");

  return aiDir;
}

export function forgeAiWorkspacePath(projectRoot) {
  return path.join(path.resolve(projectRoot), ".forge-ai");
}

export function isForgeAiWorkspaceReady(projectRoot) {
  const ws = path.join(forgeAiWorkspacePath(projectRoot), "workspace.json");
  return fs.existsSync(ws);
}

/**
 * @param {string} repoRoot
 * @param {number} [bridgePort]
 * @param {{ packaged?: boolean, execPath?: string }} [opts]
 */
export function buildMcpConfigSnippet(repoRoot, bridgePort = 39201, opts = {}) {
  const serverPath = path.join(repoRoot, "packages/mcp/dist/server-main.js");
  if (opts.packaged) {
    return {
      mcpServers: {
        forgeui_designer: {
          type: "stdio",
          command: opts.execPath || "ForgeUI.exe",
          args: [serverPath],
          env: {
            ELECTRON_RUN_AS_NODE: "1",
            FORGEUI_BRIDGE: `http://127.0.0.1:${bridgePort}`,
          },
        },
      },
    };
  }
  return {
    mcpServers: {
      forgeui_designer: {
        type: "stdio",
        command: "node",
        args: [serverPath],
        env: {
          FORGEUI_BRIDGE: `http://127.0.0.1:${bridgePort}`,
        },
      },
    },
  };
}

export async function pingBridge(port = 39201) {
  const url = `http://127.0.0.1:${port}/bridge/ping`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
