# 嵌入式 UI 工具软件概要设计说明

> **文档类型：** 软件概要设计（HLD）  
> **产品暂名：** ForgeUI Kit（可替换）  
> **目标平台：** qm10xd / qm10xv / qm10xh  
> **版本：** V2.6  
> **日期：** 2026-08-01  
> **V2.6：** **控件属性面板**概要设计（§5.6.6）：对标 Beken 38 控件 + 页面；PropPanel 分组、Part×State、`extraData`；用户手册 `docs/工具详细说明手册/控件属性面板使用说明.md`。
> **V2.5：** **D-07** 单目录生成物：`forgeui_generated/` + 内嵌 `custom/`（对标 Beken）；SDK 整目录拷贝 + 单 cmake include。
> **V2.4：** 左栏 **页面与组件树**（PageTreePanel）对齐 Beken `页面组件库.png`；组件 ⋯ 菜单对齐 `组件修改菜单.png`（FR-011a/b、FR-013a/b）。
> **V2.3：** 工作区顶栏按钮视觉对齐 Beken：**图标+名称** 磁贴；**撤回/重做** 改为通用弯箭头 **icon-only**（FR-010f）。
> **V2.2：** 工作区顶栏 **项目名称** 按钮：展示工程名 + 脏标记；**点击打开项目文件夹**（`shell:openProjectFolder`，对标 Beken）。
> **V2.1：** 工作区顶栏新增 **「交付 ▾」**；**导出到 SDK**（A1）与 **打包 UI 包**（A2）自 C 语言菜单迁出（FR-010d）；C 语言菜单仅保留静态 C + PC 仿真五步。
> **V2.0：** 壳层体验对齐 Beken：Electron **启动默认最大化**；工作区 **LogPanel** 固定于画布下方（非遮罩抽屉）；cmake 日志流式显示（FR-010b、FR-061c）。
> **V1.9：** 预览服务非阻塞：PreviewHost cmake 必须异步 spawn；设计器 `previewStore` 编译期锁画布（FR-061a）。
> **V1.8：** 工作区布局修订：**控件库面板**（WidgetLibraryPanel）与 **Outline** 解耦；顶栏「控件库」仅控控件库显隐（FR-010a）；控件库 UI 对标 Beken `docs/beken界面/组件面板/组件面板.png`。
> **状态：** 草案（供架构评审 / AC-AR 门禁）；D-01～D-07 已锁定  
> **MVP 首发平台：** qm10xd  
> **MVP LVGL 版本线：** 仅 1 条 — 9.10  
> **A2 策略：** 默认启用（`deliveryMode=both`）  
> **工程权威格式：** 多文件目录；单文件仅导出/分享  
> **上游依据：** 《产品定义书》《设计需求文档》V2.7、《竞品对比分析报告》《立项书》；`ref/` 各竞品逆向与重构设计说明  
> **界面蓝本：** `docs/beken界面/界面说明.txt`（L1 体验对齐 Beken 壳与工作区；格式自有，禁止 L4）

---

## 1. 文档说明

### 1.1 目的

将产品定位与需求基线落实为 **可评审的系统架构**：分层、模块边界、主数据流、关键接口、工程目录契约，以及后置能力（A2 / MCP / Figma / Wasm / 逻辑图）的 **架构预留（AR）** 落点。

本文是需求文档 §8.2 AR 与 AC-AR-001～004 的 **设计期交付物**。允许 Packer / MCP / Figma / Wasm 等为空实现或 stub，但扩展点、数据流与禁止写死项必须可指认。

### 1.2 读者

| 角色 | 用途 |
|------|------|
| 架构 / 研发负责人 | 方案冻结、模块分工、技术选型 |
| 研发 | 接口契约、目录约定、实现边界 |
| 测试 | 黄金用例、CLI 门禁、合规检查范围 |
| 产品 / 项目 | 分期与架构门禁对齐 |

### 1.3 关联文档

| 文档 | 关系 |
|------|------|
| `嵌入式UI工具_产品定义书.md` | 定位、用户、Must/Should/Could/Won't |
| `嵌入式UI工具_设计需求文档.md` | KF / FR / AR / AC / OUT / DR / NFR；**§3.7 竞品借鉴** |
| `嵌入式UI工具_竞品对比分析报告.md` | 范式选型、七家能力矩阵、MVP 优先级、实现路径 |
| `ref/beken/`、`ref/quareline/`、`ref/artinchip/`、`ref/EEZ Studio/` 等 | 分竞品逆向结论与合规红线 |
| `嵌入式UI工具_立项书.md` | 立项范围与分期原则 |
| `嵌入式UI工具_软件详细设计说明.md` | 按模块展开算法、API 签名、Schema 与**界面详细设计** |
| `嵌入式UI工具_MCP接口详细设计说明.md` | **V2** MCP Server、Bridge、工具面、Skill（对标 Beken MCP） |
| `docs/beken界面/界面说明.txt` | Beken 主壳 / 工作区信息架构参照（体验蓝本，非工程兼容） |

### 1.4 设计原则（锁定）

| 原则 | 说明 | 来源 |
|------|------|------|
| 范式 A 为主 | LVGL 源码导出进固件；可选 A2 薄包，不做范式 B | 产品 / 需求 / 竞品 |
| 自有 JSON 唯一权威 | 禁止第二权威格式；Importer 只写模型 | DR-001、AR-030～031 |
| 交付分期 ≠ 设计分期 | 后置功能可晚交付，扩展点须本期设计 | 需求 §3.6、C-007 |
| 核心芯片无关、集成可插拔 | CodeGen/语义表不绑死 SoC；SDK 拷贝按平台插件 | 竞品 §8.3、C-004 |
| 像素以真 LVGL 为准 | 画布可近似；验收看 SDL/板端 | FR-021、C-002 |
| 业务代码不可侵犯 | `<codegenDir>/custom/` 永不覆盖；其余生成物可覆盖 | KF-04、FR-037、D-07 |
| L1+L2，拒绝 L4/L5 | 体验/功能对齐；不做他厂工程/闭源 runtime 兼容 | 竞品 §2.3、OUT |

### 1.5 建设顺序（实现门禁）

与竞品共识及需求 §9.1 一致：

```text
Schema + 语义表 → CodeGen → 真预览（SDL）→ CLI 门禁
        → 设计器 GUI →（填满）A2 / Wasm / MCP / Importer / 逻辑图
```

