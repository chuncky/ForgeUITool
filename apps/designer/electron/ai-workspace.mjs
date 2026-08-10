import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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

Open **this folder** in Cursor / Codex / TRAE / TRAE CN, then use \`forgeui_designer\` MCP tools (\`forgeui_*\`).

- Bridge: \`http://127.0.0.1:${opts.bridgePort ?? 39201}\`
- Every MCP call must include \`aiWorkspacePath\` = absolute path to this directory.
- Designer writes enter an **AI transaction** — confirm via bottom bar before disk save.

Launch from Designer toolbar **AI设计 → 对应宿主** so MCP paths stay in sync. If tools are missing, fully quit the AI host and relaunch from **AI设计**.
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
 * Absolute Node path for MCP hosts. TRAE/Cursor GUI often spawn without user PATH,
 * so bare `"node"` fails and forgeui_* tools never register.
 */
export function resolveNodeExecutable() {
  if (process.platform === "win32") {
    try {
      const out = execFileSync("where", ["node"], { encoding: "utf8", windowsHide: true });
      const first = String(out)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)[0];
      if (first && fs.existsSync(first)) return first;
    } catch {
      /* ignore */
    }
    const pf = process.env.ProgramFiles || "C:\\Program Files";
    const cand = path.join(pf, "nodejs", "node.exe");
    if (fs.existsSync(cand)) return cand;
  } else {
    try {
      const out = execFileSync("which", ["node"], { encoding: "utf8" });
      const first = String(out).trim().split(/\n/)[0];
      if (first && fs.existsSync(first)) return first;
    } catch {
      /* ignore */
    }
  }
  if (typeof process.versions?.node === "string" && !process.versions.electron) {
    if (process.execPath && fs.existsSync(process.execPath)) return process.execPath;
  }
  return "node";
}

/**
 * @param {string} repoRoot
 * @param {number} [bridgePort]
 * @param {{ packaged?: boolean, execPath?: string, preferElectronAsNode?: boolean, appVersion?: string, nodeCommand?: string }} [opts]
 */
export function buildMcpConfigSnippet(repoRoot, bridgePort = 39201, opts = {}) {
  const serverPath = path.join(repoRoot, "packages/mcp/dist/server-main.js");
  const appVersion =
    typeof opts.appVersion === "string" && opts.appVersion.trim()
      ? opts.appVersion.trim()
      : "0.1.0";
  // Packaged + explicit flag: run MCP via Electron as Node (BK-style).
  // Otherwise use absolute node.exe so TRAE CN / Cursor GUI can spawn MCP without PATH.
  const useElectronAsNode = Boolean(opts.packaged && opts.preferElectronAsNode);
  const nodeCommand =
    (typeof opts.nodeCommand === "string" && opts.nodeCommand.trim()) || resolveNodeExecutable();
  const base = useElectronAsNode
    ? {
        type: "stdio",
        command: opts.execPath || "ForgeUI.exe",
        args: [serverPath],
        env: {
          ELECTRON_RUN_AS_NODE: "1",
          FORGEUI_BRIDGE: `http://127.0.0.1:${bridgePort}`,
        },
        appVersion,
      }
    : {
        type: "stdio",
        command: nodeCommand,
        args: [serverPath],
        env: {
          FORGEUI_BRIDGE: `http://127.0.0.1:${bridgePort}`,
        },
        appVersion,
      };
  return {
    mcpServers: {
      forgeui_designer: base,
    },
  };
}

export async function pingBridge(port = 39201) {
  const url = `http://127.0.0.1:${port}/bridge/ping`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
