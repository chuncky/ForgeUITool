# ForgeUI Loader — board-side C reference (M6)

Minimal C API matching `docs/嵌入式UI工具_软件详细设计说明.md` §7.3.

- `forge_loader_open_file` — validates A2 layout (`manifest.json`, `ui/project.meta.json`, `assets/manifest.json`, entry screen JSON)
- `forge_loader_open_mem` — parses in-RAM JSON `{"format":"forgeui-mem-ref","root":"/flash/packages/latest"}` then validates that on-flash A2 tree (embedded devices)
- `forge_loader_check_compat` — reads `manifest.json` display + `lvglMajor` vs device caps
- `forge_loader_apply` — validates assets/screens, then calls weak `ui_init()` + `ui_nav_load_screen(entry)` (links to `forgeui_generated` when present)
- TypeScript `JsonRuntimeLoader.apply` — host-side A2 JSON parse (`ui/screens/*.json` → in-memory screen trees); C JSON→LVGL runtime still V2

Build (example):

```bash
gcc -I include -c src/forge_loader.c -o forge_loader.o
gcc -I include -c src/forge_json_runtime.c -o forge_json_runtime.o
# LVGL target: add -DFORGE_LOADER_WITH_LVGL=1 and LVGL include/lib paths
```

- `forge_json_runtime_parse_screen` — parse top-level label/button/container from `ui/screens/*.json` (no LVGL)
- `forge_json_runtime_load_screen` — build LVGL screen when `FORGE_LOADER_WITH_LVGL=1`
- `forge_loader_apply_json` — pure A2 JSON apply path (subset widgets; hybrid static C uses `forge_loader_apply`)

Integrate with platform SDK alongside LVGL 9.10. TypeScript `ReferenceLoader` in `@forgeui/loader` mirrors the same rules for host-side CI.