**功能门禁：** 无完整设计器时，仅 CLI `validate + generate + preview` 须跑通 Hello。

---

## 2. 系统概述

### 2.1 系统目标

交付 PC 端 LVGL 可视化工具链，支撑：

```text
选 qm10x 平台 → 拖拽多页 → 配事件 → 生成标准 LVGL C
    → SDL 真预览 → 接入平台 SDK / 板上首屏
（V1 可选）同一工程导出 UI 包 → 薄 Loader 换皮
```

### 2.2 系统边界

```text
┌──────────────────────────────────────────────────────────┐
│                     ForgeUI Kit                          │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Designer│  │   CLI   │  │ MCP Stub │  │ Importers  │ │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └─────┬──────┘ │
│       └────────────┴───────────┴───────────────┘         │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │  Project Model API  │                     │
│              └──────────┬──────────┘                     │
│         ┌───────────────┼───────────────┐                │
│         ▼               ▼               ▼                │
│    CodeGen(A1)     Packer(A2)     PreviewHost            │
│         │               │               │                │
└─────────┼───────────────┼───────────────┼────────────────┘
          ▼               ▼               ▼
     forgeui_generated/  自有 UI 包      SDL / 未来 Wasm
     （含 custom/）          │
          │              ▼
          └────► qm10x SDK / 板端 LVGL（± 薄 Loader）
```

**系统内：** 工程模型、校验、语义表、CodeGen、Packer、预览编排、设计器、CLI、平台模板与 SDK 拷贝插件。  
**系统外：** qm10x SDK、板端 LVGL port、烧录/调试工具、OTA 传输、第三方 AI 宿主（Cursor 等，经 MCP）。

### 2.3 运行时与交付形态

| 形态 | MVP | 演进 |
|------|-----|------|
| 桌面设计器 | **Electron + Vue3**；Windows 优先 | Win / macOS / Linux（V1 明确路线） |
| CLI | `validate` / `generate` / `preview` | CI、UI 截图测试 |
| 板上 A1 | `forgeui_generated/` 编入固件（单 cmake include） | — |
| 板上 A2 | stub / 关闭 | 薄 Loader + UI 包（V1） |
| MCP / Importer | 接口 + 空实现 | V2 / V3 填满 |

---

## 3. 总体架构

### 3.1 逻辑分层

| 层 | 职责 | 主要模块 |
|----|------|----------|
| **交互层** | 人机入口；不持有权威数据 | Designer UI、CLI、MCP Server（后置）、Online（远期） |
| **应用服务层** | 用例编排：打开工程、改属性、生成、预览、拷贝 SDK | WorkspaceService、GenerateService、PreviewService、PlatformExportService |
| **领域核心层** | 工程模型、校验、语义 IR、控件注册表 | ProjectModel、SchemaValidator、WidgetRegistry、SemanticIR |
| **交付后端层** | 将同一 IR 转为 C 或 UI 包 | CodeGen、Packer、AssetPipeline |
| **预览宿主层** | 可插拔预览后端 | PreviewHost、SdlBackend、WasmBackend（后置） |
| **平台适配层** | qm10x\* 模板、路径、一键拷贝 | PlatformPlugin（xd/xv/xh） |
| **导入适配层** | 外部设计 → 自有 JSON | Importer 插件位（Figma 等） |

### 3.2 架构风格

- **管道 + 插件：** 权威数据进模型后，经校验管道分发到 CodeGen / Pack / Preview；平台与导入为插件。  
- **单一写入总线：** 一切变更经 Project Model API（AR-020）；GUI 不得直写散落文件绕过校验。  
- **双交付同源：** 同一屏对象树（Semantic IR）可走 A1 与 A2（AR-010、C-006）。

### 3.3 主数据流（锁定，对应需求 §8.1）

```text
Designer / CLI /（未来 MCP · Importer）
              │  Project Model API
              ▼
        自有 JSON（唯一权威）── Schema 校验
              │
              ▼
         Semantic IR（控件语义表展开）
              │
     ┌────────┼────────────────┐
     ▼        ▼                ▼
  设计器视图  A1 CodeGen     A2 Packer（可 stub）
              │                │
              ▼                ▼
         forgeui_generated/   自有 UI 包
         （含 custom/）           │
              │                ▼
              │           自研薄 Loader
              └──────────► 开源 LVGL
                    ▲
                    │
            PreviewHost（sdl / 未来 wasm）
```

### 3.4 关键架构约束（C-*）

| ID | 约束 | 设计落点 |
|----|------|----------|
| C-001 | 设计器 / CLI / MCP / Importer 共用同一工程模型与生成逻辑 | §5.1、§6 |
| C-002 | DOM 近似不得作为像素验收 | PreviewHost 以 LVGL 为准 |
| C-003 | Wasm 须自研且绑定 `lvglVersion` | WasmBackend 接口 |
| C-004 | A2/MCP/Figma/逻辑图可关闭；SDK 拷贝按平台开关 | Feature flags + PlatformPlugin |
| C-005 | A2 不得滑向厚宿主 / 多 App | Loader 边界、OUT-004 |
| C-006 | A1/A2 共用控件语义表 | SemanticIR 单一来源 |
| C-007 | 全部 AR 须有模块落点方可架构冻结 | §8 扩展点清单 |

---

## 4. 工程与数据模型

### 4.1 工程目录（权威格式，DR-002 / D-06）

**权威工程 = 多文件目录**（打开/保存/Git/CLI/CodeGen 均认此形态）。单文件仅作导出/导入分享选项，导入后须展开为下列目录，**不得**成为第二权威格式。

```text
<project>/
  project.json          # 工程元数据（权威入口）
  screens/              # 每页一文件（或等价拆分）
    home.json
    settings.json
  assets/               # 图片、字体源等
  i18n/                 # 可选；V1～V2 填满
  forgeui_generated/      # D-07：A1 单目录（对标 beken_generated）
    forgeui_generated.cmake
    ui.c / screens/ / image/ / fonts/
    custom/               # 用户业务（再生成不覆盖）
      ui_events.c
      ui_events.h
  .forge/               # 工具缓存：预览构建、校验报告等（可不入库）
```

| 形态 | 用途 | 说明 |
|------|------|------|
| 多文件目录 | **日常权威** | 设计器默认打开/保存；Git 友好 |
| 单文件（如 `.forgeui` / zip 打包，扩展名详细设计定） | **导出/分享/备份** | Adapter：打包 ↔ 展开；失败事务回滚，不污染半份 `forgeui_generated/` |

