# MCP workflow (ForgeUI)

1. Open Designer project → **AI设计 → Cursor** (opens `.forge-ai`).
2. Confirm MCP server `forgeui_designer` is connected.
3. Always pass `aiWorkspacePath` = absolute `.forge-ai` path.
4. Read with `forgeui_get_editor_state` / `forgeui_batch_get`.
5. Write with `forgeui_batch_update` (one page per call for multi-page work).
6. Verify with `forgeui_get_page_screenshot`.
7. User saves or discards via Designer bottom bar.
