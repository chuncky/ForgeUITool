# Troubleshooting

| Code / symptom | Action |
|----------------|--------|
| MCP not listed / `forgeui_designer` error | 1) Confirm Bridge `http://127.0.0.1:39201/bridge/ping` → READY  2) `~/.cursor/mcp.json` 中 `forgeui_designer.command` 应为 **`node`**，args 指向 `.../forgeui-root/packages/mcp/dist/server-main.js`  3) Cursor Settings → MCP → 刷新/重开 `forgeui_designer`  4) 仍失败则完全退出 Cursor，从设计器 **AI设计 → Cursor** 重开 |
| Skill source missing | 完整 release 须含 `forgeui-root/resources/ai-skill/`；或设置页「安装/更新 MCP + Skill」 |
| `NOT_IN_WORKSPACE` | Open a project and stay on the workbench |
| `AI_WORKSPACE_MISMATCH` | Do not open another folder; use `.forge-ai` from AI设计 |
| `PREVIEW_BUSY` | Stop C preview/compile, retry |
| Tools as terminal commands | Wrong — use MCP tools inside the editor |
| 连上 Beken MCP 却改不了 ForgeUI | `beken_lvgl_ui_designer` 走 39001；ForgeUI 必须用 **`forgeui_designer`**（39201） |

Do not edit project JSON by hand while AI session is active.