Git 友好：明文 JSON；`forgeui_generated/` 可按团队策略选择是否入库；**`custom/` 建议入库**。

### 4.2 `project.json` 关键字段（DR-005）

| 字段 | 说明 | MVP |
|------|------|-----|
| `schemaVersion` | 工程格式版本；演进扩展点 | 必填 |
| `name` | 工程名 | 必填 |
| `platform` | `qm10xd` / `qm10xv` / `qm10xh` / … | 必填 |
| `display` | 分辨率、色深等 | 必填 |
| `lvglVersion` | MVP 固定为承诺版本线（见 D-04：`9.10`） | 必填 |
| `previewBackend` | `sdl` \| `wasm`（未来） | 必填，默认 `sdl` |
| `deliveryMode` | `static_c` \| `dynamic_ui` \| `both` | 必填；**产品默认 `both`（D-05：A2 默认启用）**；可改 `static_c` 关闭 A2 |
| `screens` | 页面引用列表 | 必填 |
| `assets` / `fonts` | 资源索引 | 按需 |
| `entrySymbol` | 默认如 `ui_init` | 必填 |

方言须有意区别于他厂工程（DR-006），禁止宣称兼容 `.spj` / `.bkprj` / Pro XML 等。

### 4.3 控件节点模型（DR-003～004）

```text
Node {
  type: string          # 注册表枚举，可扩展
  id: string            # 工程内稳定 ID
  name: string
  frame: { x,y,w,h,... }
  props: object
  style: object         # MVP 基础；V1 Part/State（对标 Beken parts/states、UIBuilder）
  events: Event[]       # 存模型，非画布私有状态（AR-050）
  children: Node[]
}
```

**样式模型演进（V1，对标 Beken / UIBuilder / SquareLine Themes）：**

```text
style: {
  parts: {
    main: {
      default: { bg_color, text_color, ... },
      pressed: { ... },    # LVGL state 映射
      focused: { ... }
    },
    indicator: { ... }     # 按 WidgetRegistry.styleParts 扩展
  }
}
```

MVP 可扁平化为 `style.main.default`；Schema 校验须允许 V1 嵌套升级，禁止写死仅扁平键。

**Event / Action 分层（AR-014）：**

| 类别 | 存哪 | 谁执行 | 说明 |
|------|------|--------|------|
| UI 动作 | 工程 /（A2）包内 | 生成代码或 Loader 动作表 | 切页、改属性、切语言等 |
| Host Call | 工程声明符号 + `custom/` 实现 | 固件 | Call function；包不能链新驱动 |

### 4.4 控件注册表（NFR-006）

```text
WidgetRegistry
  ├── type → Spec（属性 schema、styleParts、extraData 编辑器、默认值、可嵌套约束）
  ├── type → SemanticMapper（JSON Node → SemanticIR）
  ├── type → CodeGenEmitter（IR → C 片段 / 模板上下文）
  └── type → PackEmitter（IR → 包内描述，可 stub）
```

**单一数据源（NFR-006）：** 设计器 **控件库**、**属性面板**动态表单、CodeGen、Pack **同源读取** WidgetRegistry；V1 目标 38 种控件（对标 Beken），MVP 子集见 FR-014。

### 4.5 Semantic IR（AR-010）

中间表示与「直接 printf 式 C 模板」解耦：

```text
JSON Node ──SemanticMapper──► ScreenIR / WidgetIR / EventIR / AssetRef
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               CodeGen(A1)     Packer(A2)     Preview 约定
```

设计期验收：同一屏对象树可同时描述「如何生成 C」与「如何打成包」（AC-AR-002）；Pack 路径 MVP 可为 stub。

### 4.6 UI 包（A2，DR-008～009）

```text
ui_package/
  manifest.json     # version, minLoaderVersion, platform hints,
                    # resolution, colorDepth, lvgl major, schemaVersion
  ui/               # 由工程 Schema 同源或机械派生的界面描述
  assets/
```

与工程 Schema **同源或可机械派生**；禁止第二套无关格式。

---

## 5. 核心模块设计

### 5.1 Project Model API（AR-020～022）— 工具链总线

**职责：** 工程唯一读写入口；GUI / CLI / MCP / Importer 均为调用方。

| API 组 | 能力（概要） | 调用方 |
|--------|--------------|--------|
| Workspace | `open` / `create` / `save` / `close` | 全部 |
| Query | `getProjectMeta` / `getScreen` / `listWidgets` / `getNode` | 全部 |
| Mutate | `updateNode` / `addNode` / `removeNode` / `setEvents` / … | GUI、MCP、Importer |
| Validate | `validate()` → 诊断列表；非 0 语义对齐 CLI | CLI、CI、保存前 |
| Pipeline | `applyMutation` → validate →（可选）notifyViews | GUI、MCP |
| Generate | `generate(A1)` / `pack(A2)` 委托交付层 | GUI、CLI |
| Export | 禁止直接改 `<codegenDir>/` 非 custom 区；生成仅经 CodeGen | AR-022 |

**权限边界（AR-022 / NFR-004）：**

- MCP/AI **只允许**改自有 JSON 模型。  
- 禁止写 `<codegenDir>/`（非 `custom/`）、禁止输出他厂格式、禁止执行不可信工程脚本。  
- MCP 需显式用户授权（后置交付时落实）。

**设计期验收（AC-AR-003）：** 设计器改属性最终调用本 API；CLI 与未来 MCP 复用同一校验器。

### 5.2 SchemaValidator

- 输入：工程目录或内存模型。  
- 输出：错误 / 警告（含定位 path）。  
- CLI：`validate` 失败退出码非 0（FR-058）。  
- 与 `schemaVersion` 演进策略：向后兼容优先；破坏性变更升主版本并提供迁移钩子（可后置实现）。

### 5.3 CodeGen（A1）

| 项 | 设计 |
|----|------|
| 输入 | Semantic IR + 工程元数据 |
| 输出 | `<codegenDir>/**`（非 custom）+ `forgeui_generated.cmake` |
| 不覆盖 | `<codegenDir>/custom/**`（含 Call function 空实现首次生成后） |
| 模板 | 模板引擎（Handlebars 或同类）+ 黄金测试（NFR-005） |
| 辅助模块 | V1 生成 `ui_nav.*`（对标 SquareLine `ui_helpers`：切屏/简单动画 helper） |
| 入口 | 文档化符号（默认 `ui_init()`，FR-052） |
| 版本 | 生成物与 `lvglVersion` 一致（FR-054） |

