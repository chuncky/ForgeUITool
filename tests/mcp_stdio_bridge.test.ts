import http from "node:http";
import { describe, expect, it } from "vitest";
import {
  encodeMcpMessage,
  handleJsonRpcRequest,
  McpFrameParser,
  bridgeInvoke,
  bridgeBaseUrl,
} from "@forgeui/mcp";

describe("MCP stdio + Bridge (Loop#12)", () => {
  it("handleJsonRpcRequest initialize returns serverInfo", async () => {
    const res = await handleJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res?.result).toMatchObject({
      serverInfo: { name: "forgeui-mcp-server" },
    });
  });

  it("handleJsonRpcRequest tools/list includes forgeui_ping", async () => {
    const res = await handleJsonRpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = (res?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.some((t) => t.name === "forgeui_ping")).toBe(true);
  });

  it("McpFrameParser decodes Content-Length framed message", () => {
    const parser = new McpFrameParser();
    const frame = encodeMcpMessage({ jsonrpc: "2.0", id: 3, method: "ping" });
    const msgs = parser.push(frame);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.method).toBe("ping");
  });

  it("bridgeInvoke reaches mock HTTP bridge", async () => {
    const server = http.createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/bridge/invoke") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, data: { ok: true, server: "test-bridge" } }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    process.env.FORGEUI_BRIDGE = `http://127.0.0.1:${port}`;
    try {
      const result = await bridgeInvoke("ping", {});
      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ server: "test-bridge" });
      expect(bridgeBaseUrl()).toContain(String(port));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      delete process.env.FORGEUI_BRIDGE;
    }
  });
});
