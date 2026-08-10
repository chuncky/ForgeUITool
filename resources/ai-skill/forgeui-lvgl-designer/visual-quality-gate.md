# Visual quality gate

Before ending a design response that changed layout, text, or colors:

1. Call `forgeui_get_page_screenshot`.
2. Check: clipped text, overlapping widgets, empty large regions, unreadable contrast.
3. Fix via MCP writes, then screenshot again.
4. Skip only when the task made no visible changes.

Note: current screenshot is a **wireframe** of the designer model, not LVGL SDL pixels.