**用户区策略（已锁定，对应 FR-033/051/056）：**

- **默认且 MVP 唯一路径：** Call function 等业务桩写入 `<codegenDir>/custom/`；首次可生成空实现，**再生成检测已存在则跳过、永不覆盖**。  
- **weak 符号（FR-056）：** 不作为默认；若 V1 需要，仅作显式可选项，须单独文档说明，**禁止与 `custom/` 默认策略无文档并存两套语义**。

### 5.4 Packer / Loader（AR-012～013）

| 模块 | MVP | V1 |
|------|-----|-----|
| Packer | 模块边界 + `NotImplemented` 或空包骨架 | 导出完整 UI 包 |
| Loader | 接口与错误码约定文档 | 板端参考实现：装载 → LVGL 对象树 |

**薄 Loader 边界（AR-013、C-005）：**

- 做：解析包、建 LVGL 对象、执行白名单动作表、版本/分辨率校验。  
- 不做：多 App、应用商店、包内替换驱动、完整应用 VM（OUT-004/007）。

装载 API：路径或内存缓冲；OTA 传输不绑死（FR-085）。

### 5.5 PreviewHost（AR-040～041）

```text
PreviewHost
  ├── resolveBackend(previewBackend) → PreviewBackend
  ├── prepare(generate if needed)
  ├── start() / stop()
  └── getLogs()
```

| Backend | 交付 | 说明 |
|---------|------|------|
| `SdlBackend` | MVP | generate → CMake → SDL+LVGL；可点选 |
| `WasmBackend` | V2 | 自研 Emscripten LVGL（对标 EEZ `lvgl_runtime_v*` / Pro `lved-runtime` **架构**，非二进制）；与 CodeGen 共用语义表；禁止搬他厂 runtime |

**Wasm 演进要点（对照 `ref/EEZ Studio/`、`ref/lvgl_pro/`）：**

- 输入：与 SDL 相同——先 CodeGen 或 IR 直驱 Wasm 桥，**不**维护第二套控件映射。  
- 绑定：Wasm 构建与 `project.lvglVersion`（9.10）同 tag；帧缓冲 → Canvas/WebGL 由 PreviewHost 抽象。  
- MVP：仅 `SdlBackend` 实现；`WasmBackend` 接口 + `E_PREVIEW_WASM_NOT_IMPL`。  
- 合规：禁止依赖 EEZ GPL 仓闭源分发或 LVGL Pro 的 `lved-runtime.wasm`。

接口抽象为「给定工程 → 可交互预览」，**不**把「必须起外部 SDL 窗口」写死为唯一扩展点（AR-041）。热替换（FR-063）在此接口上演进。

### 5.6 Designer（交互层）— 界面概要设计

> **体验原则（产品定义 §6.2）：** 闭环优先于控件数量；像素以真 LVGL 为准；`custom/` 不可侵犯；平台路径要短；诚实表述 A2「换 UI 包」。  
> **竞品对齐：** L1 工作台/工作流接近 Beken（`docs/beken界面`）；L2 功能按 KF/FR；**不做** `.bkprj` / MicroPython 默认通道 / 他厂云资源兼容（立项 OUT、竞品 L4 拒绝）。

#### 5.6.1 应用壳导航（对标 Beken 顶栏五键）

启动后进入 **应用壳（AppShell）**，顶栏固定五个一级入口（与 Beken「主页 / 工作区 / 设置 / 文档 / 关于」同构）：

| 顶栏入口 | 路由建议 | 无工程打开时 | 有工程打开时 | 对应 FR / 分期 |
|----------|----------|--------------|--------------|----------------|
| **主页** | `/home` | 欢迎 + 快速开始 + 最近工程 | 同左（可从工作区返回） | FR-001、FR-003、FR-005 |
| **工作区** | `/workspace` | **新建/打开引导**（对标 Beken「主2-新建项目」） | **五区设计工作台**（对标「主2-工作区」） | FR-010～016、030～033 |
| **设置** | `/settings` | 全局 SDK 路径、语言、默认平台、预览后端 | 同左 + 可链到当前工程设置 | FR-002、008、062、070 |
| **文档** | `/docs` | 内嵌/外链：上板 HELLO、API 入口、本产品使用说明 | 同左 | NFR-007、AC-005 文档侧 |
| **关于** | `/about` | 产品名、版本、许可声明、合规口径 | 同左 | AC-007、产品定义 §6.3 |

```text
AppShell
  ├── HomeView          # 上：欢迎；中：快速开始；下：最近项目
  ├── WorkspaceGate     # 无工程 → Create/Open；有工程 → DesignerWorkbench
  ├── SettingsView
  ├── DocsView
  └── AboutView
```

**窗口 chrome：** 仅保留 **自定义 AppShell 顶栏**；**不** 使用 Electron/macOS 默认 `File / Edit / View / Window / Help` 系统菜单（误设计已移除）。

#### 5.6.2 主页布局（对标 Beken 主1 上/中/下）

| 区域 | 内容 | MVP | 说明 |
|------|------|-----|------|
| 上部 | 欢迎语 + 一句话价值（拖拽 → 标准 LVGL C → SDL/板端） | ✅ | 品牌级信号，避免「通用仪表盘感」 |
| 中部 · 快速开始 | **新建工程**、**打开/导入工程**、**文档**、**示例与模板** | ✅ | Beken「云资源」→ 本产品改为 **Hello / 板级模板**（自有，非他厂云） |
| 下部 | **最近工程**列表（路径、平台、上次打开时间） | ✅（可先本地列表） | FR-005；点击直接进工作区 |

导入：支持自有多文件目录打开；可选 `.forgeui` 单文件展开（D-06）；**禁止**打开 `.bkprj` / `.spj` 等。

#### 5.6.3 工作区信息架构（对标 Beken 工作区全貌）

有工程时，工作区 = **顶栏工具条 + 六区工作台**（FR-010、FR-010a）。

**（1）工作区顶栏（Beken 工具条映射）**

> **视觉：** 对标 `工作区/工作区-全.png` — 默认 **图标+名称** 纵向磁贴；**撤回/重做** 仅图标（弯箭头）。映射表见 `docs/beken界面/工作区顶栏-本产品映射.md`。

