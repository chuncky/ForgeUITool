# ForgeUI SDL preview template

Used by `@forgeui/preview-host` SdlBackend.

## Build requirements

1. CMake ≥ 3.16 on `PATH`
2. LVGL **9.x** sources via:
   - env `FORGEUI_LVGL_ROOT`, or
   - repo path `xos-package/lvgl`（产品/XOS 修改版，优先）, or
   - repo path `third_party/lvgl`
3. Optional: SDL2 (`find_package(SDL2)`) for real window; without it the stub still links `ui_init` for smoke checks

## CLI

```bash
forgeui preview <projectDir> --prepare-only
forgeui preview <projectDir>          # configure+build+run when LVGL+cmake available
```
