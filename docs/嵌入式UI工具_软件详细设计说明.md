# 嵌入式 UI 工具软件详细设计说明

> **文档类型：** 软件详细设计（LLD）  
> **产品暂名：** ForgeUI Kit（可替换）  
> **版本：** V1.13  
> **日期：** 2026-08-01  
> **V1.14：** **控件属性面板**补充详设 `docs/嵌入式UI工具_控件属性面板详细设计说明.md`（模块架构、动态表单、Style/Event、MVP 差距与 V1 里程碑）；主文档 §3.5.2、§9.7.4 保持契约摘要。  
> **V1.13：** **控件属性面板**详设（§3.5.2、§9.7.4）：对标 Beken 38 控件 + 页面属性；分组（位置/属性/行为/样式）、Part×State、`extraData` 内嵌编辑器；用户手册见 `docs/工具详细说明手册/控件属性面板使用说明.md`。
> **V1.12：** **D-07** 单目录生成物：合并 `generated/`+`user/` 为 `forgeui_generated/`（内嵌 `custom/`），对标 Beken `beken_generated`；见 `docs/生成代码问题/单目录生成物设计方案.md`。
> **V1.11：** **PageTreePanel** 详设（对标 `页面组件库.png`、`组件修改菜单.png`）；Core 增补 duplicate/reorder screen、node order/flags API（FR-011a/b、FR-013a/b）。
> **V1.10：** 移除 Electron 默认系统菜单栏（File/Edit/View/Window/Help）；`Menu.setApplicationMenu(null)`。
> **V1.9：** 工作区顶栏 **ToolbarButton** 契约：图标+名称磁贴；undo/redo icon-only（FR-010f）；映射 `docs/beken界面/工作区顶栏-本产品映射.md`。
> **V1.8：** 顶栏 **项目名称** 可点击打开工程根目录（`tb.projectName` → `shell:openProjectFolder`）。
> **V1.7：** 顶栏新增 **「交付 ▾」**（`tb.deliveryMenu`）；SDK 导出 / UI 包打包迁出 C 语言菜单；项目设置含交付次要入口（FR-010d）。
> **V1.6：** C 语言菜单五步分离；PreviewHost 新增 `buildOnly` / `runOnly`；`cleanOnly` 清理 generated 与预览 out（FR-060d）。
> **V1.4：** 预览非阻塞详设（FR-061a）：禁止 Main 上 `spawnSync` 跑 cmake；`previewStore.busy` + 画布只读；构建日志流式推送 + 节流刷新。
> **V1.3：** 控件库面板详设（对标 `docs/beken界面/组件面板/组件面板.png`）；顶栏/布局与 FR-010a 对齐；WidgetLibrary 与 Outline 解耦；`WidgetSpec.category` 字段。
> **状态：** 草案  
> **上游：** 《软件概要设计说明》V2.4、《设计需求文档》V2.13、《产品定义书》《立项书》《竞品对比分析报告》  
> **实现蓝本：** 主路径对标 **Beken**（JSON + Handlebars + SDL）；体验对标 SquareLine + Beken 壳；SDK 接入对标 UIBuilder；开源对照 EEZ（不 GPL 换皮、不搬 Wasm）  
> **界面参照：** `docs/beken界面/界面说明.txt`；控件库 `组件面板/控件库面板-本产品映射.md`；顶栏 `工作区顶栏-本产品映射.md`；**页面/组件树** `组件面板/页面组件树-本产品映射.md`；**属性面板** 补充详设 `嵌入式UI工具_控件属性面板详细设计说明.md`、用户手册 `工具详细说明手册/控件属性面板使用说明.md`、`docs/beken界面/属性面板/`  
> **参考材料：** `ref/beken/`、`ref/artinchip/`、`ref/quareline/`、`ref/EEZ Studio/` 分析与重构设计文档  

### 已锁定决策（摘自概要设计）

| ID | 结论 |
|----|------|
| D-01 | 设计器壳：**Electron + Vue3** |
| D-02 | 用户代码：**`<codegenDir>/custom/` 再生成不覆盖**（weak 非默认）；`customSubdir` 默认 `custom` |
| D-07 | 生成物 **单根目录** `forgeui_generated/`（`export.codegenDir`）；**废弃** 根下并列 `generated/`+`user/` |
| D-03 | MVP 首发平台：**qm10xd** |
| D-04 | LVGL 版本线：**仅 1 条 — 9.10**（须与 qm10xd SDK 捆绑版本核对） |
| D-05 | A2：**默认启用**（`deliveryMode=both`；可改 `static_c`） |
| D-06 | 工程：**多文件目录为权威**；单文件仅导出/分享 |

---

## 1. 文档说明

### 1.1 目的

在概要设计分层与 AR 落点之上，给出 **可直接指导编码** 的契约：仓库布局、JSON Schema 字段、核心 API 签名、CodeGen/预览/平台插件流程、**设计器界面（路由/组件/IPC）**、错误码、黄金用例与 stub 填满计划。

### 1.2 范围

| 纳入 | 不纳入 |
|------|--------|
| MVP + V1 应实现的模块细节；V2+ 接口 stub | 函数体内算法伪代码到行级 |
| 自有工程方言字段级定义 | 他厂 `.bkprj` / `.spj` / Pro XML 兼容实现 |
| qm10xd PlatformPlugin 契约 | 烧录 IDE / OTA 传输协议实现 |

### 1.3 命名约定

| 概念 | 本产品命名 | 竞品对照（勿兼容） |
|------|------------|-------------------|
| 生成根目录 | `forgeui_generated/`（D-07） | Beken `beken_generated/`；UIBuilder `ui_builder/` |
| 用户区 | `forgeui_generated/custom/` | Beken `custom/`；SquareLine `ui_events.*` |
| CMake 汇总 | `forgeui_generated.cmake` | Beken `beken_generated.cmake` |
| 入口 | `ui_init()`（可配置） | `beken_ui_init()` / SquareLine `ui_init()` |
| 切屏辅助 | `ui_nav.c/h`（V1） | SquareLine `ui_helpers.*` |
| CLI 前缀 | `forgeui`（可替换） | Beken 无统一公开 CLI；仿制文档曾用 `fu-*` / `fb-*` |
| 包名 | `@forgeui/*`（npm 作用域可替换） | — |

---

## 2. 仓库与包结构

```text
forgeui/
  packages/
    core/                 # ProjectModel、Schema、Validate、SemanticIR、WidgetRegistry
    codegen/              # A1 Handlebars CodeGen
    packer/               # A2 Pack（MVP stub → V1 填满）
    preview-host/         # PreviewHost + backends/sdl（wasm stub）
    platforms/
      qm10xd/             # MVP 必交付
      qm10xv/             # V1
      qm10xh/             # V1
    importers/            # 接口 + stub（含单文件展开、Figma 位）
    mcp/                  # 接口 + stub（V2）
    shared/               # 类型、错误码、路径工具
  apps/
    designer/             # Electron + Vue3 + Pinia
    cli/                  # forgeui validate|generate|preview|pack|export-sdk|bundle
  templates/
    sdl-sim/              # PC SDL+LVGL 预览工程模板（对齐 lvglVersion 9.10）
    hello-dual-screen/    # 双页 Hello 示例工程
    boards/qm10xd/        # 上板接入说明与路径提示（非完整 SDK）
  runtime/
    loader/               # A2 薄 Loader 参考实现（V1）
  schemas/                # JSON Schema 源文件（project/screen/package）
  tests/
    golden/               # CodeGen / validate 黄金工程
  docs/                   # 指向本仓库 docs/
```

**依赖方向（强制）：**

```text
apps/* → packages/{core,codegen,preview-host,platforms,…}
codegen / packer / preview-host → core
platforms → core（只读 IR / 路径约定）
designer UI 不得 import codegen 内部模板实现细节（经 GenerateService）
```

**技术栈（锁定）：**

| 层 | 选型 |
|----|------|
| 设计器 | Electron + Vue3 + TypeScript + Vite + Pinia；UI 组件库团队自选（Element Plus 等可） |
| 核心 / CLI | TypeScript（与设计器同 monorepo）；CLI 可 `tsx`/`node` 入口 |
| CodeGen | Handlebars（对标 Beken `.hbs`） |
| 预览编译 | CMake + 本机或内置工具链 + SDL2 + LVGL 9.10 源码树 |
| 画布 | DOM 绝对定位近似渲染（对标 Beken WidgetRenderer）；**像素验收不靠画布** |

---

## 3. 工程文件系统详设

### 3.1 权威目录树（D-06）

```text
<projectRoot>/
  project.json
  screens/
    <screenId>.json
  assets/
    images/
    fonts/                 # 源 TTF 等；生成后的 C/bin 在 forgeui_generated/fonts/
  i18n/                    # V1～V2；MVP 可空
  forgeui_generated/       # D-07：A1 单目录输出（对标 beken_generated）
    forgeui_generated.cmake
    ui.c / ui.h / ui_nav.*
    screens/               # 按屏拆分
    image/                 # 生成图片资源
    fonts/                 # 生成字体资源
    custom/                # 用户业务，再生成不覆盖
      ui_events.c
      ui_events.h
  packages/                # A2 导出物默认目录（deliveryMode 含 dynamic 时）
    latest/                # 或带版本号子目录
  .forge/
    preview-build/         # SDL 构建树（gitignore）
    validate-report.json
    build-manifest.json    # 生成文件清单（对标 EEZ .eez-project-build 思路）
```

### 3.2 单文件导出（非权威）

| 项 | 约定 |
|----|------|
| 命令 | `forgeui bundle <dir> -o out.forgeui` / `forgeui unbundle out.forgeui -o <dir>` |
| 格式 | **zip**，内含完整权威目录（可排除 `.forge/`、可选排除 `forgeui_generated/`） |
| 扩展名 | `.forgeui`（可评审改名） |
| 失败 | 事务性：目标目录先写临时目录再替换；失败不留半份 |

### 3.3 `project.json` 字段级定义

```json
{
  "schemaVersion": "1.0.0",
  "name": "hello_dual",
  "platform": "qm10xd",
  "display": {
    "width": 480,
    "height": 320,
    "colorDepth": 16,
    "rotation": 0
  },
  "lvglVersion": "9.10",
  "previewBackend": "sdl",
  "deliveryMode": "both",
  "entrySymbol": "ui_init",
  "defaultScreen": "home",
  "screens": [
    { "id": "home", "file": "screens/home.json" },
    { "id": "settings", "file": "screens/settings.json" }
  ],
  "assets": {
    "images": [],
    "fonts": []
  },
  "export": {
    "imageMode": "c_array",
    "lvglInclude": "lvgl/lvgl.h",
    "codegenDir": "forgeui_generated",
    "customSubdir": "custom",
    "packageDir": "packages/latest"
  },
  "sdk": {
    "path": "",
    "copyTargetRel": "ui"
  },
  "naming": {
    "cPrefix": "ui_",
    "screenPrefix": "screen_"
  }
}
```

