# MCP tools (ForgeUI)

Public tools (prefix `forgeui_`):

| Tool | Purpose |
|------|---------|
| `forgeui_ping` | Bridge / server health |
| `forgeui_get_editor_state` | Project + current page summary |
| `forgeui_batch_get` | Bundled reads (`get_page_tree`, `get_node`, …) |
| `forgeui_batch_update` | Bundled writes |
| `forgeui_update_node` | Update one node (props/styles/frame) |
| `forgeui_add_node_tree` | Add nested widget tree |
| `forgeui_get_page_screenshot` | Wireframe PNG of current page |
| `forgeui_create_image_asset` | Import image into project assets |
| `forgeui_generate` | Run C codegen (does not rewrite user `custom/`) |

Bridge: `http://127.0.0.1:39201` via env `FORGEUI_BRIDGE`.

Every call needs:

```json
{ "aiWorkspacePath": "D:/path/to/project/.forge-ai" }
```
