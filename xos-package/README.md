# xos-package

产品侧预览 / 仿真依赖的真源目录（与竞品 `ref/beken` 解耦）。

| 路径 | 用途 |
|------|------|
| `lvgl/` | 产品 LVGL（QM fork） |
| `tools/win/w64devkit/` | MinGW + Ninja + ccache（PC 预览编译） |
| `tools/win/cmake/` | 便携 CMake |
| `tools/win/sdl2/` | 预编译 SDL2（headers / lib / DLL） |

`tools/win/*` 体积大，默认不进 Git；本地可执行：

```bash
node scripts/sync-xos-tools.mjs
```

`pack-release` 会从本目录打入 `forgeui-root`。
