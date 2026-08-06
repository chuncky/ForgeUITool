import { ErrorCodes, ForgeError } from "@forgeui/shared";
import { bridgeOperationForTool, toolForBridgeOperation } from "./operation-map.js";

export interface BridgeInvokeResult {
  ok: boolean;
  data?: unknown;
  warnings?: string[];
  error?: { code: string; message: string };
}

export function bridgeBaseUrl(): string {
  return process.env.FORGEUI_BRIDGE?.replace(/\/$/, "") ?? "http://127.0.0.1:39201";
}

export async function bridgeInvoke(
  operation: string,
  params: Record<string, unknown> = {},
  aiWorkspacePath?: string,
): Promise<BridgeInvokeResult> {
  const tool = toolForBridgeOperation(operation);
  if (!tool && operation !== "ping") {
    throw new ForgeError(ErrorCodes.E_MCP_NOT_IMPL, `Unknown bridge operation: ${operation}`);
  }

  const body = {
    operation,
    aiWorkspacePath,
    params,
  };

  let res: Response;
  try {
    res = await fetch(`${bridgeBaseUrl()}/bridge/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ForgeError(
      ErrorCodes.E_MCP_BRIDGE,
      `Bridge unreachable at ${bridgeBaseUrl()}: ${(e as Error).message}`,
    );
  }

  const json = (await res.json()) as BridgeInvokeResult;
  if (!json.ok) {
    throw new ForgeError(
      json.error?.code ?? ErrorCodes.E_MCP_BRIDGE,
      json.error?.message ?? `Bridge HTTP ${res.status}`,
    );
  }
  return json;
}

export async function bridgeCallTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const operation = bridgeOperationForTool(toolName as import("./tools.js").McpToolName);
  const aiWorkspacePath =
    typeof args.aiWorkspacePath === "string" ? args.aiWorkspacePath : undefined;
  const { aiWorkspacePath: _drop, ...params } = args;
  const result = await bridgeInvoke(operation, params, aiWorkspacePath);
  return result.data;
}
