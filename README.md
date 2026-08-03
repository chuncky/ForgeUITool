# ForgeUI Kit

PC 端 LVGL 可视化工具链（qm10xd / qm10xv / qm10xh），按 `docs/` 中产品与设计文档实现。

## 进度对照文档里程碑

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M1 Schema + core | ✅ | validate / open / save / create |
| M2 CodeGen + user/ | ✅ | generate；user 不覆盖 |
| M3 preview-host SDL | ✅ | `--prepare-only`；真编译需 `FORGEUI_LVGL_ROOT` |
| M4 qm10xd PlatformPlugin | ✅ | export-sdk；xv/xh stub |
| M5 Designer 五区 + **应用壳五键** | ✅ | 主页/工作区闸门/设置/文档/关于；工作区 C 菜单；项目设置 |
| M6 Packer/Loader | 🟡 | Packer 写 A2 **骨架**；Loader stub（完整 V1） |
| M7 xv/xh Part/字体 | ⏳ | V1 |
| M8 MCP/Wasm/Figma | 🟡 | 接口 + stub（交付 V2+） |

**立项必达 KF-01～08：** 设计器/CLI/自有 JSON/CodeGen/user 隔离/qm10xd 导出已具备；板端 AC-005 需真实 SDK；SDL 可点选需本机 LVGL+SDL2。

## 包结构

`shared` · `core` · `codegen` · `preview-host` · `platforms` · `packer` · `loader` · `mcp` · `importers` · `cli` · `designer`

## 开发

```bash
npm install
npm run build
npm test

# CLI
node apps/cli/dist/cli.js validate templates/hello-dual-screen
node apps/cli/dist/cli.js generate templates/hello-dual-screen
node apps/cli/dist/cli.js pack templates/hello-dual-screen
node apps/cli/dist/cli.js preview templates/hello-dual-screen --prepare-only

# 设计器
npm run dev:designer
```

## 文档

见 `docs/`。竞品参考见 `ref/`（不兼容他厂工程格式）。
