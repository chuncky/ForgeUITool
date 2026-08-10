/**
 * AI Design acceptance — MCP/Bridge paths that Cursor uses.
 *
 * Layers:
 * 1) Direct MCP tool API (same handlers Cursor stdio calls)
 * 2) Content-Length stdio JSON-RPC (Cursor transport)
 * 3) Designer Bridge HTTP (+ aiWorkspacePath), mirroring live Designer
 * 4) Optional live Bridge: FORGEUI_LIVE_BRIDGE=1 against running Designer
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  findNode,
  listPaletteWidgetSpecs,
  openProject,
  type WidgetSpec,
} from "@forgeui/core";
import {
  callMcpTool,
  encodeMcpMessage,
  handleJsonRpcRequest,
  McpFrameParser,
} from "@forgeui/mcp";
import { createForgeUiBridge } from "../apps/designer/electron/bridge.mjs";
import { ensureForgeAiWorkspace } from "../apps/designer/electron/ai-workspace.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function cloneHelloProject(): { root: string; aiDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ai-case-"));
  tmpDirs.push(root);
  fs.cpSync(templateRoot, root, { recursive: true });
  const aiDir = ensureForgeAiWorkspace(root, { bridgePort: 39201 });
  return { root, aiDir };
}

function parseFramedJsonRpc(raw: string): Array<Record<string, unknown>> {
  const parser = new McpFrameParser();
  return parser.push(raw) as Array<Record<string, unknown>>;
}

async function stdioToolsCall(name: string, args: Record<string, unknown>) {
  const req = {
    jsonrpc: "2.0",
    id: 42,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const res = await handleJsonRpcRequest(req);
  expect(res?.error).toBeUndefined();
  const content = (res?.result as { content?: Array<{ text?: string }>; isError?: boolean })?.content;
  expect(res?.result && (res.result as { isError?: boolean }).isError).not.toBe(true);
  const text = content?.[0]?.text ?? "";
  return JSON.parse(text) as Record<string, unknown>;
}

/** Pick a safe prop patch for update coverage; null → frame-only update. */
function samplePropPatch(spec: WidgetSpec): Record<string, unknown> | null {
  for (const p of spec.props) {
    if (p.type === "text") return { [p.name]: `AI_${spec.type}` };
    if (p.type === "boolean") return { [p.name]: p.default !== true };
    if (p.type === "number") {
      const base = typeof p.default === "number" ? p.default : 0;
      return { [p.name]: base + 1 };
    }
    if (p.type === "enum" && Array.isArray(p.enum) && p.enum.length) {
      const alt = p.enum.find((e) => e !== p.default) ?? p.enum[0];
      return { [p.name]: alt };
    }
    if (p.type === "range") {
      return { [p.name]: { min: 0, max: 80 } };
    }
  }
  return null;
}

const palette = listPaletteWidgetSpecs();
const paletteTypes = palette.map((w) => w.type);

describe("AI design acceptance — Cursor stdio path", () => {
  const prevBridge = process.env.FORGEUI_BRIDGE;
  afterEach(() => {
    if (prevBridge === undefined) delete process.env.FORGEUI_BRIDGE;
    else process.env.FORGEUI_BRIDGE = prevBridge;
  });

  it("initialize + tools/list exposes forgeui write tools", async () => {
    delete process.env.FORGEUI_BRIDGE;
    const init = await handleJsonRpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(init?.result).toMatchObject({
      serverInfo: { name: "forgeui-mcp-server" },
    });

    const listed = await handleJsonRpcRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const names = ((listed?.result as { tools: Array<{ name: string }> }).tools ?? []).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "forgeui_get_editor_state",
        "forgeui_batch_update",
        "forgeui_add_node_tree",
        "forgeui_update_node",
      ]),
    );
  });

  it("framed tools/call adds a button (Cursor transport)", async () => {
    delete process.env.FORGEUI_BRIDGE;
    const { root } = cloneHelloProject();
    const frame = encodeMcpMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "forgeui_add_node_tree",
        arguments: {
          projectRoot: root,
          screenId: "home",
          parentId: "home",
          tree: {
            type: "button",
            name: "stdio_btn",
            frame: { x: 24, y: 24, w: 100, h: 40 },
            props: { text: "StdioBtn" },
          },
        },
      },
    });
    const msgs = parseFramedJsonRpc(frame);
    expect(msgs).toHaveLength(1);
    const res = await handleJsonRpcRequest(
      msgs[0] as { jsonrpc?: string; id?: number; method?: string; params?: Record<string, unknown> },
    );
    expect(res?.error).toBeUndefined();
    const payload = JSON.parse(
      ((res?.result as { content: Array<{ text: string }> }).content[0]?.text ?? "{}") as string,
    ) as { ok: boolean; results: Array<{ ok: boolean; data?: { nodeId?: string } }> };
    expect(payload.ok).toBe(true);
    expect(payload.results[0]?.ok).toBe(true);

    const loaded = openProject(root);
    const node = loaded.screens.get("home")!.children.find((c) => c.name === "stdio_btn");
    expect(node?.type).toBe("button");
    expect(node?.props.text).toBe("StdioBtn");
  });

  it("stdio tools/call get_editor_state then update_node", async () => {
    delete process.env.FORGEUI_BRIDGE;
    const { root } = cloneHelloProject();
    const state = (await stdioToolsCall("forgeui_get_editor_state", {
      projectRoot: root,
      screenId: "home",
    })) as { ok: boolean; screenIds: string[] };
    expect(state.ok).toBe(true);
    expect(state.screenIds).toContain("home");

    const add = (await stdioToolsCall("forgeui_batch_update", {
      projectRoot: root,
      operations: [
        {
          type: "add_node",
          screenId: "home",
          parentId: "home",
          widgetType: "label",
          name: "stdio_lbl",
          ref: "n1",
        },
      ],
    })) as { ok: boolean; results: Array<{ ok: boolean; data?: { nodeId: string } }> };
    expect(add.ok).toBe(true);
    const nodeId = add.results[0]?.data?.nodeId;
    expect(nodeId).toBeTruthy();

    const upd = (await stdioToolsCall("forgeui_update_node", {
      projectRoot: root,
      screenId: "home",
      nodeId,
      props: { text: "UpdatedByStdio" },
    })) as { ok: boolean };
    expect(upd.ok).toBe(true);

    const again = openProject(root);
    expect(findNode(again.screens.get("home")!, nodeId!)?.props.text).toBe("UpdatedByStdio");
  });
});