| Beken 项 | 本产品项 | 视觉 | MVP | 备注 |
|----------|----------|------|-----|------|
| 项目名称 | 工程名 + 脏标记 `*`；点击打开根目录 | 文件夹图标 + 名称 | ✅ | `tb.projectName` |
| 项目设置 | 工程设置对话框 | 齿轮 + 「项目设置」 | ✅ | |
| 控件库 | **控件库面板**显隐 | 栅格 + 「控件库」；`.on` 高亮 | ✅ | FR-010a |
| 颜色库 | 主题色 / 命名色 | 调色板 + 「颜色库」 | — | V1 |
| 资源管理 | Assets 面板 | 资源 + 「资源管理」 | ✅ 基础 | |
| 撤回 / 重做 | Undo / Redo | **仅** ↶ / ↷ 图标；Tooltip 含快捷键 | ✅ | 禁止中文主视觉 |
| 存档 | 保存工程 | 磁盘 + 「存档」 | ✅ | |
| 历史 | 工程快照 | 时钟 + 「历史」 | — | V1 |
| 代码编辑器 | 编辑 `custom/` | 代码 + 「代码编辑器」 | 🟡 | V1 |
| AI 设计 | MCP 引导 | AI + 「AI设计」 | stub | V2 |
| C 语言菜单 | A1 静态 C + PC 仿真五步 | C + 「C语言 ▾」 | ✅ | 不含 SDK/UI 包 |
| **交付 ▾** | SDK 导出 + UI 包 | 包裹 + 「交付 ▾」 | ✅ | 本产品扩展 |
| MicroPython | （不默认） | — | — | P2 |

**顶栏菜单分工（FR-010d）：**

- **C 语言 ▾** = 开发者在本机验证 **A1 静态 C** 的闭环（生成 → cmake 编译 → SDL 仿真）。对标 Beken §2.12，**不扩展** SDK 或 UI 包能力。  
- **交付 ▾** = 把产物交给 **平台（A1）** 或 **板上 Loader（A2）**：与「是不是 C 代码」无概念绑定；A2 UI 包来自 Schema/IR，**不得**放在 C 语言菜单下。  
- **项目设置** = 配置 `sdk.path`、`deliveryMode`，并提供与交付菜单相同的次要操作按钮。

**（2）六区工作台（画布中心）**

> Beken 原文称「组件库」；本产品统一称 **「控件库」**（控件 = 可拖入画布的 LVGL widget）。参照 `docs/beken界面/组件面板/组件面板.png`。

```text
┌─ Toolbar（见上） ─────────────────────────────────────────────┐
├─ WidgetLibrary ─┬──────── Canvas ────────┬─ PageTreePanel ─────┤
│  （可折叠）      │   DOM 近似画布          │  页面 [N]          │
│  系统/自定义 Tab │   （非像素验收）         │  控件树 [N]        │
│  分类 + 搜索     │                        │  （始终可见）       │
│                 ├─ LogPanel（构建/运行日志，标题栏收起/展开，默认展开）─┤
├─────────────────┴────────────────────────┼─ Prop / Event ────┤
│                                          │  属性 + 事件       │
└──────────────────────────────────────────┴───────────────────┘
App 壳层最底行 `.foot`：阶段摘要 + LVGL/平台版本（无重复「收起日志」）
```

| 规则 | 说明 |
|------|------|
| 控件库开关 | 顶栏「控件库」**仅**切换 **WidgetLibraryPanel**；**页面与控件树**、属性、事件 **不受其影响**（FR-010a） |
| 页面/控件树 | **PageTreePanel**：页面列表 + **控件树**；⋯ **FloatingPanelMenu** 悬浮菜单（FR-011a/b、FR-013a/b） |
| 写回 | 所有编辑 → Project Model API（与 CLI/MCP 同源） |
| 画布 | 近似渲染；**像素验收不靠 DOM**（FR-021、C-002） |
| 事件 | 读写工程 `events`；逻辑图仅为后置视图（AR-050） |
| 生成/预览 | 调 GenerateService / PreviewService，**禁止** UI 内第二套 CodeGen |
| 选中同步 | 画布 ↔ **组件树** ↔ 属性（FR-013） |
| 属性面板 | **PropPanel** 编辑 `frame`/`props`/`style`/`extraData`；**EventPanel** 编辑 `events`；与控件库解耦（FR-010a、FR-016） |

#### 5.6.4 属性面板（PropPanel / StylePanel）

