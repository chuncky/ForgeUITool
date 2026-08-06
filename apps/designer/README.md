# ForgeUI Designer（Electron + Vue3）

## 启动

先在仓库根目录构建后端包：

```bash
npm run build
```

安装 Electron（若 `node_modules/electron` 被占用，请先结束相关 Node/Electron 进程后再装）：

```bash
npm i electron@35 -D -w @forgeui/designer
```

开发模式：

```bash
npm run dev:designer
# 或
npm run build && npm run dev -w @forgeui/designer
```

仅调试渲染层（无 IPC，功能按钮不可用）：

```bash
npm run dev:ui -w @forgeui/designer
```

## 发布包

在仓库根目录一键生成 Windows 可分发安装/便携包：

```bash
npm run release
```

产物在 `release/`（portable exe、`win-unpacked/` 等）。可选参数见根目录 `scripts/pack-release.mjs`。

验证已打包产物：

```bash
npm run smoke:release
```

## 五区

工具栏 / 控件库 / 画布 / 大纲 / 属性+事件

工程读写与 generate/preview/export-sdk 经 Electron main 调用 `@forgeui/*` 包。
