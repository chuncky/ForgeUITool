import http from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";

const OPERATION_TO_TOOL = {
  ping: "forgeui_ping",
  get_editor_state: "forgeui_get_editor_state",
  batch_get: "forgeui_batch_get",
  batch_update: "forgeui_batch_update",
  update_node: "forgeui_update_node",
  add_node_tree: "forgeui_add_node_tree",
  screenshot: "forgeui_get_page_screenshot",
  import_image: "forgeui_create_image_asset",
  generate: "forgeui_generate",
};

/** Compare aiWorkspacePath ignoring slash/case differences on Windows. */
export function sameAiWorkspacePath(a, b) {
  if (!a || !b) return false;
  const norm = (p) => {
    const resolved = path.resolve(String(p)).replace(/[/\\]+/g, path.sep);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return norm(a) === norm(b);
}

/**
 * ForgeUI Designer HTTP Bridge (127.0.0.1:39201).
 * @param {object} opts
 * @param {number} [opts.port]
 * @param {string} [opts.repoRoot]
 * @param {() => { ready: boolean; busy: boolean; projectRoot: string | null; aiWorkspacePath: string | null }} opts.getContext
 * @param {(tool: string, args: Record<string, unknown>) => Promise<unknown>} opts.callTool
 */
export function createForgeUiBridge(opts) {
  const port = opts.port ?? 39201;
  /** @type {import('node:http').Server | null} */
  let server = null;

  function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(text),
    });
    res.end(text);
  }

  async function handleInvoke(body) {
    const ctx = opts.getContext();
    const operation = body?.operation ?? "ping";

    if (operation === "ping") {
      return {
        ok: true,
        data: {
          ok: true,
          server: "forgeui-bridge",
          status: ctx.ready ? "READY" : "NOT_IN_WORKSPACE",
          projectRoot: ctx.projectRoot,
          busy: ctx.busy,
        },
      };
    }

    if (!ctx.ready || !ctx.projectRoot) {
      return {
        ok: false,
        error: {
          code: "NOT_IN_WORKSPACE",
          message: "Designer is not in workspace with an open project.",
        },
      };
    }

    if (ctx.busy && operation !== "screenshot" && operation !== "ping") {
      return {
        ok: false,
        error: {
          code: "PREVIEW_BUSY",
          message: "Preview/build in progress; Bridge writes paused.",
        },
      };
    }

    if (body.aiWorkspacePath && ctx.aiWorkspacePath && !sameAiWorkspacePath(body.aiWorkspacePath, ctx.aiWorkspacePath)) {
      return {
        ok: false,
        error: {
          code: "AI_WORKSPACE_MISMATCH",
          message: "aiWorkspacePath does not match open Designer workspace.",
        },
      };
    }

    const tool = OPERATION_TO_TOOL[operation];
    if (!tool) {
      return {
        ok: false,
        error: { code: "NOT_IMPLEMENTED", message: `Unknown operation: ${operation}` },
      };
    }

    const params = body.params ?? {};
    const args = {
      projectRoot: ctx.projectRoot,
      ...params,
    };
    if (body.aiWorkspacePath) args.aiWorkspacePath = body.aiWorkspacePath;

    try {
      const data = await opts.callTool(tool, args);
      return { ok: true, data, warnings: [] };
    } catch (e) {
      return {
        ok: false,
        error: {
          code: e.code ?? "BRIDGE_ERROR",
          message: e.message ?? String(e),
        },
      };
    }
  }

  function start() {
    if (server) return server;
    server = http.createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/bridge/ping") {
        const ctx = opts.getContext();
        sendJson(res, 200, {
          ok: true,
          status: ctx.ready ? "READY" : "NOT_IN_WORKSPACE",
          projectRoot: ctx.projectRoot,
        });
        return;
      }

      if (req.method !== "POST" || req.url !== "/bridge/invoke") {
        sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Use POST /bridge/invoke" } });
        return;
      }

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        sendJson(res, 400, { ok: false, error: { code: "BAD_JSON", message: "Invalid JSON body" } });
        return;
      }

      const result = await handleInvoke(body);
      sendJson(res, result.ok ? 200 : 503, result);
    });

    server.listen(port, "127.0.0.1");
    return server;
  }

  function stop() {
    if (server) {
      server.close();
      server = null;
    }
  }

  return { start, stop, port };
}

export async function loadMcpCallTool(repoRoot) {
  const href = pathToFileURL(path.join(repoRoot, "packages/mcp/dist/index.js")).href;
  const mcp = await import(href);
  return mcp.callMcpTool.bind(mcp);
}
