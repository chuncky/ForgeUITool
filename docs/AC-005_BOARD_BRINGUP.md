# AC-005 — qm10xd 板端首屏验收清单

> **状态：** 需硬件/SDK，代码队列标记 `[-]`  
> **前置：** 已完成 UI 包打包（M6）、Loader 参考实现、qm10xd 平台模板

---

## 环境准备

| # | 步骤 | 期望 | ☐ |
|---|------|------|---|
| 1 | 安装 qm10xd SDK + 工具链 | 可编译官方 Hello World | |
| 2 | 设计器打开 `templates/hello-dual-screen` | 双页工程正常 | |
| 3 | **交付 → 导出到 SDK** 或 CodeGen + 拷贝 | SDK 内存在 `forgeui_generated/` | |
| 4 | **交付 → 打包 UI 包**（A2） | `packages/latest/manifest.json` + `ui/` + `assets/` | |
| 5 | 主机侧 `ReferenceLoader.load(packages/latest, caps)` | `ok: true` | |

---

## 板端集成

| # | 步骤 | 期望 | ☐ |
|---|------|------|---|
| 1 | 将 `packages/loader/c/` 编入固件工程 | `forge_loader.o` 链接成功 | |
| 2 | 调用 `forge_loader_open_file("/path/to/package", &pkg)` | 返回 `E_LOADER_OK` | |
| 3 | `forge_loader_check_compat(pkg, &caps)` | 480×320 / depth 16 / LVGL 9 匹配 | |
| 4 | 静态 C 路径：`ui_init()` 首屏显示 home/settings | 与 SDL 模拟视觉一致（允许字体差异） | |
| 5 | 触摸/按键触发切页事件 | 可切换到 settings 页 | |

---

## 签署

| 角色 | 姓名 | 日期 | 结果 |
|------|------|------|------|
| 嵌入式 | | | ☐ Pass / ☐ Fail |
| 产品 | | | ☐ Pass / ☐ Fail |

---

## 备注

- `forge_loader_apply` 已实装：校验 A2 包后调用 `ui_init()` + `ui_nav_load_screen(entry)`（与 `forgeui_generated` 弱链接；纯 A2 JSON 运行时解析仍为 V2）。
- GUI 手工项见 `docs/MVP_GUI_ACCEPTANCE_UI-01-08.md`（不含板端）。
