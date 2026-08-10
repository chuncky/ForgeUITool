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
# 拉代码后必须先装依赖（勿提交 node_modules；以 package-lock.json 为准）
npm install

npm run build
npm test

# CLI
node apps/cli/dist/cli.js validate templates/hello-dual-screen
node apps/cli/dist/cli.js generate templates/hello-dual-screen
node apps/cli/dist/cli.js pack templates/hello-dual-screen
node apps/cli/dist/cli.js preview templates/hello-dual-screen --prepare-only

# 设计器（开发态）
npm run dev:designer
```

## 编译与打包（发行版）

前置：本机已执行 `npm install`（需含 `typescript` 等 devDependencies；若报 `'tsc' 不是内部或外部命令`，先重装依赖）。

```bash
# 编译各包 + 设计器（不打安装包）
npm run build:designer

# 打 Windows 发行目录（内部会先 build:designer）
npm run release
```

产物目录：

| 路径 | 说明 |
|------|------|
| `release/` | 对外发行物（含 `win-unpacked` 可直接运行） |
| `.release/` | 打包中间产物（可删） |

可选：

```bash
npm run smoke:release   # 对 release/win-unpacked 做冒烟
npm run clean           # 清 dist / .tmp / .release / release 等；预览加 -- --dry-run
```

Windows 注意：若正从 `release/win-unpacked` 运行 ForgeUI，删 `release/` 可能 `EPERM`；先退出再 `npm run clean` 或重新 `npm run release`。

## 文档

见 `docs/`。竞品参考见 `ref/`（不兼容他厂工程格式）。