| 字段 | 类型 | 约束 |
|------|------|------|
| `schemaVersion` | string | semver；破坏性变更升 major |
| `platform` | enum | MVP 实现 `qm10xd`；枚举预留 xv/xh |
| `lvglVersion` | string | MVP **仅允许** `"9.10"`（或 SDK 核对后的精确串，统一台账） |
| `deliveryMode` | enum | 默认 `"both"`；`"static_c"` 关闭 Pack |
| `previewBackend` | enum | 默认 `"sdl"`；`"wasm"` V2 |
| `screens[].id` | string | 工程内唯一；匹配 C 标识符规则 `[A-Za-z_][A-Za-z0-9_]*` |
| `sdk.path` | string | 可空；空则用全局设置 / 环境变量 |

**禁止字段：** 他厂 `guid`/`nid`/`strtype`/`_eez_*` 等方言；若内部需要映射表，不得写入权威 JSON。

### 3.4 屏幕文件 `screens/<id>.json`

```json
{
  "schemaVersion": "1.0.0",
  "id": "home",
  "type": "screen",
  "name": "Home",
  "frame": { "x": 0, "y": 0, "w": 480, "h": 320 },
  "props": {},
  "style": {
    "parts": {
      "main": {
        "default": { "bg_color": "#000000" }
      }
    }
  },
  "events": [],
  "children": [
    {
      "type": "label",
      "id": "lbl_title",
      "name": "Title",
      "frame": { "x": 20, "y": 20, "w": 200, "h": 40 },
      "props": { "text": "Hello", "align": "left" },
      "style": { "parts": { "main": { "default": { "text_color": "#FFFFFF" } } } },
      "events": [],
      "children": []
    },
    {
      "type": "button",
      "id": "btn_next",
      "name": "Next",
      "frame": { "x": 180, "y": 240, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "style": {},
      "events": [
        {
          "id": "evt_btn_next_click",
          "trigger": "CLICKED",
          "actions": [
            { "type": "CHANGE_SCREEN", "target": "settings", "anim": "none", "ms": 0 },
            { "type": "CALL_FUNCTION", "handler": "on_btn_next" }
          ]
        }
      ],
      "children": []
    }
  ]
}
```

### 3.5 节点通用字段（DR-003）

| 字段 | 必填 | 说明 |
|------|------|------|
| `type` | Y | WidgetRegistry 中的字符串枚举 |
| `id` | Y | 工程内稳定；生成 C 符号依赖 |
| `name` | Y | 显示名，可非标识符 |
| `frame` | Y | `{x,y,w,h}`；可选 `zIndex` |
| `props` | Y | 控件专用属性对象（非数组），避免 SquareLine `properties[]` 方言 |
| `style` | Y | MVP：`parts.main.default` 扁平常用键；V1：完整 Part/State（对标 Beken `style.parts[].states[]`） |
| `extraData` | N | 列表项、Span 段、图表 series、菜单 pages 等结构化扩展；**非** `children` 子控件树（见 §3.5.2） |
| `events` | Y | 可 `[]` |
| `children` | Y | 容器才非空；非容器必须 `[]` |
| `locked` / `hidden` | N | 编辑器用；可序列化 |

编辑器私有坐标（如 SquareLine `editor_posx`、Beken `wid`）**不得**写入权威 JSON；若需要，放 `.forge/editor-state.json`。

### 3.5.1 样式 Part/State（V1，FR-017）

**JSON 形态（与 Beken/UIBuilder 对齐，字段名自有）：**

```json
"style": {
  "parts": {
    "main": {
      "default": { "bg_color": "#003366", "radius": 8 },
      "pressed": { "bg_color": "#002244" },
      "focused": { "outline_color": "#FFAA00", "outline_width": 2 }
    },
    "indicator": {
      "default": { "bg_color": "#00AA00" }
    }
  }
}
```

| 项 | 约定 |
|----|------|
| Part 名 | 来自 `WidgetSpec.styleParts`（MVP 多数控件仅 `main`） |
| State 名 | `default` \| `pressed` \| `focused` \| `disabled` \| `checked` 等，映射 LVGL `LV_STATE_*` |
| 属性键 | snake_case；CodeGen 映射为 `lv_obj_set_style_*`（LVGL 9.10） |
| 主题复用 | V1：`project.themes` 或 `themes/*.json` 命名样式 ID，节点 `styleRef` 引用（FR-018） |

MVP 校验器须 **同时接受** 扁平 `style.main.default` 与嵌套 `style.parts`，CodeGen 归一化为 IR 再出 C。

### 3.5.2 属性面板数据模型（FR-016 / FR-017）

属性面板编辑选中节点或 screen 根的几何、专用属性、行为标志与样式；与左侧控件库分工：**控件库只添加，属性面板只编辑已选节点**（FR-010a）。

**模块补充详设：** `docs/嵌入式UI工具_控件属性面板详细设计说明.md`（组件树、IPC 写路径、Registry、StylePanel、MVP 差距与 V1 里程碑）。  
**权威用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`（V1.4，含 38 控件 + 页面字段级说明与 Beken 截图索引）。

#### 3.5.2.1 UI 分组 → JSON 映射

| 面板分组 | 适用对象 | 写入字段 | MVP | V1 |
|----------|----------|----------|-----|-----|
| **屏幕信息** | screen 根（页面树选中 `Page_x`） | `screen.width` / `screen.height`、背景等 | 宽/高 | 自定义代码、背景全量 |
| **位置信息** | 控件 | `frame.x/y/w/h` | ✓ | 锚点 3×3、旋转、布局类型 |
| **属性** | 控件 | `props.*` | 按注册表动态表单 | 全 38 种 `general` 字段 |
| **行为配置** | 控件 | `flags` / 预览 `state` | — | 对象标志、Select State |
| **样式** | 控件 / screen | `style.parts[part][state].*` | `main.default` 常用键 | Part×State 全量子组 |
| **扩展数据** | 部分控件 | `extraData.*` | — | 内嵌列表/表格编辑器 |

颜色格式统一 **#RRGGBBAA**（8 位十六进制，与 Beken 一致）。`Common/Range` 在 JSON 中为 `{min,max}` 对象，禁止逗号字符串。

#### 3.5.2.2 extraData 约定

`extraData` 承载需内嵌编辑器的结构化数据（列表项、表格单元格、图表 series 等），**不得**用 `children` 模拟：

| type | extraData 键（示例） | 编辑器 |
|------|---------------------|--------|
| `spangroup` | `spans[]` | Span 列表（text、color、font…） |
| `list` / `dropdown` / `roller` | `items[]` | 选项列表 |
| `table` | `cells[]`、`column_widths[]` | 表格编辑器 |
| `buttonmatrix` | `text_map[]`、`one_checked` | 矩阵标签 |
| `tabview` | `tabs[]`、`selectedTabIndex` | Tab 头列表 |
| `linechart` / `barchart` / `scatterchart` | `series[]` | 图表 series |
| `menu` | `pages[]`、`rootPageId`… | 菜单页树 |
| `win` / `msgbox` | `buttons[]` / `header_buttons[]`… | 对话框按钮 |

完整字段见用户手册 §5 与 Beken `component-specs/{type}/{type}.md`。

#### 3.5.2.3 控件属性规格来源

38 种可添加控件（不含 screen 根）的属性/Part/extraData 总览见用户手册 **§5.0**；ForgeUI 分期列：`props.*` = MVP 已支持或计划同名；`V1` = 待注册表与 UI 补齐。运行时规格以 `packages/core/src/widgets.ts`（WidgetRegistry）为准，设计期以 Beken AI `component-specs/` 为对标输入。

### 3.6 事件与动作（AR-014 / FR-030～033）

**Trigger（MVP）：** `CLICKED` | `PRESSED` | `RELEASED` | `LONG_PRESSED` | `VALUE_CHANGED`  
**Trigger（V1+）：** 手势 / 按键等按注册表扩展

**Action.type（MVP）：**

| type | 字段 | 执行侧 | CodeGen |
|------|------|--------|---------|
| `CHANGE_SCREEN` | `target`, `anim?`, `ms?` | UI | `lv_screen_load` / helper |
| `CALL_FUNCTION` | `handler`（C 标识符） | Host | `<codegenDir>/custom/ui_events.*` 桩 + 调用 |
| `SET_PROP` | `nodeId`, `prop`, `value` | UI | V1 优先；MVP 可后置 |

**Action.type（V2）：** `SWITCH_LANG` | `SET_STYLE` | 变量读写等

```ts
type Action =
  | { type: "CHANGE_SCREEN"; target: string; anim?: string; ms?: number }
  | { type: "CALL_FUNCTION"; handler: string }
  | { type: "SET_PROP"; nodeId: string; prop: string; value: unknown };
```

`CALL_FUNCTION` 与 UI 动作分层：handler **不得**进入 A2 包链接新驱动（FR-091）。

### 3.7 JSON Schema 文件

| 文件 | 校验对象 |
|------|----------|
| `schemas/project.schema.json` | `project.json` |
| `schemas/screen.schema.json` | `screens/*.json` |
| `schemas/ui-package.manifest.schema.json` | A2 `manifest.json` |
| `schemas/widget-registry.schema.json` | 注册表条目（开发期） |

`schemaVersion` 与 Schema 文件版本对照表维护在 `schemas/COMPAT.md`。

---

## 4. 核心模块详细设计

### 4.1 `packages/core` — Project Model API

#### 4.1.1 类型（节选）

```ts
type ProjectId = string;
type NodeId = string;
type ScreenId = string;

interface Diagnostic {
  level: "error" | "warning" | "info";
  code: string;           // 如 E_SCHEMA_001
  message: string;
  path?: string;          // JSON Pointer 或 file#path
}

interface ValidateResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

interface MutationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  /** 变更后是否建议刷新视图 */
  dirtyViews?: Array<"canvas" | "outline" | "props" | "events">;
}
```

#### 4.1.2 Workspace API

```ts
interface WorkspaceApi {
  create(opts: CreateProjectOptions): Promise<ProjectHandle>;
  open(projectRoot: string): Promise<ProjectHandle>;
  save(handle: ProjectHandle): Promise<void>;
  saveAs(handle: ProjectHandle, newRoot: string): Promise<ProjectHandle>;
  close(handle: ProjectHandle): Promise<void>;
}

