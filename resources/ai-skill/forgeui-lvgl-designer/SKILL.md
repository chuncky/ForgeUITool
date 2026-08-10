---
name: forgeui-lvgl-designer
description: Guides AI tools to design and modify ForgeUI Kit Designer projects through forgeui_* MCP tools. Use when inspecting pages, adding or deleting widgets, adjusting layout, updating properties or styles, managing pages, or redesigning the current UI.
license: MIT
---

# ForgeUI Kit Designer

## Core Rule

The Designer is the source of truth. Inspect and modify the current project **only** through MCP tools (`forgeui_*`).

MCP tools are not shell commands. Never run tool names in the terminal. If tools are unavailable, tell the user to **fully quit** the AI host, then relaunch from Designer toolbar **AI设计 → Cursor / Codex / TRAE / TRAE CN** (the same host they are using). After relaunch, confirm MCP server \`forgeui_designer\` is connected and \`forgeui_*\` tools appear.

Do not directly edit `project.json` or `screens/*.json`. Do not invent widget types or property names.

Every MCP tool call must include `aiWorkspacePath` = absolute path of the `.forge-ai` folder currently opened.

If a call returns `NO_PROJECT_OPEN`, `NOT_IN_WORKSPACE`, `AI_WORKSPACE_PATH_REQUIRED`, or `AI_WORKSPACE_MISMATCH`, stop and ask the user to open the project workspace and relaunch from **AI设计**.

Do **not** call AI task boundary tools. The Designer starts an AI change transaction on the first write and shows Save/Discard until the user confirms.

## Default Workflow

1. `forgeui_get_editor_state` for initial context (request `includeSpecs` only when needed).
2. Use `forgeui_batch_get` for page tree / node / assets follow-ups.
3. Prefer `forgeui_batch_update` for grouped edits. **One page per batch_update** when touching multiple pages.
4. Prefer coarse tools: `forgeui_update_node`, `forgeui_add_node_tree`.
5. After visible layout/text/color changes, call `forgeui_get_page_screenshot` and fix issues before finishing.
6. Summarize what changed. Leave Save/Discard to the user in Designer.

## Layout bounds

When adding or moving widgets, keep `frame.x/y/w/h` inside the current screen (or parent container) size from `get_editor_state` / page tree. Prefer leaving `frame` unset so the Designer places the widget on-screen; do not invent large coordinates (e.g. x>screenWidth).

**Parent containers only:** `parentId` / nest targets must be container types (`screen`, `container`, `tabview`, `tileview`, `win`, `menu`). **Do not** parent widgets under `button` — set button text via `props.text`.

## Load More

- Workflow details: `mcp-workflow.md`
- Tool parameters: `mcp-tools.md`
- Visual gate: `visual-quality-gate.md`
- Errors: `troubleshooting.md`