**对标：** Beken 右侧属性区（`docs/beken界面/属性面板/`）；**用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`。

| 项 | 说明 |
|----|------|
| 位置 | 右栏 300px；MVP 上下分块 Prop + Event；V1 「属性 \| 事件」Tab |
| 分组顺序 | 屏幕信息/位置信息 → 属性（含 extraData 编辑器）→ 行为配置（V1）→ 样式 |
| 数据写回 | 全部经 Project Model API（`updateNode` / `updateScreen`），与 CLI/MCP 同源（AR-020） |
| screen 根 | 页面树选中时首组「屏幕信息」（宽/高，无锚点格） |
| 样式 V1 | Part×State 下拉 + 背景/字体/边框/阴影等子组（FR-017） |
| 控件库边界 | 控件库 **只添加**；属性面板 **只编辑** 已选节点 |

详设：§9.7.4；38 控件字段总览见用户手册 §5.0。

#### 5.6.5 关键界面与对话框（概要）

| 界面 | 触发 | 核心字段 / 行为 | 分期 |
|------|------|-----------------|------|
| 新建工程向导 | 主页 / 工作区无工程 | 名称、平台 qm10xd/v/h、分辨率、色深、模板 blank\|hello、`deliveryMode` 默认 both | MVP |
| 工程设置 | 工作区顶栏 | 同 FR-002 + SDK 路径 + `deliveryMode` + 预览后端；**交付区**含「导出到 SDK」「打包 UI 包」次要按钮 | MVP |
| 资源管理 | 顶栏 | 图片列表导入；字体 V1 | MVP/V1 |
| 颜色库 | 顶栏 | 命名色/主题 | V1 |
| 历史版本 | 顶栏 | 快照列表、恢复 | V1 |
| 代码编辑器 | 顶栏 | `custom/ui_events.*` 可写；同目录其余生成文件只读 | V1 |
| AI 设计 | 顶栏 | 说明需外部宿主 + MCP 授权；本窗可只做引导 | V2 |
| 生成/预览结果 | C 菜单 / 交付菜单 | **LogPanel**（画布下方固定区）；失败展示 cmake / pack / export 诊断 | MVP |
| **交付 ▾** | 顶栏（C 语言菜单之后） | **导出到 SDK**：PlatformPlugin **整目录**拷贝 `<codegenDir>/`；**打包 UI 包**：Packer → `packages/latest/`；`static_c` 时禁用打包 | MVP（xd）/ V1 填满 pack |

#### 5.6.6 界面与需求/验收映射

| 界面能力 | KF / FR | AC |
|----------|---------|-----|
| 主页新建双页工程 + 工作区拖拽 + 属性编辑 | KF-01/02，FR-010～012、FR-016 | AC-001 |
| 事件面板切页 + Call function | KF-03/04，FR-030～033 | AC-002 |
| C 菜单 → 预览 | KF-06，FR-060～062 | AC-003 |
| **交付菜单 → 导出 SDK** | KF-05/07，FR-008 | AC-004/005 |
| **交付菜单 → 打包 UI 包** | FR-081，AR-012 | AC-010（V1） |
| 自有 JSON 只读可见于代码/**组件树** | KF-08 | AC-006 |

详细控件级交互、组件树与 IPC 见《软件详细设计说明》§9。

### 5.7 CLI

| 命令 | 行为 | 优先级 |
|------|------|--------|
| `validate <project>` | Schema 校验 | P1（MVP 建议同期具备，作为门禁） |
| `generate <project>` | A1 CodeGen | P0 |
| `preview <project>` | PreviewHost 默认 sdl | P0 |
| `pack <project>` | A2 Packer | P1（可先返回未实现） |
| `export-sdk <project>` | 平台插件拷贝 | P0–P1 |

无头路径是 CI 与 MCP 的落点（AR-021）。

### 5.8 PlatformPlugin（KF-07）

```text
PlatformPlugin {
  id: qm10xd | qm10xv | qm10xh | ...
  defaultSdkPathHints()
  projectTemplate()
  copyGenerated(src, sdkPath) → Result
  boardHelloDoc()          # ≤10 步（NFR-007）
}
```

- **核心生成器芯片无关**；平台差异收敛在插件与模板。  
- **MVP：** 以 **qm10xd** 为首发验收平台（D-03 / AC-005）；Hello 模板与 ≤10 步上板文档先覆盖 xd。  
- **V1：** 补齐 qm10xv / qm10xh 平台模板（FR-007）。

### 5.9 AssetPipeline

| 能力 | 优先级 |
|------|--------|
| 图片导入 → C 数组或 FS 路径宏 | P0 |
| TTF → LVGL 字体 + 字符裁剪 | P1 |
| i18n 键值 / 预览切换 | P1–P2 |
| XLIFF | P2 |

### 5.10 Importers（AR-030～031）

```text
importers/
  Importer { canHandle(file) → bool; import(file) → ModelMutation (事务) }
  figma/     # P3，可空壳
```

- 链路固定：**外部文件 → Adapter → 自有 JSON**。  
- 导入失败回滚，不得污染半份 `forgeui_generated/`。  
- Figma 只是 Adapter 之一，禁止输出他厂官方 XML 方言。

### 5.11 MCP Server（AR-020～022，交付 P2）

> **接口详设：** 见《嵌入式UI工具_MCP接口详细设计说明.md》（对标 Beken `beken_lvgl_ui_designer` MCP + Bridge + Skill）。

| MVP 设计期 | V2 交付 |
|------------|---------|
| 声明 `forgeui_*` 工具面；Bridge 127.0.0.1:39201；`.forge-ai/` 工作区约定 | `packages/mcp` + Main Bridge + Skill 安装器 |
| 权限边界写入本文与 MCP 详设 | 显式授权；只改模型；`forgeui_generate` 经 CodeGen |

### 5.12 Logic Graph View（AR-050，交付 P2～P3）

- 事件数据只存工程模型。  
- 逻辑图 = 编辑视图，可后加；禁止「事件只活在画布控件状态里」。

---

## 6. 接口与进程关系

### 6.1 进程模型（MVP）

```text
┌──────────────────────────────┐     ┌──────────────────────┐
│ Designer (Electron+Vue3)/CLI │────►│ 本机工具链            │
│                              │     │ CMake + 编译器 + SDL │
└──────────────┬───────────────┘     └──────────────────────┘
               │ write
               ▼
         工程目录（JSON / forgeui_generated）