interface CreateProjectOptions {
  root: string;
  name: string;
  platform: "qm10xd" | "qm10xv" | "qm10xh";
  display: { width: number; height: number; colorDepth: number };
  lvglVersion?: "9.10";           // 默认 9.10
  deliveryMode?: "static_c" | "dynamic_ui" | "both"; // 默认 both
  fromTemplate?: "hello-dual-screen" | "blank";
}
```

#### 4.1.3 Query / Mutate API

```ts
interface ProjectModelApi {
  getMeta(): ProjectMeta;
  listScreens(): ScreenSummary[];
  getScreen(id: ScreenId): ScreenDocument;
  getNode(screenId: ScreenId, nodeId: NodeId): Node;
  findNodes(pred: (n: Node) => boolean): Array<{ screenId: ScreenId; node: Node }>;

  addScreen(input: NewScreenInput): MutationResult;
  removeScreen(id: ScreenId): MutationResult;
  renameScreen(id: ScreenId, name: string): MutationResult;
  duplicateScreen(id: ScreenId, opts?: { newId?: string }): MutationResult;
  reorderScreen(id: ScreenId, where: "up" | "down" | "top" | "bottom"): MutationResult;
  setDefaultScreen(id: ScreenId): MutationResult;

  addNode(screenId: ScreenId, parentId: NodeId | null, node: Node, index?: number): MutationResult;
  updateNode(screenId: ScreenId, nodeId: NodeId, patch: Partial<Node>): MutationResult;
  removeNode(screenId: ScreenId, nodeId: NodeId): MutationResult;
  duplicateNode(screenId: ScreenId, nodeId: NodeId): MutationResult;
  moveNodeOrder(screenId: ScreenId, nodeId: NodeId, where: "up" | "down" | "top" | "bottom"): MutationResult;
  setNodeFlags(screenId: ScreenId, nodeId: NodeId, flags: { locked?: boolean; hidden?: boolean }): MutationResult;
  moveNode(screenId: ScreenId, nodeId: NodeId, newParentId: NodeId | null, index: number): MutationResult;
  alignNodes(screenId: ScreenId, nodeIds: NodeId[], mode: AlignMode): MutationResult; // V1
  setEvents(screenId: ScreenId, nodeId: NodeId, events: Event[]): MutationResult;

  /** 唯一推荐写入口：校验后提交，失败不落盘 */
  applyMutation(mut: Mutation): MutationResult;

  validate(): ValidateResult;
  subscribe(listener: (ev: ModelEvent) => void): () => void;
}
```

**规则：**

1. GUI / CLI / MCP / Importer **只**通过本 API 改模型（AR-020）。  
2. 禁止任何路径直接 `fs.writeFile(<codegenDir>/...)`（**不含 custom**）充当「编辑」。  
3. `save` 只写权威 JSON（`project.json` + `screens/` + 资源索引）；`<codegenDir>/` 非 `custom` 区域仅 CodeGen 写入。

#### 4.1.4 撤销重做

- 设计器：命令栈，快照粒度为一次 `applyMutation`（对标 Beken JSON 快照思路）。  
- CLI/MCP：无自动撤销；MCP 变更由用户在设计器 Save/Discard（V2 可对齐 Beken「确认后再存」）。

### 4.2 SchemaValidator

```ts
interface SchemaValidator {
  validateProjectDir(root: string): ValidateResult;
  validateDocument(kind: "project" | "screen", data: unknown): ValidateResult;
}
```

**校验阶段：**

1. JSON 语法  
2. JSON Schema  
3. 语义：screen 引用存在、`id` 唯一、父子 type 可嵌套、`handler` 标识符合法、`lvglVersion` 白名单、`platform` 已注册插件  

**CLI：** `forgeui validate <root>` → `ok` 则 exit 0，否则 exit 1 并打印 diagnostics（FR-058）。

### 4.3 WidgetRegistry

```ts
interface PropSpec {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'range' | 'color' | 'imageSrc' | 'dateTime';
  label: { 'zh-CN': string; en?: string };
  default?: unknown;
  enum?: string[];
  group?: 'general' | 'layout' | 'behavior';
  phase?: 'mvp' | 'v1';           // UI 分期：v1 字段可灰显
}

interface ExtraDataEditorSpec {
  id: string;                     // 如 'items' | 'spans' | 'series'
  editor: 'list' | 'table' | 'chartSeries' | 'menuPages' | 'tileGrid';
  itemSchema: Record<string, PropSpec>;
}

interface WidgetSpec {
  type: string;                    // "button"
  lvgl: {
    create: string;                // "lv_button_create"
    major: number[];               // [9]
  };
  label: { "zh-CN": string; en?: string };
  category: WidgetCategory;        // 供控件库与文档分组
  isContainer: boolean;
  defaultFrame: { w: number; h: number };
  props: PropSpec[];
  styleParts: string[];            // MVP: ["main"]；多 Part 见用户手册 §4.4.1
  extraData?: ExtraDataEditorSpec; // 有内嵌编辑器时为必填
  behaviorFlags?: string[];        // V1：LVGL obj flags 白名单
  events: string[];                // 允许的 trigger
  codegen: {
    templatePartial: string;       // "widgets/button"
  };
  pack?: {
    emitterId: string;             // MVP 可缺省 → Unsupported
  };
}

type WidgetCategory =
  | 'layout' | 'display' | 'button' | 'input' | 'media'
  | 'visual' | 'feedback' | 'nav' | 'advanced' | 'chart';
```

**V1 控件集（FR-015，对标 Beken 38 种）：**  
`obj`, `win`, `label`, `spangroup`, `table`, `list`, `button`, `imagebutton`, `buttonmatrix`, `textarea`, `checkbox`, `switch`, `slider`, `dropdown`, `roller`, `spinbox`, `image`, `animimg`, `canvas`, `arc`, `line`, `qrcode`, `barcode`, `led`, `bar`, `spinner`, `msgbox`, `menu`, `tabview`, `tileview`, `digitalclock`, `calendar`, `keyboard`, `scale`, `linechart`, `barchart`, `scatterchart`, `chart`

**MVP 控件子集（FR-014）：**  
`screen`, `container`（`obj`）, `label`, `button`, `image`, `slider`, `switch`, `checkbox`, `bar`, `arc`, `dropdown`, `textarea`

注册表文件：`packages/core/src/widgets/*.spec.ts` 或 `widgets.json`；**设计器调色板、属性表、CodeGen、Pack 同源读取**（NFR-006）。

### 4.4 Semantic IR

```ts
interface ProjectIR {
  meta: ProjectMeta;
  screens: ScreenIR[];
  assets: AssetRef[];
  callHandlers: string[];          // 去重后的 CALL_FUNCTION 列表
}

interface ScreenIR {
  id: string;
  root: WidgetIR;
}

interface WidgetIR {
  type: string;
  id: string;
  name: string;
  frame: Frame;
  props: Record<string, unknown>;
  extraData?: Record<string, unknown>;
  style: StyleIR;
  events: EventIR[];
  children: WidgetIR[];
}

interface EventIR {
  trigger: string;
  actions: ActionIR[];
}
```

`buildIR(handle): ProjectIR` 由 SemanticMapper 遍历 JSON；CodeGen/Packer **禁止**再直接解析散落 JSON 另搞一套映射。

---

## 5. CodeGen（A1）详细设计

### 5.1 模块职责

`packages/codegen`：`ProjectIR` → 写入 `<codegenDir>/`（非 `custom` 区）+ 首次创建 `<codegenDir>/custom/` 桩。

### 5.2 输出布局（D-07，对标 Beken `beken_generated/`）

> 专项说明：`docs/生成代码问题/单目录生成物设计方案.md`

```text
forgeui_generated/
  forgeui_generated.cmake    # GLOB 全部 .c；SDK/预览统一 include
  ui.h
  ui.c                       # ui_init / ui_deinit / 屏切换 helper 声明
  ui_nav.c                   # V1：切屏/简单动画（对标 SquareLine ui_helpers）
  ui_nav.h
  screens/
    screen_home.c
    screen_home.h
    screen_settings.c
    screen_settings.h
  image/                     # imageMode=c_array 时
  fonts/
  custom/                    # 再生成不覆盖（对标 Beken custom/）
    ui_events.h              # 仅首次生成
    ui_events.c              # 仅首次生成；已存在则跳过
    custom_func.h            # V1 可选
    custom_func.c
```

### 5.3 模板清单（Handlebars）

```text
packages/codegen/templates/
  c/
    ui.h.hbs
    ui.c.hbs
    ui_nav.c.hbs       # V1
    ui_nav.h.hbs
    screen.c.hbs
    screen.h.hbs
    ui.cmake.hbs
    custom/ui_events.h.hbs
    custom/ui_events.c.hbs
    forgeui_generated.cmake.hbs
  partials/
    widgets/
      label.hbs
      button.hbs
      image.hbs
      ...
    events/
      change_screen.hbs    # 调用 ui_nav_load_screen(target, anim, ms)
      call_function.hbs
```

**上下文（最低字段）：** `project`, `screen`, `node`, `ir`, `naming`, `lvglVersion`, `handlers[]`

### 5.4 用户区规则（D-02 / D-07）

| 场景 | 行为 |
|------|------|
| `<codegenDir>/custom/ui_events.c` 不存在 | 按模板生成所有 `handler` 空实现 |
| 已存在 | **整文件不覆盖**；若有新 handler，追加声明/空实现到文件末尾（推荐）或生成 `custom/ui_events_new_stubs.c` 提示合并（详细实现选一种，黄金用例锁死） |
| `--clean-generated` | 只清 `<codegenDir>/` **除 `custom/` 外** 与 `.forge/build-manifest.json`，**从不**清 `custom/` |

**禁止默认 weak 符号**（FR-056 可选，默认关闭）。

### 5.5 生成 API

```ts
interface CodeGenOptions {
  cleanGenerated?: boolean;
  dryRun?: boolean;
}

interface CodeGenResult {
  ok: boolean;
  filesWritten: string[];
  filesSkipped: string[];      // 含 custom/ 跳过
  diagnostics: Diagnostic[];
}

function generate(projectRoot: string, opts?: CodeGenOptions): Promise<CodeGenResult>;
```

### 5.6 构建清单

每次成功生成更新 `.forge/build-manifest.json`：

```json
{
  "generatedAt": "ISO-8601",
  "lvglVersion": "9.10",
  "files": ["forgeui_generated/ui.c", "..."]
}
```

V1：`forgeui generate --prune-orphans` 删除清单外且位于 `<codegenDir>/`（**不含 custom/**）的孤儿文件（对标 EEZ build manifest）。

### 5.7 板端最小集成契约

```c
lv_init();
/* display + indev port（平台提供） */
ui_init();   /* entrySymbol，默认 ui_init */
while (1) {
  lv_timer_handler();
  /* delay */
}
```

业务在 `forgeui_generated/custom/ui_events.c`：`void on_btn_next(void) { ... }`，通过生成区暴露的对象句柄访问控件（句柄命名规则：`ui_<screen>_<nodeId>` 或结构体 `ui.xxx`，在详细模板中固定一种）。

---

## 6. 预览（PreviewHost / SDL）详细设计

### 6.1 接口

```ts
interface PreviewBackend {
  readonly id: "sdl" | "wasm";
  prepare(projectRoot: string): Promise<void>;  // 通常先 generate
  start(opts?: { wait?: boolean }): Promise<PreviewSession>;
  stop(session: PreviewSession): Promise<void>;
}

