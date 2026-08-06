import { listMcpTools, callMcpTool, type McpToolName } from "./tools.js";
import { bridgeCallTool } from "./bridge-client.js";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function toolInputSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      projectRoot: { type: "string", description: "Absolute path to ForgeUI project" },
      aiWorkspacePath: { type: "string", description: "Path to .forge-ai workspace directory" },
    },
    additionalProperties: true,
  };
}

export async function dispatchMcpToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (process.env.FORGEUI_BRIDGE) {
    return bridgeCallTool(name, args);
  }
  return callMcpTool(name as McpToolName, args);
}

export async function handleJsonRpcRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;
  const method = req.method ?? "";

  if (method === "notifications/initialized" || method.startsWith("notifications/")) {
    return null;
  }

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "forgeui-mcp-server", version: "0.1.0" },
        },
      };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: listMcpTools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: toolInputSchema(),
          })),
        },
      };
    }

    if (method === "tools/call") {
      const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "tools/call requires name" } };
      }
      const data = await dispatchMcpToolCall(params.name, params.arguments ?? {});
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        },
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (e) {
    const err = e as Error;
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: err.message }],
        isError: true,
      },
    };
  }
}

export function encodeMcpMessage(payload: object): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export class McpFrameParser {
  private buffer = "";

  push(chunk: string): JsonRpcRequest[] {
    this.buffer += chunk;
    const out: JsonRpcRequest[] = [];
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      out.push(JSON.parse(body) as JsonRpcRequest);
    }
    return out;
  }
}

export async function runStdioMcpServer(): Promise<void> {
  const parser = new McpFrameParser();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk: string) => {
    for (const req of parser.push(chunk)) {
      const res = await handleJsonRpcRequest(req);
      if (res && process.stdout.writable) {
        process.stdout.write(encodeMcpMessage(res));
      }
    }
  });
}