describe("AI design acceptance — palette widget add + update matrix", () => {
  let sharedRoot = "";

  it("palette has a stable widget surface for AI", () => {
    expect(paletteTypes.length).toBeGreaterThanOrEqual(20);
    expect(paletteTypes).toContain("button");
    expect(paletteTypes).toContain("label");
    expect(paletteTypes).not.toContain("screen");
  });

  it("add + update every palette widget on one project", async () => {
    delete process.env.FORGEUI_BRIDGE;
    const { root } = cloneHelloProject();
    sharedRoot = root;

    for (const widgetType of paletteTypes) {
      const spec = palette.find((w) => w.type === widgetType)!;
      const name = `ai_${widgetType}`;

      const add = (await callMcpTool("forgeui_batch_update", {
        projectRoot: root,
        operations: [
          {
            type: "add_node",
            screenId: "home",
            parentId: "home",
            widgetType,
            name,
          },
        ],
      })) as { ok: boolean; results: Array<{ ok: boolean; data?: { nodeId: string } }> };

      expect(add.ok, `add ${widgetType} failed: ${JSON.stringify(add)}`).toBe(true);
      const nodeId = add.results[0]?.data?.nodeId;
      expect(nodeId, `missing nodeId for ${widgetType}`).toBeTruthy();

      const propPatch = samplePropPatch(spec);
      const updateOps =
        propPatch != null
          ? {
              type: "update_node" as const,
              screenId: "home",
              nodeId: nodeId!,
              props: propPatch,
            }
          : {
              type: "update_node" as const,
              screenId: "home",
              nodeId: nodeId!,
              frame: {
                x: 48,
                y: 48,
                w: Math.max(spec.defaultFrame.w, 40),
                h: Math.max(spec.defaultFrame.h, 24),
              },
            };

      const upd = (await callMcpTool("forgeui_batch_update", {
        projectRoot: root,
        operations: [updateOps],
      })) as { ok: boolean; results: Array<{ ok: boolean }> };
      expect(upd.ok, `update ${widgetType} failed: ${JSON.stringify(upd)}`).toBe(true);

      const loaded = openProject(root);
      const node = findNode(loaded.screens.get("home")!, nodeId!);
      expect(node?.type).toBe(widgetType);
      expect(node?.name).toBe(name);
      if (propPatch) {
        for (const [k, v] of Object.entries(propPatch)) {
          expect(node!.props[k], `${widgetType}.${k}`).toEqual(v);
        }
      } else {
        expect(node!.frame.x).toBe(48);
      }
    }

    const final = openProject(sharedRoot);
    const homeKids = final.screens.get("home")!.children;
    for (const widgetType of paletteTypes) {
      expect(
        homeKids.some((c) => c.type === widgetType && c.name === `ai_${widgetType}`),
        `missing ${widgetType} on home`,
      ).toBe(true);
    }
  });

  it("forgeui_add_node_tree builds nested container + button", async () => {
    delete process.env.FORGEUI_BRIDGE;
    const { root } = cloneHelloProject();
    const r = (await callMcpTool("forgeui_add_node_tree", {
      projectRoot: root,
      screenId: "home",
      parentId: "home",
      tree: {
        type: "container",
        name: "ai_card",
        frame: { x: 10, y: 10, w: 200, h: 120 },
        children: [
          {
            type: "button",
            name: "ai_card_btn",
            frame: { x: 8, y: 8, w: 100, h: 36 },
            props: { text: "CardBtn" },
          },
        ],
      },
    })) as { ok: boolean; results: Array<{ ok: boolean; data?: { nodeId: string } }> };
    expect(r.ok).toBe(true);
    const cardId = r.results[0]?.data?.nodeId;
    const loaded = openProject(root);
    const card = findNode(loaded.screens.get("home")!, cardId!);
    expect(card?.type).toBe("container");
    expect(card?.children.some((c) => c.name === "ai_card_btn" && c.type === "button")).toBe(true);
  });
});