interface PreviewHost {
  getBackend(id: string): PreviewBackend;
  run(projectRoot: string): Promise<PreviewSession>; // 读 project.previewBackend
}
```

### 6.2 SdlBackend 流程（对标 Beken / UIBuilder）

```text
1. validate(projectRoot) 失败则中止
2. generate(projectRoot)
3. 将 templates/sdl-sim 同步到 .forge/preview-build/（或增量）
4. 把 `<codegenDir>/`（含 `custom/`）经 `forgeui_generated.cmake` 链进预览 CMake
5. 配置 LV_COLOR_DEPTH / 分辨率与 project.display 一致
6. cmake --build **--parallel**（**异步 spawn**；**禁止**每次 wipe `out/`；指纹变时 soft-clean CMakeCache）&& 启动 SDL 进程（detached）
7. 优先预编译 SDL2 + MinGW/ccache（`ref/beken/.../tools/win`）；Release 预览配置（FR-061b）
8. 设计器/CLI 订阅 stdout/stderr；失败展示编译日志（FR-061）
9. 编译进行中：previewStore.busy=true，画布 pointer-events:none（FR-061a）
```

**非阻塞约束（FR-061a，根因说明）：**

| 反模式 | 现象 | 正确做法 |
|--------|------|----------|
| Electron Main 上 `spawnSync(cmake …)` | Windows 下整窗「未响应」；画布拖放/选中 IPC 排队 | `runProcessAsync` + 事件循环继续处理 IPC |
| 构建日志逐行 push 到 reactive 数组 | 日志面板重绘拖慢 Renderer | 单次 append 合并 stdout/stderr，超长截断 |
| 编译期间仍允许画布写操作 | mouseup 触发 `updateNode` IPC 与 cmake 串行 | `previewStore.busy` 锁画布；App 底栏 `.foot` 显示 phase |

对标 Beken：`ref/beken` 分析 — 「spawn 工作 2/3 的命令，日志进面板」，主 UI 线程不跑同步编译。

**模板要求：** 使用 **LVGL 9.10** 源码树；禁止依赖他厂闭源 sim。

### 6.3 WasmBackend（stub → V2，对照 EEZ / LVGL Pro）

**目录：** `packages/preview-host/backends/wasm/`

| 组件 | 职责 |
|------|------|
| `lvgl-emscripten/` | LVGL 9.10 源码 + 平台 stub（display/indev 桥） |
| `forge-bridge.ts` | IR 或 generated 符号 → Wasm 侧建对象树（与 SDL 消费同源 IR） |
| `runtime.worker.ts` | Worker 内 `_mainLoop`；帧缓冲 → OffscreenCanvas / ImageData |

**与 EEZ 差异（合规）：** 不引用 `lvgl_runtime_v*.js`；不链 eez-flow；GPL 仓仅作 **架构阅读**，代码自研。

**接口演进：**

```ts
// V2 目标签名（MVP 仍 throw E_PREVIEW_WASM_NOT_IMPL）
interface WasmPreviewSession extends PreviewSession {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  postMessage(event: PreviewInputEvent): void;  // 点击/触摸注入 indev
}
```

**验收（AC-008）：** 同一 golden 工程，SDL 与 Wasm 对象树深度/screen 列表一致（像素 diff 可选 P2）。

---

## 7. Packer / Loader（A2）详细设计

### 7.1 包目录

```text
packages/latest/
  manifest.json
  ui/
    project.meta.json      # 自 project 派生的子集
    screens/*.json         # 可与权威同源或规范化 IR JSON
  assets/
    ...
```

`manifest.json`：

```json
{
  "schemaVersion": "1.0.0",
  "packageVersion": "1.0.0",
  "minLoaderVersion": "1.0.0",
  "platform": "qm10xd",
  "display": { "width": 480, "height": 320, "colorDepth": 16 },
  "lvglMajor": 9,
  "lvglVersion": "9.10",
  "entryScreen": "home"
}
```

### 7.2 Packer API

```ts
interface Packer {
  pack(projectRoot: string, outDir?: string): Promise<PackResult>;
}

// MVP：
async function pack() {
  throw new ForgeError("E_PACK_NOT_IMPL"); // 或写空骨架 + 警告
}
```

**V1 填满：** IR → 规范化 `ui/` + 拷贝资源 + 写 manifest；`deliveryMode=static_c` 时跳过。

### 7.3 Loader API（板端 C，V1）

```c
typedef struct forge_ui_package forge_ui_package_t;

int forge_loader_open_file(const char *path, forge_ui_package_t **out);
int forge_loader_open_mem(const void *buf, size_t len, forge_ui_package_t **out);
int forge_loader_check_compat(const forge_ui_package_t *pkg, const forge_loader_caps_t *caps);
int forge_loader_apply(forge_ui_package_t *pkg);   /* 建 LVGL 树 */
void forge_loader_close(forge_ui_package_t *pkg);
```

**兼容失败错误码（NFR-009）：** 见 §12。  
**边界：** 薄 Loader + LVGL；无多 App（C-005）。

### 7.4 默认启用（D-05）

- 新建工程 `deliveryMode=both`。  
- `forgeui generate` 成功后，若 mode∈{`both`,`dynamic_ui`}，自动调用 `pack`（V1）；MVP pack stub 时打日志「已跳过 pack」。  
- 工具设置可改默认，但不改为「未安装的可选插件」。

---

## 8. 平台插件（qm10xd）详细设计

### 8.1 接口

```ts
interface PlatformPlugin {
  id: "qm10xd" | "qm10xv" | "qm10xh";
  displayName: string;
  defaultSdkPathHints(): string[];
  resolveSdkPath(project: ProjectMeta, globalCfg: GlobalConfig): string | null;
  copyGenerated(projectRoot: string, sdkPath: string, opts?: { force?: boolean }): Promise<CopyResult>;
  helloDocPath(): string;          // ≤10 步文档
  boardTemplateDir(): string;      // templates/boards/<id>
}
```

### 8.2 qm10xd MVP 行为

| 步骤 | 说明 |
|------|------|
| 1 | 读取 `project.sdk.path`，空则全局配置 / 环境变量 `FORGEUI_QM10XD_SDK` |
| 2 | 将 **整个** `<codegenDir>/`（默认 `forgeui_generated/`）拷贝到 SDK 相对路径 `sdk.copyTargetRel`；SDK 侧 `include(.../forgeui_generated.cmake)` |
| 3 | `--force` 仅覆盖生成区约定目录，不删业务其它文件 |
| 4 | 输出下一步：文档中「调用 `ui_init`」链接 |

**不做：** 烧录、ADB、完整 SDK 编译驱动（OUT）。

### 8.3 xv/xh

V1：复制 qm10xd 插件骨架改路径宏与文档；注册进 `platforms/index.ts`。

---

## 9. 设计器界面详细设计（Electron + Vue3）

> 本章把概要设计 §5.6 落到 **路由、页面、组件、交互时序与 IPC**。  
> 界面蓝本：`docs/beken界面/界面说明.txt`（主壳五键 + 工作区工具条 + 附属面板）。  
> 合规：仅 L1/L2；禁止打开他厂工程；MicroPython / 云资源 / AI 按 FR 分期，MVP 不伪造对等能力。

### 9.1 进程与安全边界

| 进程 | 职责 |
|------|------|
| Main | 单窗口壳、**启动 `ready-to-show` 后 `maximize()`**（FR-010b）、原生对话框、菜单、spawn 预览子进程、加载 `packages/*/dist` |
| Preload | `contextBridge` 暴露 `window.forgeuiDesktop`；**禁止**渲染进程直接 `fs`/`child_process` |
| Renderer | Vue3 + Pinia + Vue Router；只通过 IPC 读写工程 |

预览/生成：**优先同进程调 `packages/*` 或 `forgeui` CLI**，保证与无头路径一致（C-001、AC-AR-003）。

### 9.2 路由与应用壳（对标 Beken 顶栏）

```text
/                     → redirect /home
/home                 → HomeView
/workspace            → WorkspaceView（无工程：Gate；有工程：Workbench）
/settings             → SettingsView
/docs                 → DocsView
/about                → AboutView
```

**AppShell.vue** 结构：

```text
┌──────────────────────────────────────────────────────────┐
│ Brand │ 主页 │ 工作区 │ 设置 │ 文档 │ 关于     [窗口控] │  ← 顶栏五键
├──────────────────────────────────────────────────────────┤
│                     <RouterView />                        │
├──────────────────────────────────────────────────────────┤
│ 全局状态栏 `.foot`：阶段摘要（含编译 phase）+ LVGL/平台版本；不含日志收起控件 │
└──────────────────────────────────────────────────────────┘
```

| 顶栏键 | 组件 | 行为细则 |
|--------|------|----------|
| 主页 | `HomeView` | 见 §9.3 |
| 工作区 | `WorkspaceView` | `projectStore.loaded == null` → `WorkspaceGate`；否则 → `DesignerWorkbench` |
| 设置 | `SettingsView` | 全局配置；可「打开当前工程设置」 |
| 文档 | `DocsView` | 内嵌 Markdown 或 `shell.openExternal` 打开 `templates/boards/*/HELLO.md` 与产品文档索引 |
| 关于 | `AboutView` | 产品名、版本、`lvglVersion` 线、许可与「不兼容他厂工程」声明 |

切换顶栏 **不自动关闭工程**；从工作区切走时若 `dirty`，提示保存（可「稍后」）。

**禁止原生系统菜单栏：** Electron 窗口 **不得** 显示默认 `File / Edit / View / Window / Help` 菜单；启动时 `Menu.setApplicationMenu(null)`。所有操作经 **应用壳顶栏五键** 与 **工作区顶栏**（§9.6）进入；快捷键由 Renderer 处理（如工作区 `Ctrl+S/Z/Y`）。

### 9.3 主页（对标「主1」上/中/下）

**组件：** `HomeView.vue`

| 区块 | UI 元素 | 交互 | 数据 |
|------|---------|------|------|
| 上部 | 标题「ForgeUI Kit」+ 副文案 | 无 | 静态 / i18n |
| 中部 · 快速开始 | 四卡片：**新建工程**、**打开工程**、**文档**、**示例模板** | 新建→向导；打开→目录对话框；文档→`/docs`；示例→复制 `hello-dual-screen` 或打开只读示例再另存 | FR-001/003/005 |
| 下部 · 最近项目 | 列表行：名称、平台、分辨率、路径、时间 | 单击打开；右键「从列表移除」 | `settingsStore.recentProjects`（本地 JSON） |

**新建工程向导 `NewProjectDialog` 字段：**

| 字段 | 类型 | 默认 | 写入 |
|------|------|------|------|
| name | string | 目录名 | `project.name` |
| platform | enum xd/xv/xh | qm10xd | `project.platform` |
| width/height/colorDepth | number | 480/320/16 | `project.display` |
| template | blank \| hello-dual-screen | hello 或 blank | `createProject` |
| deliveryMode | both \| static_c \| dynamic_ui | **both** | D-05 |
| root | 目录选择 | — | 工程根 |

校验：目标目录无已有 `project.json`；id/名称符合标识符规则。

### 9.4 工作区闸门（对标「主2-新建项目」）

无工程时 `WorkspaceGate`：

- 主 CTA：新建工程、打开工程、打开 Hello 示例  
- 次要：导入 `.forgeui`（unbundle 到新目录）  
- 文案明示：权威格式为多文件目录（D-06）

### 9.5 设计工作台总体布局（对标「工作区-全」）

**组件树：**

```text
DesignerWorkbench
  ├── WorkspaceToolbar          # §9.6（ToolbarButton 图标+名称；undo/redo icon-only）
  ├── .body
  │     ├── left
  │     │     ├── WidgetLibraryPanel   # 控件库（可折叠，FR-010a / §9.7.1）
  │     │     └── PageTreePanel        # §9.7.3（现 Outline.vue 待重命名）
  │     ├── center（纵向 flex）
  │     │     ├── Canvas        # WidgetView 递归；flex:1
  │     │     └── LogPanel      # 构建/运行日志，固定于画布正下方（FR-010b）；默认展开
  │     └── right
  │           └── InspectorPanel       # 「属性 | 事件」Tab
  │                 ├── PropPanel
  │                 ├── StylePanel     # MVP 可先并入 Prop；V1 Part/State
  │                 └── EventPanel
