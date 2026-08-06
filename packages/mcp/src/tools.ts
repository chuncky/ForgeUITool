import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  buildEditorState,
  createAnimTrack,
  createTimelineAnimation,
  ensureI18n,
  findNode,
  getWidgetSpec,
  listPaletteWidgetSpecs,
  normalizeAnimations,
  normalizeFontAssets,
  openProject,
  saveProject,
  summarizeScreenTree,
  updateProjectMeta,
  validateProjectDir,
} from "@forgeui/core";
import type { Node, TimelineAnimation } from "@forgeui/core";
import { generate } from "@forgeui/codegen";
import { ErrorCodes, ForgeError } from "@forgeui/shared";
import { applyBatchUpdate, type BatchUpdateOperation } from "./batch-update.js";
import { createImageAssetForProject } from "./image-asset.js";
import { renderScreenWireframePng } from "./page-screenshot.js";

const require = createRequire(import.meta.url);
const MCP_PACKAGE_VERSION = (require("../package.json") as { version: string }).version;

const MCP_EVENT_ACTION_TYPES = [
  "CHANGE_SCREEN",
  "CALL_FUNCTION",
  "SET_PROP",
  "SWITCH_LANGUAGE",
  "PLAY_ANIMATION",
  "SET_VAR",
  "TOGGLE_VAR",
] as const;

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
  "forgeui_switch_language",
  "forgeui_list_animations",
  "forgeui_upsert_animation",
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
      implemented: true,
    },
    {
      name: "forgeui_update_node",
      description: "Coarse single-node update (V2)",
      implemented: true,
    },
    {
      name: "forgeui_add_node_tree",
      description: "Nested node create (V2)",
      implemented: true,
    },
    {
      name: "forgeui_get_page_screenshot",
      description: "Canvas PNG for visual check (V2)",
      implemented: true,
    },
    {
      name: "forgeui_create_image_asset",
      description: "Import PNG asset (V2)",
      implemented: true,
    },
    {
      name: "forgeui_generate",
      description: "Trigger CodeGen only; never bypass custom/",
      implemented: true,
    },
    {
      name: "forgeui_switch_language",
      description: "Set i18n previewLocale (and enable i18n) for canvas/codegen preview",
      implemented: true,
    },
    {
      name: "forgeui_list_animations",
      description: "List timeline animations (FR-071)",
      implemented: true,
    },
    {
      name: "forgeui_upsert_animation",
      description: "Create or update a timeline animation (+ optional track)",
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

function summarizeNode(node: Node): object {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    frame: node.frame,
    props: node.props,
    style: node.style,
    events: node.events,
    extraData: node.extraData,
    childCount: node.children.length,
    children: node.children.map((c) => ({ id: c.id, type: c.type, name: c.name })),
  };
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
    case "forgeui_ping": {
      const tools = listMcpTools();
      return {
        ok: true,
        server: "forgeui-mcp",
        version: MCP_PACKAGE_VERSION,
        toolCount: tools.length,
        implementedToolCount: tools.filter((t) => t.implemented).length,
      };
    }

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
          if (req.type === "get_node") {
            const sid =
              (typeof req.screenId === "string" ? req.screenId : undefined) ??
              loaded.project.defaultScreen;
            const nodeId = (req as { nodeId?: string }).nodeId;
            if (typeof nodeId !== "string" || !nodeId.trim()) {
              throw new ForgeError(ErrorCodes.E_MCP_ARGS, "get_node requires nodeId");
            }
            const screen = loaded.screens.get(sid);
            if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${sid} not found`);
            const node = findNode(screen, nodeId);
            if (!node) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${nodeId} not found`);
            return { ref: req.ref, ok: true, data: summarizeNode(node) };
          }
          if (req.type === "list_widget_types") {
            return {
              ref: req.ref,
              ok: true,
              data: listPaletteWidgetSpecs().map((w) => ({
                type: w.type,
                label: w.label,
                category: w.category,
                isContainer: w.isContainer,
              })),
            };
          }
          if (req.type === "list_assets") {
            const kind = (req as { kind?: string }).kind;
            const images = loaded.project.assets?.images ?? [];
            const fonts = normalizeFontAssets(loaded.project);
            const data =
              kind === "image"
                ? images
                : kind === "font"
                  ? fonts
                  : { images, fonts };
            return { ref: req.ref, ok: true, data };
          }
          if (req.type === "get_widget_spec") {
            const widgetType = (req as { widgetType?: string }).widgetType;
            if (typeof widgetType !== "string" || !widgetType.trim()) {
              throw new ForgeError(ErrorCodes.E_MCP_ARGS, "get_widget_spec requires widgetType");
            }
            const spec = getWidgetSpec(widgetType);
            if (!spec) {
              throw new ForgeError(ErrorCodes.E_SEM_001, `unknown widget type: ${widgetType}`);
            }
            return { ref: req.ref, ok: true, data: spec };
          }
          if (req.type === "list_event_triggers") {
            const target = (req as { target?: string }).target ?? "node";
            if (target === "screen") {
              return { ref: req.ref, ok: true, data: ["LOADED", "UNLOADED"] };
            }
            const triggers = new Set<string>();
            for (const w of listPaletteWidgetSpecs()) {
              for (const ev of w.events) triggers.add(ev);
            }
            return { ref: req.ref, ok: true, data: [...triggers].sort() };
          }
          if (req.type === "list_event_action_types") {
            return { ref: req.ref, ok: true, data: [...MCP_EVENT_ACTION_TYPES] };
          }
          if (req.type === "list_events") {
            const targetId = (req as { targetId?: string }).targetId;
            if (typeof targetId !== "string" || !targetId.trim()) {
              throw new ForgeError(ErrorCodes.E_MCP_ARGS, "list_events requires targetId");
            }
            const sid =
              (typeof req.screenId === "string" ? req.screenId : undefined) ??
              loaded.project.defaultScreen;
            const screen = loaded.screens.get(sid);
            if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${sid} not found`);
            const node = findNode(screen, targetId);
            if (!node) throw new ForgeError(ErrorCodes.E_SEM_001, `node ${targetId} not found`);
            return { ref: req.ref, ok: true, data: node.events ?? [] };
          }
          if (req.type === "get_editor_state") {
            const sid =
              (typeof req.screenId === "string" ? req.screenId : undefined) ??
              loaded.project.defaultScreen;
            const screen = loaded.screens.get(sid);
            if (!screen) throw new ForgeError(ErrorCodes.E_SEM_001, `screen ${sid} not found`);
            const includeSpecs = (req as { includeSpecs?: boolean }).includeSpecs !== false;
            const base = buildEditorState(loaded, {
              screenId: sid,
              includeWidgetTypes: includeSpecs,
            });
            return {
              ref: req.ref,
              ok: true,
              data: { ...base, screenTree: summarizeScreenTree(screen) },
            };
          }
          if (req.type === "get_page_screenshot") {
            const sid =
              (typeof req.screenId === "string" ? req.screenId : undefined) ??
              loaded.project.defaultScreen;
            const maxWidthRaw = (req as { maxWidth?: number }).maxWidth;
            const maxWidth =
              typeof maxWidthRaw === "number" && maxWidthRaw > 0 ? maxWidthRaw : undefined;
            return {
              ref: req.ref,
              ok: true,
              data: renderScreenWireframePng(loaded, sid, maxWidth),
            };
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

    case "forgeui_batch_update": {
      const root = resolveProjectRoot(args);
      const operations = args.operations as BatchUpdateOperation[];
      const loaded = openProject(root);
      const result = applyBatchUpdate(loaded, operations, {
        mode: (args.mode as "stop_on_error" | "continue_on_error") ?? "stop_on_error",
      });
      if (result.ok || result.results.some((r) => r.ok)) {
        saveProject(loaded);
      }
      return result;
    }

    case "forgeui_update_node": {
      if (typeof args.nodeId !== "string" || !args.nodeId.trim()) {
        throw new ForgeError(ErrorCodes.E_MCP_ARGS, "update_node requires nodeId");
      }
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const result = applyBatchUpdate(loaded, [
        {
          type: "update_node",
          screenId: args.screenId as string | undefined,
          nodeId: args.nodeId as string,
          frame: args.frame,
          props: args.props,
          styles: args.styles,
          events: args.events,
        },
      ]);
      if (result.results[0]?.ok) saveProject(loaded);
      return result;
    }

    case "forgeui_add_node_tree": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const result = applyBatchUpdate(loaded, [
        {
          type: "add_node_tree",
          screenId: args.screenId as string | undefined,
          parentId: (args.parentId as string | null | undefined) ?? null,
          ref: args.ref as string | undefined,
          tree: args.tree,
        },
      ]);
      if (result.results[0]?.ok) saveProject(loaded);
      return result;
    }

    case "forgeui_get_page_screenshot": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const screenId =
        (typeof args.screenId === "string" ? args.screenId : undefined) ??
        loaded.project.defaultScreen;
      const maxWidth =
        typeof args.maxWidth === "number" && args.maxWidth > 0 ? args.maxWidth : undefined;
      return { ok: true, ...renderScreenWireframePng(loaded, screenId, maxWidth) };
    }

    case "forgeui_create_image_asset": {
      const root = resolveProjectRoot(args);
      const name = args.name as string;
      const imagePath = args.imagePath as string;
      const targetWidth = args.targetWidth as number;
      const targetHeight = args.targetHeight as number;
      if (!name || !imagePath) {
        throw new ForgeError(ErrorCodes.E_MCP_ARGS, "name and imagePath are required");
      }
      return createImageAssetForProject(root, {
        name,
        imagePath,
        targetWidth,
        targetHeight,
        purpose: typeof args.purpose === "string" ? args.purpose : undefined,
      });
    }

    case "forgeui_switch_language": {
      const root = resolveProjectRoot(args);
      const locale = typeof args.locale === "string" ? args.locale.trim() : "";
      if (!locale) throw new ForgeError(ErrorCodes.E_MCP_ARGS, "switch_language requires locale");
      const loaded = openProject(root);
      const i18n = ensureI18n(loaded.project);
      if (!i18n.locales.some((l) => l.id === locale)) {
        i18n.locales.push({ id: locale, name: locale });
      }
      i18n.enabled = true;
      i18n.previewLocale = locale;
      loaded.project.i18n = i18n;
      updateProjectMeta(loaded, { i18n });
      saveProject(loaded);
      return {
        ok: true,
        locale,
        defaultLocale: i18n.defaultLocale,
        locales: i18n.locales.map((l) => l.id),
        stringCount: i18n.strings.length,
      };
    }

    case "forgeui_list_animations": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const anims = normalizeAnimations(loaded.project);
      return {
        ok: true,
        animations: anims.map((a) => ({
          id: a.id,
          name: a.name,
          duration: a.duration,
          loop: !!a.loop,
          trackCount: a.tracks.length,
          tracks: a.tracks.map((t) => ({
            id: t.id,
            nodeId: t.nodeId,
            property: t.property,
            keyframeCount: t.keyframes.length,
          })),
        })),
      };
    }

    case "forgeui_upsert_animation": {
      const root = resolveProjectRoot(args);
      const loaded = openProject(root);
      const anims = normalizeAnimations(loaded.project);
      let anim: TimelineAnimation | undefined;
      const animId = typeof args.id === "string" ? args.id.trim() : "";
      if (animId) anim = anims.find((a) => a.id === animId);
      if (!anim) {
        anim = createTimelineAnimation(anims, {
          name: typeof args.name === "string" ? args.name : undefined,
          duration: typeof args.duration === "number" ? args.duration : undefined,
        });
        if (animId) anim.id = animId;
        anims.push(anim);
      } else {
        if (typeof args.name === "string") anim.name = args.name;
        if (typeof args.duration === "number" && args.duration > 0) anim.duration = Math.round(args.duration);
        if (typeof args.loop === "boolean") anim.loop = args.loop;
      }
      const nodeId = typeof args.nodeId === "string" ? args.nodeId.trim() : "";
      if (nodeId) {
        createAnimTrack(anim, {
          nodeId,
          property: (typeof args.property === "string" ? args.property : "opacity") as
            | "x"
            | "y"
            | "w"
            | "h"
            | "opacity"
            | "rotation",
        });
      }
      updateProjectMeta(loaded, { animations: anims });
      saveProject(loaded);
      return {
        ok: true,
        animation: {
          id: anim.id,
          name: anim.name,
          duration: anim.duration,
          loop: !!anim.loop,
          trackCount: anim.tracks.length,
        },
      };
    }

    default:
      throw new ForgeError(ErrorCodes.E_MCP_NOT_IMPL, `Unknown tool: ${name as string}`);
  }
}