describe("AI design acceptance — Designer Bridge HTTP", () => {
  it("bridge invoke add_node_tree with matching aiWorkspacePath", async () => {
    const { root, aiDir } = cloneHelloProject();
    const bridge = createForgeUiBridge({
      port: 0,
      getContext: () => ({
        ready: true,
        busy: false,
        projectRoot: root,
        aiWorkspacePath: aiDir,
      }),
      callTool: (tool, args) => callMcpTool(tool, args),
    });
    const server = bridge.start();
    await new Promise<void>((resolve) => {
      if (server.listening) resolve();
      else server.once("listening", () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    expect(port).toBeGreaterThan(0);

    try {
      const ping = await fetch(`http://127.0.0.1:${port}/bridge/ping`);
      expect(ping.ok).toBe(true);
      const pingBody = (await ping.json()) as { status: string };
      expect(pingBody.status).toBe("READY");

      const res = await fetch(`http://127.0.0.1:${port}/bridge/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "add_node_tree",
          aiWorkspacePath: aiDir.replace(/\//g, "\\"),
          params: {
            screenId: "home",
            parentId: "home",
            tree: {
              type: "button",
              name: "bridge_btn",
              props: { text: "ViaBridge" },
            },
          },
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { ok?: boolean; results?: Array<{ ok: boolean; data?: { nodeId: string } }> };
        error?: { code: string };
      };
      expect(body.ok).toBe(true);
      expect(body.data?.results?.[0]?.ok).toBe(true);

      const loaded = openProject(root);
      expect(loaded.screens.get("home")!.children.some((c) => c.name === "bridge_btn")).toBe(true);
    } finally {
      bridge.stop();
    }
  });

  it("bridge rejects mismatched aiWorkspacePath", async () => {
    const { root, aiDir } = cloneHelloProject();
    const bridge = createForgeUiBridge({
      port: 0,
      getContext: () => ({
        ready: true,
        busy: false,
        projectRoot: root,
        aiWorkspacePath: aiDir,
      }),
      callTool: (tool, args) => callMcpTool(tool, args),
    });
    const server = bridge.start();
    await new Promise<void>((resolve) => {
      if (server.listening) resolve();
      else server.once("listening", () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : bridge.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/bridge/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_editor_state",
          aiWorkspacePath: path.join(root, ".wrong-ai"),
          params: {},
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe("AI_WORKSPACE_MISMATCH");
    } finally {
      bridge.stop();
    }
  });
});

describe("AI design acceptance — live Designer Bridge (optional)", () => {
  const live = process.env.FORGEUI_LIVE_BRIDGE === "1";

  it.skipIf(!live)("live Bridge READY and can add button to open project", async () => {
    const port = Number(process.env.FORGEUI_BRIDGE_PORT ?? 39201);
    const ping = await fetch(`http://127.0.0.1:${port}/bridge/ping`);
    expect(ping.ok).toBe(true);
    const pingBody = (await ping.json()) as { status: string; projectRoot?: string };
    expect(pingBody.status).toBe("READY");
    expect(pingBody.projectRoot).toBeTruthy();

    const aiDir = path.join(pingBody.projectRoot!, ".forge-ai");
    expect(fs.existsSync(path.join(aiDir, "workspace.json"))).toBe(true);

    const res = await fetch(`http://127.0.0.1:${port}/bridge/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "add_node_tree",
        aiWorkspacePath: aiDir,
        params: {
          tree: {
            type: "button",
            name: `live_ai_btn_${Date.now()}`,
            props: { text: "LiveAI" },
          },
        },
      }),
    });
    const body = (await res.json()) as { ok: boolean; error?: unknown };
    expect(body.ok, JSON.stringify(body)).toBe(true);
  });
});