```

Wasm 嵌入编辑器时，PreviewHost 可改为同进程或 Worker；接口不变。

### 6.2 模块依赖（允许方向）

```text
交互层 → 应用服务层 → 领域核心层
交付后端 / 预览宿主 / 平台插件 / 导入插件 → 领域核心层（读 IR）
禁止：CodeGen 依赖 Designer UI；禁止 Packer 维护另一套控件语义
```

---

## 7. 技术选型建议

> 选型以团队栈优先；下列为与竞品可复制路径对齐的默认建议（可替换，但须满足分层与 AR）。

| 模块 | 选型 | 备选 / 备注 | 理由 |
|------|------|--------------|------|
| 设计器壳 | **Electron + Vue3（已锁定）** | — | 对齐 Beken 可复制路径；跨 OS；与明文 JSON/CLI 同生态 |
| 工程格式 | **自有多文件 JSON 为权威**（D-06）+ JSON Schema；单文件仅导出 | — | Git 友好；避 L4；对齐 DR-002 |
| CodeGen | 模板引擎 + 黄金测试 | — | Beken/EEZ 可参考 |
| 用户代码 | **`custom/` 不覆盖（D-02/D-07）** | weak 仅 V1 可选（FR-056） | 对齐 Beken；SDK 单目录 |
| 预览 MVP | CMake + SDL2 + 本机 LVGL | — | 与上板同源 |
| 预览 V2 | 自研 Emscripten LVGL | — | 禁搬 Pro/EEZ 官方 wasm 包 |
| CLI | 与核心同语言绑定的无头入口 | 独立二进制调同一库 | 保证 C-001 |
| 包管理 / 构建 | npm/pnpm（Electron 前端）+ 预览侧 CMake | — | 与壳选型一致 |

**合规：** 依赖许可证台账（NFR-001）；不 GPL 换皮闭源（OUT-006）；不冒用商标（NFR-002）。

---

## 8. 扩展点清单（AC-AR-001）

| 扩展点 | 模块 / 目录约定 | 对应 AR | MVP 状态 |
|--------|-----------------|---------|----------|
| 工程模型 API | `core/project-model` | AR-020～022 | **须实现** |
| 校验管道 | `core/validate` | AR-021 | **须实现** |
| 控件语义表 / IR | `core/semantic` + `widgets/registry` | AR-010、C-006 | **须实现** |
| CodeGen 后端 | `backends/codegen` | AR-010 | **须实现** |
| Packer | `backends/packer` | AR-012 | 接口 + stub |
| Loader | `runtime/loader`（参考实现仓或子目录） | AR-012～013 | 接口文档 + stub |
| deliveryMode / schemaVersion | `project.json` | AR-011 | **字段落地** |
| action / host-call 分层 | 事件数据模型 | AR-014 | **模型字段落地**；执行器后置 |
| PreviewBackend | `preview/` | AR-040～041 | sdl **实现**；wasm 位预留 |
| Importer 插件位 | `importers/` | AR-030～031 | 目录 + 接口 stub |
| PlatformPlugin | `platforms/qm10x*` | C-004、KF-07 | **MVP：qm10xd 实现**；xv/xh V1 |
| 逻辑图视图 | `views/logic-graph` | AR-050 | 不实现；事件已存模型 |
| MCP Server | `hosts/mcp` | AR-020～022 | 接口说明 + stub |

---

## 9. A1 / A2 双交付论证（AC-AR-002）

### 9.1 同源路径

```text
同一 ScreenIR
   ├─ CodeGenEmitter  → forgeui_generated/*.c  → 固件链接 LVGL（单 cmake）
   └─ PackEmitter     → ui_package/**  → Loader → 运行时建树
```

### 9.2 Schema 无死胡同

- `deliveryMode` 控制导出哪些后端；**产品默认 `both`（A2 默认启用，D-05）**；改为 `static_c` 可关闭 A2，且关闭后仍须满足 AC-012 / FR-095。  
- MVP 阶段 Packer 可 stub，但新建工程默认值与字段契约按 `both` 预留，避免 V1 再改默认策略。  
- 控件 Spec 同时挂 CodeGenEmitter 与 PackEmitter；后者可返回 `Unsupported`。  
- UI 包 Schema 由工程 Schema 派生（DR-009），避免两套无关模型。

### 9.3 Stub 与填满计划

| 阶段 | Packer | Loader |
|------|--------|--------|
| MVP | Packer 接口 + stub（工程默认 `both` 已写入） | 接口与错误码约定文档 |
| V1 | 导出包 + manifest 校验字段（**默认启用**） | 参考实现；AC-010～011 |
| V2 | 包内白名单动作表 | 执行器 + 固件符号表（AC-013） |

---

## 10. 非 GUI 工具链论证（AC-AR-003）

```text
CLI / 未来 MCP
    → ProjectModel.open
    → mutate? → validate
    → generate / preview
    →（GUI 若打开）subscribe(ModelEvents) 刷新
```

- 设计器属性修改与 CLI 批处理 **同一** `updateNode` + `validate`。  
- MCP 不引入旁路写盘。  
- 黄金用例：无 GUI 的 Hello 工程 `validate && generate && preview`。

---

## 11. 预览可替换性论证（AC-AR-004）

| 反模式（禁止） | 正确做法 |
|----------------|----------|
| 核心类型名写死 `SdlOnlyPreview` | `PreviewBackend` 接口 + `previewBackend` 字段 |
| 验收只认画布 DOM | AC 绑定 SDL/板端 |
| Wasm 复用他厂 `lved-runtime` / `lvgl_runtime_v*` | 自研并绑定 `lvglVersion` |
| 生成逻辑塞进 SDL 工程模板无法复用 | 先 CodeGen，再模板工程 `include(forgeui_generated.cmake)` |

---

## 12. 安全、合规与功能开关

| 项 | 设计 |
|----|------|
| 功能开关 | `deliveryMode`、平台插件启用表、`previewBackend`、importer/mcp 编译或配置开关 |
| MCP | 显式授权；只读/写模型分级（详细设计） |
| 包装载 | 版本不兼容 → 文档化错误码（NFR-009）；失败可诊断 |
| 发行物扫描 | 无未授权他厂二进制/商标（AC-007） |
| 对外口径 | 不宣称兼容官方工程 / 范式 B / 应用商店 |

---

## 13. 分期落地映射

| 阶段 | 架构动作 | 功能交付（摘要） |
|------|----------|------------------|
| **MVP** | 冻结 §3～§8；AC-AR-001～004；CLI 门禁 | KF-01～08；AC-001～007 |
| **V1** | 填满 Packer/Loader；Platform 补齐 | Part/State、字体、CLI、A2、AC-010～012 |
| **V2** | 填满 MCP、Wasm、AR-014 执行侧 | 动画、i18n、逻辑增强、AC-013 |
| **V3** | 填满 Importer/Figma、Online、UI 测试 | FR-073～075 |
| **另册** | 不在本架构扩展 | 范式 B / 仪器台 |

---

## 14. 建议仓库布局（逻辑）

```text
forgeui/
  packages/
    core/                 # ProjectModel, Schema, SemanticIR, Registry
    codegen/
    packer/               # stub → V1
    preview-host/
      backends/sdl/
      backends/wasm/      # stub
    platforms/
      qm10xd/
      qm10xv/
      qm10xh/
    importers/            # stub
    mcp/                  # stub
  apps/
    designer/             # Electron + Vue3 桌面壳
    cli/
  templates/
    sdl-sim/
    hello-dual-screen/
  runtime/
    loader/               # A2 参考实现（V1）
  docs/
  tests/
    golden/               # CodeGen / 校验黄金用例
```

具体单体/多包以团队工程化习惯调整；**逻辑边界不得合并到无法关闭 A2/MCP**。

---

## 15. 设计决策台账

### 15.1 已确认

| ID | 事项 | 结论 | 日期 |
|----|------|------|------|
| D-01 | 设计器壳 | **Electron + Vue3** | 2026-07-29 |
| D-02 | 用户代码隔离默认策略 | **`<codegenDir>/custom/`：再生成不覆盖**；weak 不作默认（FR-056 仅 V1 可选） | 2026-07-29 |
| D-07 | 生成物目录形态 | **单根目录** `forgeui_generated/`（内嵌 `custom/`）；废弃根下并列 `generated/`+`user/` | 2026-07-30 |
| D-03 | MVP 首发平台排序 | **先 qm10xd**（AC-005 首发验收平台）；qm10xv / qm10xh 模板 V1 补齐 | 2026-07-29 |
| D-04 | 默认 LVGL 版本线 | **仅 1 条**：目标 **LVGL 9.10**（工程 `lvglVersion` 默认/`9.10`；与 qm10xd SDK 捆绑版本对齐验收） | 2026-07-29 |
| D-05 | A2 启用策略 | **默认启用**（非可选插件）；新建工程 `deliveryMode=both`；可改 `static_c` 关闭 | 2026-07-29 |
| D-06 | 工程存储形态 | **多文件目录为权威**；单文件仅作导出/分享/备份选项（导入后展开） | 2026-07-29 |

### 15.2 仍待决（Open）

无（MVP 架构待决项 D-01～D-07 均已锁定）。扩展名、单文件是否 zip、导出是否含 `forgeui_generated/` 等交详细设计。

---

## 16. 架构评审检查表

评审通过须能书面回答：

- [ ] **AC-AR-001** 扩展点清单（§8）齐全：模型 API、Packer/Loader、Importer、PreviewBackend、语义表  
- [ ] **AC-AR-002** 同一对象树可走 CodeGen 与 Pack；Schema 无死胡同；stub 计划明确  
- [ ] **AC-AR-003** 非 GUI 可校验、修改模型并触发生成；与设计器共用 API  
- [ ] **AC-AR-004** 未把仅 SDL / 仅静态 C / 仅 GUI 写死为不可替换假设  
- [ ] OUT / C-005：A2 边界仍为薄 Loader，无范式 B 暗示  
- [ ] 合规：无 L4/L5、无 GPL 换皮闭源路径  

**通过：** 可宣布 MVP 架构冻结，进入详细设计与实现。  
**不通过：** 禁止以「以后再说」跳过 AR；须改方案后再评。

---

## 17. 竞品实现路径对照（报告 §5.3、§8.3 与 `ref/`）

> 本节说明各竞品在 **本架构中的映射位置**，便于评审时核对「学谁、不抄谁」。详细字段与 API 见《软件详细设计说明》§15～§16。

### 17.1 技术栈与工程格式

| 竞品 | 壳 / 格式 | 本产品对应 | 兼容策略 |
|------|-----------|------------|----------|
| Beken | Electron+Vue；`.bkprj` JSON | Electron+Vue3；多文件 JSON（D-06） | L1 壳与工作流；**L4 不做** |
| SquareLine | 闭源跨平台；`.spj/.sll` | 同上 + AppShell 五键 | L1 事件/`ui_helpers` 心智 |
| UIBuilder | Qt5；`.aicpro` XML | PlatformPlugin + SDK 拷贝 | L2 SDK 短路径；**L4 不做** |
| EEZ | Electron+React；`.eez-project` | Project Model API + build manifest | 开源对照；**GPL 不 fork 闭源** |
| LVGL Pro | Theia；官方 XML | Importer/Figma/CLI 为 V3 插件 | **禁止** Pro XML 权威格式 |
| Persim / FlyThings | VS Code/Eclipse；应用包 | **不纳入**本产品线 | 仅作 A2 边界反例 |

### 17.2 预览模型选型

| 模式 | 竞品 | 本产品 |
|------|------|--------|
| 编辑器内 Play | SquareLine | **不**复用闭源 Play；V2 可选自研 Wasm 缩短反馈 |
| Wasm 真 LVGL | EEZ、LVGL Pro | V2 `WasmBackend`；MVP **SDL 同源验收**（报告 §4.2） |
| 生成→编译→SDL | Beken、UIBuilder | **MVP 默认**（KF-06、FR-060） |
| 编译进程模型 | Beken spawn 工作进程，UI 不卡 | **禁止** Main 上 `spawnSync(cmake)`；`runProcessAsync` + `previewStore.busy`（FR-061a） |
| 打包→模拟器宿主 | Persim、FlyThings | **不做** |

### 17.3 建设顺序（与报告 §5.3、需求 §9.1 一致）

```text
Schema + SemanticIR + Validate
  → CodeGen(A1) + custom/ 规则 + ui_nav(V1)
  → PreviewHost(SdlBackend) + CLI 门禁
  → Designer（Beken 壳 L1 + 五区）
  → PlatformPlugin(qm10xd) + 上板文档
  → Packer/Loader(V1) + Part/State + 历史快照
  → Wasm / MCP / Figma / 逻辑图（按 AR 填满）
```

### 17.4 合规红线汇总（各 `ref/*/竞品逆向与重构设计说明` 共识）

- 不读写他厂官方工程（`.bkprj`、`.spj`、`.aicpro`、`.eez-project`、Pro XML、`.ftu`、`.prc`）。  
- 不复用闭源导出器、Play/Wasm 二进制、专有 GUI 宿主。  
- 不 GPL 换皮、不冒用商标；对外口径为「功能与体验对齐」，非「兼容某某工程」。

---

## 18. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.0 | 2026-07-29 | 首版：依据产品定义、需求 V2.3、竞品报告编写；覆盖 AR 与 AC-AR |
| V1.1 | 2026-07-29 | 锁定 D-01 Electron+Vue3、D-02 `user/` 默认策略 |
| V1.2 | 2026-07-29 | 锁定 D-03：MVP 首发平台 qm10xd |
| V1.3 | 2026-07-29 | 锁定 D-04：仅 1 条 LVGL 版本线 9.10 |
| V1.4 | 2026-07-29 | 锁定 D-05：A2 默认启用（deliveryMode=both） |
| V1.5 | 2026-07-29 | 锁定 D-06：多文件权威；单文件仅导出 |
| V1.6 | 2026-07-29 | 补充 §5.6 界面概要设计：对标 `docs/beken界面` 主壳五键与工作区工具条；映射 KF/FR/AC |
| V1.7 | 2026-07-30 | 依据竞品报告与 `ref/`：§4.3 样式 V1 模型、§5.3 ui_nav、§5.5 Wasm 演进、§17 竞品实现路径对照 |
| V2.6 | 2026-08-01 | **控件属性面板**概要：§5.6.4 PropPanel 分组、Part×State、extraData；WidgetRegistry 单一数据源扩展 |

---

*本文为概要设计，不替代字段级 Schema 与函数级详细设计。范围冲突时：立项签批 > 产品定义 > 需求基线 > 本文实现细节排期。*
