# Wasm preview template

- **IR shell (default):** `index.html` + `preview-ir.json` — canvas mock from ForgeUI screen tree.
- **Full LVGL Wasm (optional):** `emcmake cmake -B out .` with `FORGEUI_PROJECT_ROOT`, `FORGEUI_LVGL_ROOT`, `FORGEUI_CODEGEN_DIR`.

Set `FORGEUI_EMSCRIPTEN_ROOT` or ensure `emcc` is on PATH for native Wasm builds.