```

**全局底栏（App.vue `.foot`）：** 单行阶段摘要 + LVGL/平台版本；**不含**日志收起/展开（对标 Beken `界面说明` §2.14.4）。日志面板的收起/展开仅在 **LogPanel 标题栏**（§2.14.3）。

**布局宽度（默认）：** 左栏 260px；中栏 flex（画布占剩余高度减去 LogPanel ~160px）；右 300px。

**反模式（已修正）：** ~~LogDrawer 全屏遮罩弹层~~；应使用 **LogPanel** 嵌入 center 列底部（对标 Beken `工作区-全.png`）。

### 9.6 工作区顶栏详细设计（Beken 工具条逐项）

> **视觉总述（FR-010f）：** 对标 `工作区/工作区-全.png`。默认按钮为 **图标在上、名称在下** 的磁贴（`.tb-btn`）；下拉触发器保留 `▾`。完整图标 id 对照见 `docs/beken界面/工作区顶栏-本产品映射.md`。

#### 9.6.0 ToolbarButton 组件契约

**文件：** `apps/designer/src/components/ToolbarButton.vue`（下拉复用 `ToolbarMenuButton.vue` 或同组件 `menu` prop）

```typescript
interface ToolbarButtonProps {
  icon: ToolbarIconId;       // 见映射表
  label?: string;            // 中文；iconOnly 时可省略
  iconOnly?: boolean;        // undo/redo: true
  active?: boolean;          // 控件库 Toggle → class `.on`
  disabled?: boolean;
  title?: string;            // Tooltip；undo/redo 须含快捷键
}
```

**样式要点：**

| 属性 | 值 |
|------|-----|
| 布局 | `flex-direction: column`; `align-items: center`; `gap: 2px` |
| 图标尺寸 | 20×20 px（SVG `viewBox="0 0 24 24"`） |
| 文案 | `font-size: 11px`; 单行；过长 `ellipsis` |
| 激活 | `.tb-btn.on` 边框/底色（FR-010a） |
| 禁用 | `opacity: 0.45`; `pointer-events: none` |

**Undo / Redo（icon-only）：**

| 控件 ID | icon | Tooltip | 禁用条件 |
|---------|------|---------|----------|
| `tb.undo` | `undo`（↶ 左弯箭头） | `撤回 (Ctrl+Z)` | `!canUndo` |
| `tb.redo` | `redo`（↷ 右弯箭头） | `重做 (Ctrl+Y)` | `!canRedo` |

**禁止：** 顶栏 undo/redo 使用中文「撤回」「重做」替代图标；从 Beken 安装包复制 FontAwesome/图标字体。

**图标源：** `ToolbarIcon.vue` 或 `icons/toolbar.ts` 内联 SVG path；与 Beken FontAwesome 语义对齐但 **自研矢量**。

| # | Beken 原文 | 本产品控件 ID | 视觉（图标 + 文案） | 行为 | IPC / Service | 分期 |
|---|------------|---------------|---------------------|------|---------------|------|
| 1 | 项目名称 | `tb.projectName` | `folder-open` + 工程名（+`*`） | 展示 `project.name`；脏则后缀 `*`；**单击**在 OS 文件管理器中打开 `loaded.root` | `shell:openProjectFolder` | MVP |
| 2 | 项目设置 | `tb.projectSettings` | `settings` + 「项目设置」 | 打开 `ProjectSettingsDialog` | `save` 前写 `project.json` 字段 | MVP |
| 3 | 控件库 | `tb.toggleWidgetLibrary` | `widgets` + 「控件库」；`.on` 高亮 | **仅**切换 **WidgetLibraryPanel** 显隐；**不**影响 Outline / PropPanel / EventPanel | UI only | MVP |
| 4 | 颜色库 | `tb.colorLib` | `palette` + 「颜色库」 | 打开 `ColorLibraryDialog` | 读写 `project` 主题色表 | V1 |
| 5 | 资源管理 | `tb.assets` | `assets` + 「资源管理」 | 打开 `AssetsDialog` | 导入文件到 `assets/` | MVP 图 / V1 字 |
| 6 | 撤回 | `tb.undo` | **`undo` icon-only** | `historyStore.undo` | `project:undo` | MVP |
| 7 | 重做 | `tb.redo` | **`redo` icon-only** | `historyStore.redo` | `project:redo` | MVP |
| 8 | 存档 | `tb.save` | `save` + 「存档」 | 保存全部 JSON | `project:save` | MVP |
| 9 | 历史 | `tb.history` | `history` + 「历史」 | `HistoryDialog` 列表/恢复 | `.forge/history/` | V1 |
| 10 | 代码编辑器 | `tb.code` | `code` + 「代码编辑器」 | `CodeEditorDrawer` | 读写 `<codegenDir>/custom/**`；其余生成文件只读 | V1 |
| 11 | AI 设计 | `tb.ai` | `ai` + 「AI设计」 | 引导页：启用 MCP | `@forgeui/mcp` stub→V2 | V2 |
| 12 | C 语言 ▾ | `tb.cMenu` | `c-lang` + 「C语言 ▾」 | **仅 A1**：见下表 | `tool:generate` / `tool:preview` | MVP |
| 13 | **交付 ▾** | `tb.deliveryMenu` | `delivery` + 「交付 ▾」 | **A1 + A2**：见下表 | `tool:exportSdk` / `tool:pack` | MVP |
| 14 | MicroPython ▾ | — | — | **MVP 不展示** | FR-055 | P2 |

**工程历史快照（FR-004，对标 Beken 存档）：**

```text
.forge/history/
  20260730T143022Z/
    label: "before_theme_change"   # 可选用户标签
    project.json
    screens/
    assets/                       # 可选：仅索引或完整拷贝（V1 默认完整拷贝 screens+project）
```

| API | 行为 |
|-----|------|
| `snapshot.create(label?)` | 保存当前权威 JSON 至新时间戳目录 |
| `snapshot.list()` | 返回 `{ id, label, createdAt }[]` |
| `snapshot.restore(id)` | 事务性：先备份当前再覆盖；失败回滚 |

MVP 可不实现 UI；V1 `HistoryDialog` + 上述 API 经 Project Model 暴露。

**菜单职责分离（FR-010d）：**

| 菜单 | 职责 | 禁止混入 |
|------|------|----------|
| C 语言 ▾ | 静态 C 生成物 + PC 侧 cmake/SDL 仿真闭环 | SDK 拷贝、UI 包打包、Loader |
| 交付 ▾ | 把工程产物交给平台或 A2 运行时 | cmake 编译、SDL 窗口 |

**C 语言下拉菜单（对标 Beken §2.12 — 仅 A1 + PC 仿真）：**

| 菜单项 | 本产品语义 | 实现 |
|--------|------------|------|
| 全部清理 | 删除 `<codegenDir>/`（**保留 custom/**）与 `.forge/preview-build/out` | `tool:generate({ cleanOnly: true })` |
| 生成代码 | A1 CodeGen | `tool:generate` |
| 编译 | CMake configure + build，**不**启动 SDL 窗口 | `tool:preview({ buildOnly: true, skipGenerate: true })` |
| 模拟运行 | 启动已编译的 `forgeui_preview`（须先「编译」） | `tool:preview({ runOnly: true })` |
| 生成+编译+模拟运行 | 串联 generate → buildOnly → runOnly | 编排 |

**交付下拉菜单（本产品扩展 §2.15 — A1 平台 + A2 自有 UI 包）：**

| 菜单项 | 交付路径 | 本产品语义 | 实现 |
|--------|----------|------------|------|
| 导出到 SDK | **A1** | 将 **整个** `<codegenDir>/` 拷贝至 SDK `sdk.copyTargetRel`；目标侧 `include(forgeui_generated.cmake)`；缺失时先 `generate` | `tool:exportSdk` → `PlatformPlugin.copyCodegenDir` |
| 打包 UI 包 | **A2** | 由 Semantic IR 导出 **自有 UI 包**（`manifest.json` + `ui/` + `assets/`）至 `packages/latest/`；**与 C 源码无关** | `tool:pack` → `Packer.pack` |
| （V1）打开输出目录 | — | 资源管理器打开 `packages/latest/` 或上次 SDK `ui/` | 本地 shell |

**启用规则：**

- `deliveryMode=static_c`：**打包 UI 包** 置灰，Tooltip「当前为 static_c，未启用 A2」；**导出到 SDK** 仍可用。  
- `deliveryMode=dynamic_ui`：打包可用；导出 SDK 可选（Loader 集成文档仍建议保留 A1 路径）。  
- `deliveryMode=both`（默认）：两项均可用。

**次要入口：** `ProjectSettingsDialog` 底部「交付」操作区提供与上表相同按钮（便于配置 `sdk.path` / `deliveryMode` 后一键执行）。

**不做：** 烧录、板端调试器、ADB（立项边界）。

### 9.7 六区组件契约

#### 9.7.1 WidgetLibraryPanel（控件库）

> **参照：** `docs/beken界面/组件面板/组件面板.png`（Beken 称「组件库」；本产品称 **控件库**）。  
> **组件文件：** `WidgetLibraryPanel.vue`（现 `Palette.vue` 待重命名/refactor）。

**面板结构（自上而下）：**

| 区域 | 元素 | 行为 |
|------|------|------|
| 标题栏 | 栅格图标 + 「控件库」 | 纯展示 |
| Tab | **系统控件** \| **自定义控件** | 切换数据源；默认「系统控件」 |
| 搜索 | 占位符「搜索控件…」 | 过滤当前 Tab 内控件（中文 label、`type`、拼音首字母可选 P1） |
| 列表 | 可折叠 **分类** | 每类显示 `(数量)`；展开为 **网格磁贴**（图标 + 中文名） |

**MVP 系统控件分类（`WidgetRegistry.category` → 中文类名）：**

| category id | 显示名 | MVP 控件 |
|-------------|--------|----------|
| `layout` | 布局容器 | Container |
| `button` | 按钮 | Button |
| `display` | 数据展示 | Label |
| `input` | 表单输入 | Slider、Switch、Checkbox、Dropdown、Textarea |
| `media` | 图片媒体 | Image |
| `viz` | 可视化 | Bar、Arc |

（Screen 仅由页面管理创建，**不出现在**控件库。）

**自定义控件 Tab（FR-019）：**

| 分期 | 行为 |
|------|------|
| MVP | Tab 可切换；空态文案「暂无自定义控件」+ 说明「组合另存后将显示于此（V1）」 |
| V1 | 列表来自工程 `project.customWidgets[]`（或 `.forge/custom-widgets/`）；点击/拖入同系统控件 |

**交互：**

| 操作 | 行为 |
|------|------|
| 单击磁贴 | `addNode(parent)`，parent 规则同现 Palette |
| 拖拽到画布 | P1：落点换算 `frame` 后 `addNode` |
| 顶栏「控件库」 | `uiStore.widgetLibraryVisible = !…`；隐藏时左栏仅保留 **PageTreePanel** |

**数据：**

```typescript
interface WidgetSpec {
  type: string;
  category: "layout" | "button" | "display" | "input" | "media" | "viz" | string;
  label: { "zh-CN": string; en?: string };
  icon?: string;           // 磁贴图标 id 或内联 SVG key
  // …现有字段
}
```

| API | 说明 |
|-----|------|
| `listWidgetSpecs()` | 过滤 `screen`；按 `category` 分组供 UI |
| `project:listWidgets` | IPC 返回同上 |

**与属性面板边界：** 控件库负责 **选型与添加**；PropPanel 负责 **已选中控件的属性/几何**。二者不得共用 Tab 或同一显隐开关。

#### 9.7.2 Canvas + WidgetView

| 项 | 说明 |
|----|------|
| 坐标系 | 相对父节点；原点左上；单位 px（逻辑分辨率 = `display`） |
| 选中 | 单击选中；点击空白选中当前 screen |
| 移动 | mousedown-drag → 松手 `updateNode.frame`；阈值吸附 `alignNodeToNeighbors`（阈值默认 8px） |
| 缩放 | 选中角点拖拽改 `w/h`，最小 16 |
| 多选 | MVP：单选；V1：框选 + 对齐工具条（左/右/顶/底/居中） |
| 渲染 | CSS 近似；**禁止**作为 AC-003 像素依据 |

#### 9.7.3 PageTreePanel（页面 + 控件树）

> **映射表：** `docs/beken界面/组件面板/页面组件树-本产品映射.md`。  
> **文案：** 下段标题为 **「控件树 [N]」**（Beken 称组件树；本产品与「控件库」一致）。  
> **⋯ 菜单：** 使用 **`FloatingPanelMenu.vue`**（`Teleport`→`body`，`position:fixed`，`z-index:3000`），**禁止**在带 `overflow:auto` 的列表内用 `position:absolute`（参照 `docs/问题图片/页面面板的弹出菜单.png`）。

**面板结构（自上而下，固定于左栏控件库下方）：**

```text
PageTreePanel
├── PageListSection          # 「页面 [N]」
│     ├── header: 图标 + 标题 + count + [+]
│     └── rows: 页名 | 火箭(启动页) | ⋯
└── ComponentTreeSection     # 「控件树 [N]」
      ├── header: 图标 + 标题 + count(当前页节点数)
      └── ComponentTreeNode* # 递归；行内 眼睛 | ⋯
```

##### 9.7.3.1 PageListSection

| 交互 | 行为 | Core / IPC | 分期 |
|------|------|------------|------|
| 单击页行 | `projectStore.switchScreen(id)` | 已有 | MVP |
| **+** | `addScreen()` | `project:addScreen` | MVP |
| **火箭** | `setDefaultScreen(id)`；高亮当前 `defaultScreen` | `project:setDefaultScreen` | MVP |
| **⋯ → 重命名** | 内联或对话框；`renameScreen` | 已有 | MVP |
| **双击页名** | 进入内联编辑；Enter 确认 / Esc 取消；`renameScreen` | 已有 | **MVP**（对标 Beken workspace-tree.md） |
| **⋯ → 复制页面** | `duplicateScreen`；新 id `page_n`；复制 `screens/*.json` | `project:duplicateScreen` | MVP |
| **⋯ → 上移/下移/置顶/置底** | `reorderScreen` 调整 `project.screens[]` **列表顺序**（页面叠层/导航顺序） | `project:reorderScreen` | MVP |
| **⋯ → 删除** | `removeScreen`；≥1 页 | 已有 | MVP |

**视觉：** 选中页左侧蓝色竖条 + 背景高亮（对标 Beken `Page_1` 选中态）。

##### 9.7.3.2 ComponentTreeSection

| 交互 | 行为 | Core / IPC | 分期 |
|------|------|------------|------|
| 单击节点 | `select(nodeId)`；与 Canvas / PropPanel 同步 | FR-013 | MVP |
| **眼睛** | `setNodeFlags({ hidden: !hidden })` | `project:setNodeFlags` | MVP |
| 锁图标（可选行内） | `setNodeFlags({ locked })` | 同上 | MVP |
| **⋯ 菜单** | 见下表 | 各 IPC | MVP/V1 |
| 拖拽节点 | 同级排序 / 改父级（仅容器父） | `moveNode` | V1 |

**绘制叠层语义：** 同一 `parent.children[]` 内，**数组下标越大越靠上**（后绘制）；`moveNodeOrder(top|bottom|up|down)` 只调整同级 index。`frame.zIndex` 保留可选字段，**MVP 以 children 顺序为准**。

##### 9.7.3.3 ComponentActionMenu（⋯ 悬浮弹出）

> **组件：** `FloatingPanelMenu.vue` — 页面 ⋯ 与控件 ⋯ **共用**；锚点为 ⋯ 按钮 `getBoundingClientRect()`；菜单右缘对齐按钮（`translateX(-100%)`）。

| 菜单项 | API | 约束 | 分期 |
|--------|-----|------|------|
| 锁定 | `setNodeFlags({ locked: true })` | 锁定后画布禁止拖/缩 | MVP |
| 复制 | `duplicateNode` | 同级插入；id 自动递增 | MVP |
| 上移 / 下移 | `moveNodeOrder(up\|down)` | 非 screen 根 | MVP |
| 置顶 / 置底 | `moveNodeOrder(top\|bottom)` | 同级 z 序 | MVP |
| 左/中/右/上/中/下对齐 | `alignNodes(nodeIds, mode)` | 相对 **父容器 content 区** 或 screen；需 1+ 选中 | V1 |
| 创建自定义控件 | 写入 `project.customWidgets[]` | FR-019 | V1 |
| 删除 | `removeNode` | 不可删 screen 根 | MVP |

**画布联动：**

| `Node` 字段 | 组件树 | 画布 |
|-------------|--------|------|
| `hidden: true` | 眼睛关闭；名称 muted | 不渲染（或虚线占位 P1） |
| `locked: true` | 锁图标 | 可选中；**禁止** drag/resize |

##### 9.7.3.4 组件文件与迁移

| 现文件 | 目标 |
|--------|------|
| `Outline.vue` | `PageTreePanel.vue` |
| `TreeNode.vue` | `ComponentTreeNode.vue` |
| `ComponentTreeNode.vue` | 行内按钮；`@menu` 交由父级 **FloatingPanelMenu** |
| — | `FloatingPanelMenu.vue` | Teleport 悬浮层 |

**DesignerWorkbench 左栏：** `WidgetLibraryPanel`（可折叠）+ `PageTreePanel`（**始终可见**）。

##### 9.7.3.5 IPC 增补（Main `main.mjs`）

| Channel | Payload | Core |
|---------|---------|------|
| `project:duplicateScreen` | `{ screenId, newId? }` | `duplicateScreen` |
| `project:reorderScreen` | `{ screenId, where }` | `reorderScreen` |
| `project:setDefaultScreen` | `{ screenId }` | `setDefaultScreen` |
| `project:duplicateNode` | `{ screenId, nodeId }` | `duplicateNode` |
| `project:moveNodeOrder` | `{ screenId, nodeId, where }` | `moveNodeOrder` |
| `project:setNodeFlags` | `{ screenId, nodeId, locked?, hidden? }` | `setNodeFlags` |
| `project:alignNodes` | `{ screenId, nodeIds, mode }` | `alignNodes`（V1） |

每次 mutate 经 `withHistory` 入栈（FR-010c）。

**反模式：** ~~长期保留「大纲」横向 Tab 且无 ⋯ 菜单~~；~~隐藏/锁定仅存在于 Schema 而无 UI~~。

#### 9.7.4 PropPanel / StylePanel / EventPanel

**对标：** Beken 右侧「属性 | 事件」Tab；截图 `docs/beken界面/属性面板/`（38 控件 + 页面，见用户手册 §11.1）。  
**模块补充详设：** `docs/嵌入式UI工具_控件属性面板详细设计说明.md`（架构、API、分期、差距清单）。  
**用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`。  
**实现：** `InspectorPanel.vue`（Tab 容器）、`PropPanel.vue`（MVP 最小表单）、`StylePanel.vue`（V1 独立或 PropPanel 内嵌）、`EventPanel.vue`。

##### 9.7.4.1 布局与头部

| 项 | 约定 |
|----|------|
| 位置 | 工作区右栏，默认宽 **300px**（§9.5） |
| 结构 | 顶栏 **「属性 \| 事件」** Tab + 内容区；`InspectorPanel` 切换 `PropPanel` / `EventPanel`（对标 Beken） |
| 未选中 | 显示「未选中控件」空态 |
| 头部只读 | `type` + 中文标签（WidgetRegistry）、`id`（CodeGen 符号） |
| 头部可编辑 | `name`（大纲显示名，不影响 C 符号） |

##### 9.7.4.2 属性 Tab 折叠分组（顺序固定）

| 序号 | 分组 | screen 根 | 控件 | 写回 API |
|------|------|-----------|------|----------|
| 1 | **屏幕信息** / **位置信息** | 宽/高（无锚点格） | X/Y/W/H（V1：锚点/旋转/布局） | `updateScreen` / `updateNode.frame` |
| 2 | **属性** | 背景等页面级 | `props` 动态表单 + `extraData` 内嵌编辑器 | `updateNode.props` / `updateNode.extraData` |
| 3 | **行为配置** | — | 对象 flags、预览 state | V1：`updateNode.flags` |
| 4 | **样式** | 页面背景 | Part×State 子组 | `updateNode.style` |

各分组标题左侧蓝色圆点（Beken 一致）；样式子组可带眼睛图标切换是否参与渲染（V1）。

**选中同步：** 画布单击 / 页面树单击 → `selectionStore.select` → PropPanel 即时刷新（FR-013）。

##### 9.7.4.3 动态属性表单

由 **WidgetRegistry** 驱动，仅渲染当前 `type` 的 `PropSpec[]`：

| PropSpec.type | UI 控件 |
|---------------|---------|
| `string` / `number` / `boolean` | 输入框 / 开关 |
| `enum` | 下拉 |
| `range` | min/max 双字段或 Range 控件 |
| `color` | `#RRGGBBAA` 色值 + 可选颜色库引用（V1，FR-018） |
| `imageSrc` | 路径输入 + 资源管理器选择（MVP 可手填 `props.src`） |

变更经 `project:updateNode` 写回 `screens/*.json`，标记 `dirty`，须 **Ctrl+S 存档** 后 CodeGen 才读磁盘。

##### 9.7.4.4 extraData 内嵌编辑器（V1）

当 `WidgetSpec.extraData` 存在时，在 **属性** 分组内渲染专用编辑器（非子控件树）：

- 列表类：`items[]`、`spans[]` — 增删行、行内字段编辑  
- 表格类：`cells[]` + `row_cnt`/`col_cnt` — 行列维度与单元格值  
- 图表类：`series[]` — 颜色、轴、整型 `data[]`（长度须匹配 `point_count`）  
- 导航类：`tabs[]`、`tiles[]`、`pages[]` — 与 Beken component-specs 字段同名  

写回 `node.extraData`；校验器检查数组项 schema 与 LVGL symbol 白名单（`allowedLvglSymbols`）。

##### 9.7.4.5 StylePanel（FR-017）

| 项 | MVP | V1 |
|----|-----|-----|
| Part 选择 | 固定 `main` | 下拉：`main`、`indicator`、`knob`、`items`…（见用户手册 §4.4.1） |
| State 选择 | 固定 `default` | `default`、`pressed`、`focused`、`disabled`、`checked`… |
| 样式子组 | 背景（`bg_color`）、字体（`text_color`）、边框（`radius`） | + 渐变、内边距、阴影、Image 专用（`img_recolor`、`img_opa`） |
| 样式库 | — | 保存/应用命名主题（FR-018） |

CodeGen 将 `style.parts[part][state]` 映射为 `lv_obj_set_style_*`（LVGL 9.10）；映射表见 §16 待收口项。

##### 9.7.4.6 通用操作

| 操作 | 行为 |
|------|------|
| 画布拖拽/缩放 | 与 `frame` 双向同步；松手入历史栈（FR-010c） |
| 删除控件 | 面板底部「删除控件」或树 ⋯ → 删除；非 screen；可撤回 |
| 生成/预览前 | 若 `dirty` 则自动存档 |

##### 9.7.4.7 MVP 与 V1 验收对照

| 能力 | MVP | V1 |
|------|-----|-----|
| 位置 X/Y/W/H | ✓ | ✓ |
| 常用 props（text、value、src…） | 子集 | 38 控件全量 |
| 样式 main/default 常用键 | ✓ | — |
| Part/State 下拉 + 全样式子组 | — | ✓ |
| extraData 编辑器 | — | ✓ |
| 行为 flags | — | ✓ |
| 属性/事件 Tab 视觉 | Tab 对齐 Beken | Tab 对齐 Beken |

#### 9.7.5 EventPanel

| 项 | 说明 |
|----|------|
| 展示 | 当前节点 `events[]` |
| 触发 | CLICKED / PRESSED / RELEASED / LONG_PRESSED / VALUE_CHANGED |
| 动作 MVP | `CHANGE_SCREEN`（目标页下拉）、`CALL_FUNCTION`（handler 标识符） |
| 动作 V1 | `SET_PROP` / 改样式（FR-032） |
| 写回 | `setNodeEvents`；CodeGen 生成 cb + `custom/` 桩 | FR-030～033、037 |
| 禁止 | 事件只存在 Vue 本地 state（AR-050） |

### 9.8 附属对话框 / 抽屉（对标 Beken 工作区 2/4/5/9/10/11）

| 界面 | 对标图（Beken 说明） | 本产品内容 | 分期 |
|------|----------------------|------------|------|
| `ProjectSettingsDialog` | 工作区2-项目设置 | 平台、显示、lvglVersion、**deliveryMode**、entrySymbol、**sdk.path**、previewBackend；**交付区**：「导出到 SDK」「打包 UI 包」按钮（同 `tb.deliveryMenu`） | MVP |
| `ColorLibraryDialog` | 工作区4-颜色库 | 命名色列表 CRUD；属性色值可引用 | V1 |
| `AssetsDialog` | 工作区5-资源管理 | 图片导入/删除/引用计数提示；字体 V1 | MVP/V1 |
| `HistoryDialog` | 工作区9-历史版本 | `.forge/history/<ts>/` 快照；恢复前确认 | V1 |
| `CodeEditorDrawer` | 工作区10-代码编辑器 | **全屏**（顶栏/底栏外，`Teleport` 至 body）；Monaco 或 textarea；默认打开 `custom/ui_events.c` | V1 |
| `AiAssistPanel` | 工作区11-AI设计 | 说明 MCP 工具列表与授权；深链外部 IDE | V2 |
| `LogPanel` | 工作区-全（画布下仿真日志） | generate/preview/export 诊断流；**嵌入 center 列底部**；cmake 行级 IPC 流式刷新 | MVP |

### 9.9 Pinia stores

| Store | 状态 | 主要 action |
|-------|------|-------------|
| `projectStore` | loaded、screenId、selectedId、dirty、log | open/create/save、mutate、generate、preview、export、pack |
| `selectionStore` | （可并入 project）screenId + nodeId | select、switchScreen |
| `historyStore` | undoStack / redoStack（序列化工程快照） | push、undo、redo |
| `previewStore` | `busy`、`phase`、`session` | `begin/end`；`generateAndPreviewRun` 整段持锁；与 MCP `PREVIEW_BUSY` 对齐 |
| `settingsStore` | sdkPaths、locale、recentProjects、showExperimentalMp | load/save 全局配置文件 |
| `uiStore` | `widgetLibraryVisible`、rightTab、dialogs、`logPanelCollapsed` | 纯 UI |
| **撤销/重做** | **Main 进程 `EditorHistory`**：每次 mutate IPC 前 `recordEditorHistory`；`project:undo`/`redo` 恢复 `current` 并返回 `{ loaded, screenId, selectedId, canUndo, canRedo }` | FR-010 |

**写路径：** 组件 → `projectStore` mutation → Main IPC → `@forgeui/core` → 返回序列化工程 → 刷新视图。

### 9.10 关键交互时序（摘录）

**拖拽添加控件：**

```text
WidgetLibraryPanel.click(type)
  → projectStore.addWidget(type)
  → IPC project:addNode
  → core.addChildNode
  → 返回 node → 选中 → Canvas 重绘
```

**导出到 SDK：**

```text
tb.deliveryMenu「导出到 SDK」
  → previewStore.begin("导出到 SDK")（可选，与 cmake 互斥）
  → 若 sdk.path 空：目录对话框
  → tool:generate（若 `<codegenDir>/` 缺失）
  → tool:exportSdk → platforms.exportToSdk
  → LogPanel 输出目标路径；成功链到 FORGEUI_INTEGRATION.md
```

**打包 UI 包：**

```text
tb.deliveryMenu「打包 UI 包」
  → 若 deliveryMode=static_c：禁用，不调用
  → previewStore.begin("打包 UI 包")
  → tool:pack → packer.pack → packages/latest/
  → MVP stub：LogPanel 提示 E_PACK_NOT_IMPL；V1 写完整 manifest + ui/
```

**生成并模拟运行：**

```text
tb.cMenu「生成+编译+模拟运行」
  → previewStore.begin("生成+编译+模拟运行")
  → tool:generate
  → tool:preview({ buildOnly:true, skipGenerate:true })
      → PreviewHost: runProcessAsync(cmake configure/build)
  → tool:preview({ runOnly:true })
      → spawn(detached) forgeui_preview.exe
  → previewStore.end()
  → 失败：LogPanel + App 底栏摘要（FR-061）
  → 进行中：Canvas 只读 overlay；LogPanel 实时追加 cmake 行（FR-061c）
```

**反模式：** ~~将「导出 SDK / 打包 UI 包」放入 C 语言菜单~~ — A2 UI 包与 C 源码生成解耦，须走 **交付 ▾** 或项目设置交付区。

### 9.11 IPC API 一览（Preload）

| 通道 | 方向 | 用途 |
|------|------|------|
| `dialog:openProjectDir` / `chooseNewProjectDir` | R←M | 选目录 |
| `project:open` / `openHello` / `create` / `save` | R↔M | 工程生命周期 |
| `project:updateNode` / `setEvents` / `addNode` / `removeNode` | R↔M | 节点编辑 |
| `project:addScreen` / `renameScreen` / `removeScreen` / `alignNode` | R↔M | 页面与对齐 |
| `project:listWidgets` | R←M | 控件库 |
| `shell:openProjectFolder` | R←M | 打开当前工程根目录（`shell.openPath`） |
| `tool:generate` / `preview` / `exportSdk` / `pack` | R←M | 交付与预览 |

新增 UI 能力时：**先加 core API，再暴露 IPC**，禁止 Renderer 旁路写盘。

### 9.12 界面验收用例（设计器侧）

| ID | 步骤 | 期望 | 对应 AC |
|----|------|------|---------|
| UI-01 | 主页新建 hello 双页 → 工作区可见两页 | 无需手写 JSON | AC-001 |
| UI-02 | 画布拖按钮、改事件切页+Call | 保存后 JSON 含 events；再生成 user 不丢 | AC-002 |
| UI-03 | C 菜单 → 模拟运行 | SDL 可点（环境具备时） | AC-003 |
| UI-04 | **交付菜单 → 导出 SDK** | 目标含 **单个** `<codegenDir>/` + `forgeui_generated.cmake` | AC-004 |
| UI-04b | **交付菜单 → 打包 UI 包** | `packages/latest/manifest.json` 存在（V1）；MVP 可 stub | AC-010 |
| UI-05 | 顶栏五键可达 | 主页/工作区/设置/文档/关于均可切换 | 体验门禁 |
| UI-06 | 无工程进工作区 | 显示新建引导而非空白五区 | 对标 Beken 主2 |
| UI-07 | C 菜单「生成+运行」后移动鼠标、滚动大纲 | 窗口不卡死；画布显示 busy；编译结束可继续编辑 | FR-061a |
| UI-08 | 启动设计器 → 打开工作区 → C 菜单生成+预览 | 主窗口最大化；LogPanel 在画布下方可见 cmake 行级输出（非结束后一次性弹出） | FR-010b、FR-061c |

### 9.13 与 Beken 界面的差异声明（合规）

| Beken | ForgeUI Kit |
|-------|-------------|
| `.bkprj` 单文件权威 | 多文件目录权威；`.forgeui` 仅分享 |
| C + MicroPython 双通道默认 | MVP 仅 C；MP 为 P2 实验 |
| 云资源 | 自有 Hello / 板级模板 |
| AI 内置于工作区 | MCP stub，V2 填满 |
| 博通仿真 port 品牌资源 | 自研 `templates/sdl-sim`，无他厂商标素材 |

---

## 10. CLI 详细设计

```text
forgeui <command> [options]

Commands:
  validate   <projectDir>
  generate   <projectDir> [--clean-generated] [--prune-orphans]
  preview    <projectDir> [--backend sdl]
  pack       <projectDir> [-o outDir]
  export-sdk <projectDir> [--force]
  bundle     <projectDir> -o file.forgeui [--no-codegen]
  unbundle   <file.forgeui> -o projectDir
  create     <projectDir> --platform qm10xd [--template hello-dual-screen]
```

| 命令 | Exit 0 | Exit ≠0 |
|------|--------|---------|
| validate | 无 error 级诊断 | 有 error |
| generate | CodeGen ok | 校验失败或写入失败 |
| preview | 进程启动成功（可选） | 编译/校验失败 |
| pack | V1 打包成功；MVP stub 可用 exit 2 + `E_PACK_NOT_IMPL` | 其它错误 |

---

## 11. 扩展点 Stub（AR）

> **MCP 完整契约**见《嵌入式UI工具_MCP接口详细设计说明.md》；本节保留模块落点摘要。

### 11.1 MCP（V2，AR-020～022；对标 Beken MCP + Skill）

MCP Server 名：**`forgeui_designer`**；Bridge：**`FORGEUI_BRIDGE=http://127.0.0.1:39201`**；工作区：**`.forge-ai/`**。

公开工具（V2 冻结）：

```text
forgeui_get_editor_state
forgeui_batch_get
forgeui_batch_update
forgeui_update_node
forgeui_add_node_tree
forgeui_get_page_screenshot
forgeui_create_image_asset
forgeui_generate
forgeui_ping
```

`batch_get` / `batch_update` 内部 operation 类型与 Project Model API 映射见 MCP 详设 §5～§6。

**工作流（Beken 式）：** 外部 AI 宿主 → stdio MCP → HTTP Bridge → Project Model API → validate → 设计器刷新；用户 **保存/撤销** AI 事务。

权限：显式授权；只改模型；不改 `custom/` 已有实现；生成仅经 `forgeui_generate` → CodeGen。

### 11.2 Importer（AR-030～031）

```ts
interface Importer {
  id: string;
  canHandle(file: string): boolean;
  import(file: string, model: ProjectModelApi): Promise<MutationResult>;
}
```

内置：`ForgeuiBundleImporter`（unbundle）；`FigmaImporter` stub → `E_IMPORT_NOT_IMPL`。

### 11.3 Logic Graph（AR-050）

事件仅存 JSON；`apps/designer` 不实现逻辑图画布；禁止把事件只保存在 Vue 组件 state。

---

## 12. 错误码

| Code | 含义 | 典型出口 |
|------|------|----------|
| `E_SCHEMA_001` | JSON Schema 失败 | validate |
| `E_SEM_001` | id 冲突 / 悬空引用 | validate |
| `E_VER_001` | `lvglVersion` 不在白名单 | validate |
| `E_PLAT_001` | 平台插件未实现 | export-sdk |
| `E_SDK_001` | SDK 路径无效 | export-sdk |
| `E_GEN_001` | CodeGen 模板/写入失败 | generate |
| `E_PREV_001` | 预览编译失败 | preview |
| `E_PACK_NOT_IMPL` | Packer stub | pack（MVP） |
| `E_PREVIEW_WASM_NOT_IMPL` | Wasm stub | preview |
| `E_IMPORT_NOT_IMPL` | Importer stub | import |
| `E_LOADER_VER` | 包版本不兼容 | Loader（V1） |
| `E_LOADER_RES` | 分辨率/色深不兼容 | Loader（V1） |
| `E_LOADER_FMT` | 包格式损坏 | Loader（V1） |

---

## 13. 黄金用例与测试

### 13.1 工程 `tests/golden/hello_dual`

- 双页 + Label/Button/Image  
- 点击切页 + `CALL_FUNCTION on_btn_next`  
- `lvglVersion=9.10`，`platform=qm10xd`，`deliveryMode=both`

### 13.2 断言

| 用例 | 断言 |
|------|------|
| G-01 | `validate` exit 0 |
| G-02 | `generate` 产出 `forgeui_generated/ui.c` 含 `ui_init` |
| G-03 | 二次 generate 不修改已编辑的 `custom/ui_events.c` 业务段 |
| G-04 | `preview` 可启动（CI 可跳过 GUI，保留 compile） |
| G-05 | 生成 C 与上一版本 golden diff 受控（允许时间戳除外） |
| G-06 | （V1）`ui_nav.c` 存在且 `CHANGE_SCREEN` 调用 `ui_nav_load_screen` | FR-053a |

CI：Node 单测 + golden generate（NFR-005）。

---

## 14. 实现里程碑（编码顺序）

| 序 | 交付 | 门禁 |
|----|------|------|
| M1 | `schemas` + `core` validate/open/save + hello 工程 | CLI validate |
| M2 | `codegen` + `custom/` 规则 + golden + 旧工程迁移 | CLI generate |
| M3 | `preview-host` SDL + sdl-sim 模板 | CLI preview Hello |
| M4 | `platforms/qm10xd` + 上板文档 | AC-005 |
| M5 | `apps/designer` 应用壳五键 + 工作区五区 + 双页拖拽事件（对标 beken界面） | AC-001～003；UI-01～06 |
| M6 | Packer/Loader V1 填满 + 默认 both | AC-010～012 |
| M7 | xv/xh、Part/State、字体裁剪等 V1 | FR-017/041/007 |
| M8 | MCP / Wasm / Figma 按 AR stub→填满 | V2/V3 |

**禁止：** 先堆 Electron 壳而无 M1～M3。

---

## 15. 与竞品实现的映射（合规）

| 能力 | 参照谁 | 本产品做法 | 禁止 |
|------|--------|------------|------|
| JSON+模板 CodeGen+SDL | Beken（`ref/beken/`） | 自有 Schema + Handlebars + sdl-sim | 读 `.bkprj` 兼容 |
| 五区体验 / 主壳五键 / 存档历史 | Beken 界面 + Beken JSON | AppShell + `.forge/history/` | 搬 `app.asar` |
| 事件边界 / ui_helpers | SquareLine（`ref/quareline/`） | `custom/ui_events.*` + `ui_nav.*` | 兼容 `.spj` |
| SDK 一键拷贝 / Part/State | UIBuilder（`ref/artinchip/`） | PlatformPlugin qm10xd + `style.parts` | 兼容 `.aicpro` |
| build manifest / 无头 Build / Wasm 架构 | EEZ（`ref/EEZ Studio/`） | `.forge/build-manifest.json` + CLI | GPL 换皮、搬 `lvgl_runtime_v*` |
| CLI/CI/Figma 形态 | LVGL Pro（`ref/lvgl_pro/`） | Importer 插件 + `forgeui validate` | 官方 XML Engine |
| 应用包 / 智能屏部署 | Persim / FlyThings（`ref/rt-thread/`、`ref/中科世为/`） | **不做**；A2 仅薄 Loader | 混称范式 B |
| MCP 改工程 | Beken 2.x + Pro MCP 叙事 | AR-020 MCP stub→V2 | 见 **MCP 接口详设** |

---

## 16. 待详细设计收口（非产品选型）

| 项 | 说明 |
|----|------|
| `custom/` 新 handler 追加策略 | 文末追加 vs 旁路 stubs 文件，M2 前二选一写进黄金用例 |
| 生成句柄命名 | 扁平符号 vs `ui` 结构体，M2 锁定 |
| `.forgeui` 是否默认含 codegen 目录 | 默认建议不含，减小分享包 |
| Part/State CodeGen 映射表 | `style.parts.*.states.*` → LVGL API 对照表，V1 M7 前锁定 |
| 38 控件 PropSpec 分期表 | 以用户手册 §5.0 为验收清单；MVP 子集见 §4.3 |
| extraData 编辑器组件库 | 列表/表格/chartSeries 等待 V1 M7 前统一抽象 |
| 历史快照体量策略 | 仅 JSON vs 含 assets；V1 前与存储上限约定 |
| qm10xd SDK 真实目录与宏名 | 对接 SDK 负责人填 `platforms/qm10xd/README` |
| LVGL「9.10」与上游/SDK 精确 tag | 与 D-04 台账对齐后替换字符串 |

---

## 17. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.0 | 2026-07-29 | 首版：基于概要设计 V1.5、需求 V2.3 与 ref 下 Beken/UIBuilder/SquareLine/EEZ 分析文档 |
| V1.1 | 2026-07-29 | 大幅扩充 §9 界面详细设计：对标 `docs/beken界面` 主壳/主页/工作区工具条与附属面板；补 IPC、时序、UI 验收用例 |
| V1.2 | 2026-07-30 | 依据竞品报告与 ref：§3.5.1 Part/State、§5 ui_nav、§6.3 Wasm 架构、§9.6 历史快照、§11.1 MCP 摘要、§15 七家映射；MCP 详设另册 |
| V1.14 | 2026-08-01 | 属性面板补充详设独立成文：`嵌入式UI工具_控件属性面板详细设计说明.md` |
| V1.13 | 2026-08-01 | **控件属性面板**详设：§3.5.2 数据模型、`extraData`、WidgetSpec 扩展；§9.7.4 PropPanel/StylePanel 全量分组与 38 控件分期；用户手册 `控件属性面板使用说明.md` |

---

*本文为详细设计契约；与概要设计冲突时以已锁定决策 D-01～D-07 与需求 KF/OUT 为准。界面实现以 §9 与用户手册 `控件属性面板使用说明.md` 为准，编码前对 §16 收口项做一次短会确认即可开工。*
