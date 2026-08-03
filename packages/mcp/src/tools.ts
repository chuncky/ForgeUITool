import fs from "node:fs";
import path from "node:path";
import {
  buildEditorState,
  openProject,
  summarizeScreenTree,
  validateProjectDir,
} from "@forgeui/core";
import { generate } from "@forgeui/codegen";
import { ErrorCodes, ForgeError } from "@forgeui/shared";

/** Frozen public tool names — see docs/嵌入式UI工具_MCP接口详细设计说明.md §5.1 */
export const MCP_TOOL_NAMES = [
  "forgeui_get_editor_state",
  "forgeui_batch_get",
  "forgeui_batch_update",
  "forgeui_update_node",
  "forgeui_add_node_tree",
  "forgeui_get_page_screenshot",
  "forgeui_create_image_asset",
  "forgeui_generate",
  "forgeui_ping",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export interface McpToolDescriptor {
  name: McpToolName;
  description: string;
  implemented: boolean;
}

export function listMcpTools(): McpToolDescriptor[] {
  return [
    {
      name: "forgeui_ping",
      description: "Bridge / MCP server health check",
      implemented: true,
    },
    {
      name: "forgeui_get_editor_state",
      description: "Project + screen snapshot for AI first read",
      implemented: true,
    },
    {
      name: "forgeui_batch_get",
      description: "Ordered batch reads (partial V2)",
      implemented: true,
    },
    {
      name: "forgeui_batch_update",
      description: "Ordered batch writes via Bridge (V2)",
      implemented: false,
    },
    {
      name: "forgeui_update_node",
      description: "Coarse single-node update (V2)",
      implemented: false,
    },
    {
      name: "forgeui_add_node_tree",
      description: "Nested node create (V2)",
      implemented: false,
    },
    {
      name: "forgeui_get_page_screenshot",
      description: "Canvas PNG for visual check (V2)",
      implemented: false,
    },
    {
      name: "forgeui_create_image_asset",
      description: "Import PNG asset (V2)",
      implemented: false,
    },
    {
      name: "forgeui_generate",
      description: "Trigger CodeGen only; never bypass custom/",
      implemented: true,
    },
  ];
}

function readWorkspaceProjectRoot(aiWorkspacePath: string): string {
  const ws = path.resolve(aiWorkspacePath);
  const metaPath = path.join(ws, "workspace.json");
  if (!fs.existsSync(metaPath)) {
    throw new ForgeError(
      ErrorCodes.E_MCP_WORKSPACE,
      `workspace.json not found in ${ws}`,
    );
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { projectRoot?: string };
  if (!meta.projectRoot) {
    throw new ForgeError(ErrorCodes.E_MCP_WORKSPACE, "workspace.json missing projectRoot");
  }
  return path.resolve(meta.projectRoot);
}

export function resolveProjectRoot(args: Record<string, unknown>): string {
  if (typeof args.projectRoot === "string" && args.projectRoot) {
    return path.resolve(args.projectRoot);
  }
  if (typeof args.aiWorkspacePath === "string" && args.aiWorkspacePath) {
    return readWorkspaceProjectRoot(args.aiWorkspacePath);
  }
  throw new ForgeError(
    ErrorCodes.E_MCP_WORKSPACE,
    "projectRoot or aiWorkspacePath is required",
  );
}

export async function callMcpTool(
  name: McpToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "forgeui_ping":
      return { ok: true, server: "forgeui_designer", version: "0.1.0-stub" };

    case "forgeui_get_editor_state": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const screenId =
        (typeof args.screenId === "string" ? args.screenId : undefined) ??
        loaded.project.defaultScreen;
      const screen = loaded.screens.get(screenId);
      if (!screen) {
        throw new ForgeError(ErrorCodes.E_SEM_001, `screen not found: ${screenId}`);
      }
      const base = buildEditorState(loaded, {
        screenId,
        includeWidgetTypes: args.includeWidgetTypes !== false,
      });
      return {
        ok: true,
        ...base,
        screenTree: summarizeScreenTree(screen),
      };
    }

    case "forgeui_batch_get": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const requests = args.requests as Array<{ type: string; screenId?: string; ref?: string }>;
      if (!Array.isArray(requests) || !requests.length) {
        throw new ForgeError(ErrorCodes.E_MCP_ARGS, "batch_get requires non-empty requests[]");
      }
      const results = requests.map((req) => {
        try {
          if (req.type === "get_project_summary") {
            return {
              ref: req.ref,
              ok: true,
              data: {
                name: loaded.project.name,
                platform: loaded.project.platform,
                lvglVersion: loaded.project.lvglVersion,
                deliveryMode: loaded.project.deliveryMode,
                screens: loaded.project.screens.map((s) => s.id),
              },
            };
          }
          if (req.type === "list_screens") {
            return { ref: req.ref, ok: true, data: loaded.project.screens.map((s) => s.id) };
          }
          if (req.type === "get_screen_tree") {
            const sid = req.screenId ?? loaded.project.defaultScreen;
            const screen = loaded.screens.get(sid);
            if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${sid} not found`);
            return { ref: req.ref, ok: true, data: summarizeScreenTree(screen) };
          }
          if (req.type === "validate") {
            const v = validateProjectDir(root);
            return { ref: req.ref, ok: v.ok, data: v };
          }
          return {
            ref: req.ref,
            ok: false,
            error: { code: ErrorCodes.E_MCP_NOT_IMPL, message: `batch_get type ${req.type} not implemented` },
          };
        } catch (e) {
          const err = e as Error;
          return {
            ref: req.ref,
            ok: false,
            error: {
              code: err instanceof ForgeError ? err.code : ErrorCodes.E_MCP_NOT_IMPL,
              message: err.message,
            },
          };
        }
      });
      return { ok: true, results };
    }

    case "forgeui_generate": {
      const root = resolveProjectRoot(args);
      const result = await generate(root, {
        cleanGenerated: args.cleanGenerated === true,
      });
      return result;
    }

    case "forgeui_batch_update":
    case "forgeui_update_node":
    case "forgeui_add_node_tree":
    case "forgeui_get_page_screenshot":
    case "forgeui_create_image_asset":
      throw new ForgeError(
        ErrorCodes.E_MCP_NOT_IMPL,
        `${name} requires Designer Bridge (V2); use GUI or CLI for writes`,
      );

    default:
      throw new ForgeError(ErrorCodes.E_MCP_NOT_IMPL, `Unknown tool: ${name as string}`);
  }
}
