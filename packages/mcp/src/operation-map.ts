import type { McpToolName } from "./tools.js";

/** Bridge HTTP `operation` → MCP tool name (§4.2). */
export const BRIDGE_OPERATION_TO_TOOL: Record<string, McpToolName> = {
  ping: "forgeui_ping",
  get_editor_state: "forgeui_get_editor_state",
  batch_get: "forgeui_batch_get",
  batch_update: "forgeui_batch_update",
  update_node: "forgeui_update_node",
  add_node_tree: "forgeui_add_node_tree",
  screenshot: "forgeui_get_page_screenshot",
  import_image: "forgeui_create_image_asset",
  generate: "forgeui_generate",
  validate: "forgeui_batch_get",
  switch_language: "forgeui_switch_language",
  list_animations: "forgeui_list_animations",
  upsert_animation: "forgeui_upsert_animation",
};

export const MCP_TOOL_TO_BRIDGE_OPERATION: Record<McpToolName, string> = {
  forgeui_ping: "ping",
  forgeui_get_editor_state: "get_editor_state",
  forgeui_batch_get: "batch_get",
  forgeui_batch_update: "batch_update",
  forgeui_update_node: "update_node",
  forgeui_add_node_tree: "add_node_tree",
  forgeui_get_page_screenshot: "screenshot",
  forgeui_create_image_asset: "import_image",
  forgeui_generate: "generate",
  forgeui_switch_language: "switch_language",
  forgeui_list_animations: "list_animations",
  forgeui_upsert_animation: "upsert_animation",
};

export function bridgeOperationForTool(name: McpToolName): string {
  return MCP_TOOL_TO_BRIDGE_OPERATION[name];
}

export function toolForBridgeOperation(operation: string): McpToolName | undefined {
  return BRIDGE_OPERATION_TO_TOOL[operation];
}
