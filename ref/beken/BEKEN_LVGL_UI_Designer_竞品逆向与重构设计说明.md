# BEKEN LVGL UI Designer 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** 博通集成 **BEKEN LVGL UI Designer**（本地线索 **2.0.3**；仿真/文档侧 LVGL **9.3**）  
> **输入材料：** `beken/博通集成ui工具.txt`、本地包 `lvgl_ui_designer_2.0.3`；既有分析/综合/实现原理文档；GitHub README 与 `doc/zh-cn/`、docs.bekencorp.com  
> **关联文档：** `博通集成_LVGL_UI_Designer分析文档.md`、`博通集成_LVGL_UI工具_分析与仿制方案.md`、`BEKEN_LVGL_UI_Designer实现原理与仿制方案.md`  
> **体例参考：** `quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`、`artinchip/ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`  
> **重构产品暂名：** **ForgeUI Studio**（可替换）；CLI 暂名 **`fu-codegen` / `fu-preview`**；工程格式暂名 **ForgeUI Project（自有 JSON）**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 BEKEN LVGL UI Designer 所代表的 **Electron 可视化设计 + 明文 JSON 工程 + Handlebars 生成 LVGL C/MicroPython + SDL 仿真 + custom 隔离** 范式做结构化拆解，并设计一套 **功能兼容、工程格式自有、量产链路基于开源 LVGL** 的替代工具链。

竞品与 Persim（`.prc` + 专有宿主）不同：板上运行时是开源 **LVGL**，护城河在 **免费体验 + 设计器/CodeGen + 仿真工具链 + 2.x MCP AI**。  
与 SquareLine / ArtInChip UIBuilder 同属「设计器→源码」赛道；差异是 **Windows Electron + `.bkprj` JSON + 双语言导出 + 免费无订阅 + MCP 改画布**，仿真形态为「生成后编译运行」（接近 UIBuilder，而非 SquareLine 编辑器内 Play）。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清 Electron 栈、`.bkprj`、Handlebars 生成、`custom`/仿真边界、功能面与商业约束 |
| **功能兼容** | 覆盖主路径：工程 → 设计 → 事件 → 生成 → PC 仿真 → 并入 SDK → `ui_init`/`beken_ui_init` 上板 |
| **格式自有** | 自有 Schema；**默认不**读写官方 `.bkprj` |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 依赖 LVGL（MIT）及开源工具链；不搬运 `app.asar`、官方品牌资源与闭源授权逻辑 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 五区工作台 / 属性样式事件 / 生成仿真工作流接近 | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见分析文档 §3 / 实现原理 §7.5） | ✅ 目标 |
| **L3 产物形似** | 导出目录习惯接近 `generated` + `custom` + cmake + `*_ui_init()` | ✅ 可选形似，**非**官方生成逐文件兼容 |
| **L4 工程兼容** | 直接打开官方 `.bkprj` | ❌ 默认不做 |
| **L5 工具链兼容** | 复用/替代官方闭源 `app.asar`、原样搬发行包工具链 | ❌ 禁止 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 Beken 工程兼容器。若必须 L4 → **使用官方 BEKEN LVGL UI Designer**。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先 CodeGen 后设计器** | Schema → CodeGen → SDL 真预览打通后，再做五区设计器 |
| **单一权威模型** | 自有 JSON Schema 同时服务设计器、校验器、CodeGen、（可选）MCP |
| **generated / custom 隔离** | 生成区可覆盖；`custom/` 不覆盖 |
| **验收以真 LVGL 为准** | DOM 画布仅编辑辅助；仿真 = 编译后的 SDL/真 LVGL |
| **注册表扩展控件** | 元数据驱动：画布渲染 + CodeGen partial 同源 |
| **合规优先** | 禁止反编译/重发 `app.asar`、宣传「兼容 `.bkprj`」、冒用 BEKEN 商标 |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | 发行包目录、`.bkprj` 示例、`.hbs` 模板、`lv_port_pc_simulate` | 读明文 JSON/模板/文档；可核对 asar **字符串**特征，不反汇编业务逻辑 |
| 行为逆向 | 生成→编译→运行、上板 `beken_ui_init`、MCP 改 JSON 刷新画布 | 官方文档 / 发行说明 / README |
| 功能逆向 | 工作台模块、事件动作、i18n、动画、AI、存档 | 公开能力面 + 分析文档 §3 |
| 不做 | 破解发行包、复制品牌示例未授权素材、宣称 `.bkprj` 二进制兼容 | — |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | BEKEN LVGL UI Designer（博通集成 / Beken；非 Broadcom） |
| 形态 | **Windows Electron 桌面 IDE**（绿色解压） |
| 版本线索 | 本地 **2.0.3**；文档仓库持续更新 |
| 定位 | LVGL 可视化设计与 C/MP 导出；宣传对标 SquareLine / GUI Guider |
| 商业 | **免费、无订阅**（核心市场叙事） |
| 图形库 | **LVGL 9.x**（可见 **9.3**）；板上无专有 GUI 解释器 |
| 许可证 | 文档/示例仓库侧 MIT；工具本体为 Electron 发行包 |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L5 可选 AI   MCP + Skill → Bridge → 改工程 JSON → 画布刷新   │
├─────────────────────────────────────────────────────────────┤
│ L4 工具层  Electron + Vue3 + Element Plus + Monaco           │
│   五区工作台 / 资源 / 工具栏预览拆分 / 存档历史                │
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  .bkprj（明文 JSON）+ assets/ + 主题/示例           │
├─────────────────────────────────────────────────────────────┤
│ L2 产物层  beken_generated/ + custom/ + beken_generated.cmake│
│   C：lv_* API  │  MicroPython：lvgl 绑定                     │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  LVGL +（PC：SDL2）或（板：SDK port）+ *_ui_init()  │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **L1 可完全自建**（LVGL 开源）——与 Persim 不同。  
2. 护城河在 **L4 体验 + L2 生成习惯（custom）+ 免费叙事 + MCP AI**；板上不锁专有运行时。  
3. 只仿 DOM 画布而不做 CodeGen + 真仿真，无法形成兼容级产品。  
4. `.bkprj` 虽明文可读，但是 **厂商方言**（字段/wid/properties 数组形态）；兼容它等于长期格式债。  
5. **不是**「Vue 编译成 C」：Vue 只编辑 JSON；真画面靠 LVGL 再渲染。

### 2.3 数据流逆向

```text
拖拽 / 属性 / 样式 / 事件 改 .bkprj
    →（可选）AI MCP 改同一 JSON → 画布即时刷新 → 用户保存/撤销
    → Handlebars CodeGen → beken_generated/（覆盖）+ custom/（保留）
    → C：清理/生成/编译/运行 或 MP：生成/运行
         → lv_port_pc_simulate（SDL）真 LVGL 窗口 + 日志
    → 生成目录并入芯片 SDK → 调 beken_ui_init() → 交叉编译烧录
```

与 SquareLine：同属导出源码；Beken 更强调 **免费 + 双语言 + 编译仿真 + MCP**。  
与 UIBuilder：仿真同为「生成后编译」；Beken 壳为 Electron/JSON，UIBuilder 为 Qt/XML。

### 2.4 工程文件逆向

| 文件/结构 | 职责 | 重构对应 |
|-----------|------|----------|
| `*.bkprj` | 权威工程（settings、pages、components、style、events…） | `project.json` + `screens/*.json` |
| `assets/` | 图/字等 | `assets/` |
| `beken_generated/` | 生成源码（可配置导出路径） | `generated/` |
| `custom/` | 用户代码（`custom_func` 等，再生成不覆盖） | `custom/` |
| `beken_generated.cmake` | CMake 汇总生成文件 | `generated/CMakeLists.txt` 或 `ui.cmake` |
| `lv_port_pc_simulate/` | PC 仿真工程（常提示升级后删除再生成） | 独立 `preview-sdl/` 模板（版本锁定） |
| `themes/` / `examples/` | 主题与示例 | 自有 templates/examples |

节点特征：`type` 字符串（image/label/button…）、`properties[]`、`style.parts[].states[].styles[]`、`events[]`、`wid`。重构对外用稳定自有字段名，**禁止**把官方字段集当产品兼容承诺。

### 2.5 导出产物逆向

| 产物（典型） | 职责 | 重构对应 |
|--------------|------|----------|
| `beken_ui.c/h` 等 | 初始化、全局句柄（如 `bk_lv_ui_t`） | `generated/ui_*.c/h` |
| 分屏/控件创建代码 | 按页/控件展开 `lv_*` | `generated/screen_*.c` |
| 样式/事件回调 | Part/State、切页动画、调函数 | `generated/` |
| `custom/` | 业务与自定义函数 | **`custom/`（不覆盖）** |
| `*.cmake` | 接入构建 | 同步生成 |
| MicroPython 树 | 可选导出通道 | V1 可选；MVP 可不做 |

上板序：生成源进 SDK → 板级 LVGL port → 调 **`beken_ui_init()`**（或文档约定入口）→ `lv_timer_handler`。工具 **不是**烧录 IDE。

### 2.6 技术栈逆向（2.0.3）

| 层级 | 技术 |
|------|------|
| 壳 | Electron |
| 前端 | Vue 3 + TS + Vite + Element Plus + Pinia |
| 画布 | DOM 绝对定位 + WidgetRenderer（非 Konva/内嵌 LVGL） |
| CodeGen | Handlebars（`resources/templates/**/*.hbs`） |
| 代码编辑 | Monaco |
| 仿真 | LVGL + SDL2 + w64devkit/CMake |
| AI | MCP（Node `.cjs`）+ Bridge + Skill → Cursor/TRAE/Codex |

### 2.7 功能面逆向摘要

多项目/模板 · 五区工作台 · 30+ 组件与自定义组件 · Part/State 与样式库 · Flex · 事件（跳转/改属性样式/调函数/自定义代码）· 时间轴动画 · 图字与自定义字符 · 多语言 · C+MP 生成 · custom 隔离 · 仿真拆分 · 导出路径 · 存档历史 · MCP AI。  
详见分析文档 §3。

### 2.8 竞品优劣对重构的启示

| 启示 | 行动 |
|------|------|
| 免费是最大市场锚点 | 自有工具可强调可私有化 / 无限额 / 可内网 |
| 标准 LVGL C 是技术锚点 | 必须导出可编译 `lv_*`，勿做专有运行时 |
| `custom/` 隔离极有价值 | 严格 generated/custom；验收「再生成不丢」 |
| DOM 画布够用但非验收 | 合同以仿真/板端为准 |
| MCP AI 是差异化 | V2 再做；MVP 不挡主路径 |
| `.bkprj` 兼容成本高 | 默认不做 L4 |
| 可与 ForgeLine/ForgeBuilder 共享内核 | CodeGen/SDL 复用；差异在壳体验与导出命名习惯 |

### 2.9 赛道选择

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| 免费级 Electron LVGL 出 C、控订阅 | **本文（ForgeUI）** |
| 跨平台 Play + 板模板生态 | SquareLine / ForgeLine 设计说明 |
| Qt + custom/weak + 厂商 SDK 复制 | ArtInChip / ForgeBuilder 设计说明 |
| JS 轻应用包 | Persim 设计说明，非本文 |
| 已有 Beken 仿制半成品 | 本文作规格冻结与验收基线，复用已有 CodeGen |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| 桌面设计器（Electron 或 Tauri + Vue3） | 官方 `.bkprj` 读写兼容 |
| 自有工程 Schema + CodeGen C | 官方生成逐字节兼容 |
| 真 LVGL 仿真（SDL；可选热更） | 搬 `app.asar` / 官方发行包整包 |
| `custom` 隔离、cmake 片段 | 冒用 BEKEN 商标与未授权示例素材 |
| SDK 接入文档 + 1～2 模板 | 完整烧录 IDE |
| V1：样式库、更多控件、可选 MP、i18n、字体裁剪 | MCP AI、存档云（V2） |

### 3.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  ForgeUI Studio（Electron / Tauri + Vue3）                     │
│  Project / Designer / Style / Events / Assets / Code / Sim   │
└──────────────────────────────┬───────────────────────────────┘
                               │ 自有 JSON 工程
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  fu-codegen                                                  │
│  generated/  +  custom/  +  ui.cmake / CMakeLists            │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     fu-preview（LVGL + SDL2）           任意板级 LVGL 工程
     生成→CMake→窗口                      ui_init() / 文档约定入口
```

可选 V2：`fu-mcp` 改同一 JSON（对齐竞品 AI 路径，实现自有）。

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 | **Electron（electron-vite）** 或 **Tauri 2** | 对齐竞品形态；Tauri 可减体积 |
| 设计器 | Vue3 + TS + Element Plus + Pinia | 与竞品/团队前端栈一致 |
| 画布 | DOM 绝对定位 + VueUse 拖拽 | 实现快；不以之为验收 |
| CodeGen | Handlebars / Nunjucks + CLI | 可测试、可 CI；与竞品同族 |
| 预览 | LVGL + SDL2 + CMake（w64devkit/MSVC） | 对齐「生成→编译→运行」 |
| 代码查看 | Monaco（V1） | 对齐 custom 编辑体验 |
| LVGL 版本 | MVP 锁 **一个** 9.x minor（建议与目标 SDK 一致，如 9.3） | 控制摩擦 |
| 工程格式 | 自有 JSON Schema（Zod/ajv） | 可读可校验；扩展名独立 |

### 3.4 逻辑模块

| 模块 | 职责 |
|------|------|
| **Schema** | project/screen/component/i18n JSON Schema 与校验 |
| **ProjectService** | 新建/打开/保存、导入导出包、路径校验提示 |
| **WidgetRegistry** | 控件元数据；设计器与 CodeGen 同源 |
| **Designer** | 画布、树、拖拽、对齐、撤销、多页 |
| **StyleEditor** | Part/State；样式库（V1） |
| **EventEditor** | 触发→动作（切页、改属性/样式、CALL_CUSTOM） |
| **ComponentService** | 自定义组件另存/实例化（V1） |
| **AssetService** | 图片/字体；自定义字符裁剪（V1） |
| **I18nService** | 语言包与切换动作（V1） |
| **AnimService** | 时间轴关键帧（V1～V2） |
| **CodeGen** | JSON→generated + custom 骨架 |
| **CodeViewer** | 只读/编辑 custom（V1） |
| **PreviewOrchestrator** | 生成→编译→运行；日志面板 |
| **ArchiveService** | 本地存档/恢复（V2） |
| **McpBridge** | 可选 AI 改工程（V2） |
| **Cli** | `validate \| generate \| preview` |

---

## 4. 数据与接口设计

### 4.1 工程目录

```text
MyUi/
  project.json
  screens/
    home.json
    settings.json
  components/                 # 可选自定义组件（V1）
  assets/images|fonts/
  i18n/                       # 可选（V1）
  generated/                  # fu-codegen 输出（可清）
  custom/                     # 手写（不清）
    custom_func.c
    custom_func.h
```

`project.json` 建议字段：`name`、`width`、`height`、`colorDepth`、`lvglVersion`、`defaultScreen`、`theme`、`i18nEnabled`、`export`（generatedPath、fontOptions）、`naming`。

### 4.2 屏幕节点（示意）

```json
{
  "schemaVersion": 1,
  "id": "home",
  "type": "screen",
  "isDefault": true,
  "frame": { "x": 0, "y": 0, "w": 480, "h": 480 },
  "style": {
    "main": { "default": { "bg_color": "#0F172A" } }
  },
  "children": [
    {
      "type": "button",
      "id": "btn_next",
      "name": "btn_next",
      "frame": { "x": 40, "y": 40, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "style": {
        "main": {
          "default": { "bg_color": "#2563EB", "radius": 8 },
          "pressed": { "bg_color": "#1D4ED8" }
        }
      },
      "events": [
        {
          "trigger": "CLICKED",
          "actions": [
            { "type": "CHANGE_SCREEN", "target": "settings", "anim": "fade_in", "ms": 300 },
            { "type": "CALL_FUNCTION", "handler": "on_btn_next" }
          ]
        }
      ],
      "children": []
    }
  ]
}
```

**禁止**对外承诺兼容官方 `.bkprj` 字段全集；内部迁移脚本若存在，仅实验用途。

### 4.3 CodeGen 接口

```text
fu-codegen validate <projectDir>
fu-codegen generate <projectDir> [--clean-generated] [--lang c|mp]
fu-preview          <projectDir>   # 内部可先 generate 再编译运行（C）
```

生成规则：

- 覆盖 `generated/**`  
- 若 `custom/custom_func.c` 不存在则创建空钩子/声明；**已存在则不改**  
- 写出 `generated/ui.cmake` 或等价 filelist  
- 入口函数名可配置（默认 `ui_init`；文档说明与竞品 `beken_ui_init` 的对应关系）  
- `--lang mp` 为 V1 可选  

### 4.4 运行时集成接口（板端）

```c
#include "ui.h"

lv_init();
/* display + indev port */
ui_init();   /* 或文档约定的 forge_ui_init */
while (1) { lv_timer_handler(); /* sleep */ }
```

业务：

```c
/* custom/custom_func.c */
void on_btn_next(void)
{
    /* 通过 generated 暴露的对象句柄改 UI */
}
```

### 4.5 Preview 编排

1. `generate`  
2. 预览工程 `LV_COLOR_DEPTH` 等与 `project.json` 一致  
3. CMake 构建并启动 SDL 窗口  
4. 日志面板展示编译/运行输出；支持用户 `printf` 调试（对齐竞品体验）  
5. V1：监听变更增量编译；V2：可选热替换  

---

## 5. 模块详细设计（要点）

### 5.1 Designer / StyleEditor

- 读 screens JSON → DOM 绝对定位近似渲染  
- 选中→属性/Part·State→写回  
- WidgetRegistry 拖入默认节点  
- 树：多页、父子、锁定、显隐、Z 序  
- 网格/参考线/多选对齐；撤销快照栈  
- V1：样式库、自定义组件、Flex  

### 5.2 EventEditor

动作枚举：`CHANGE_SCREEN`（含动画名/时长）、`SET_PROP`、`SET_STYLE`、`CALL_FUNCTION`、`CUSTOM_CODE`（V1）、`SWITCH_LANG`（i18n）。  
`CALL_FUNCTION` 在 generate 时确保 `custom` 中有声明/空实现。

### 5.3 CodeGen

- 按屏生成创建函数；全局句柄结构体聚合 `lv_obj_t *`  
- 样式按 Part/State 映射 `lv_style_*` / `lv_obj_add_style`  
- 事件 → `lv_obj_add_event_cb` + 切屏 helper  
- 控件映射表随 LVGL minor 锁定；缺映射 generate 期报错  

### 5.4 Asset / Font / I18n（V1）

- PNG 导入；TTF → 字库；自定义字符集裁剪（开源 font 工具）  
- `i18n` 表 + 组件绑定 key + 运行时切换 API  

### 5.5 AnimService（V1～V2）

关键帧属性轨道 → CodeGen 为 LVGL anim 或定时器驱动；设计期可 DOM 预览，验收仍靠仿真。

### 5.6 WidgetRegistry

```json
{
  "id": "button",
  "lvgl": { "create": "lv_button_create", "major": [9] },
  "label": { "zh-CN": "按钮", "en": "Button" },
  "isContainer": false,
  "props": [{ "name": "text", "type": "text", "default": "Button" }],
  "styleParts": ["main"],
  "events": ["CLICKED", "PRESSED", "RELEASED", "LONG_PRESSED"]
}
```

### 5.7 McpBridge（V2）

对外暴露「读/改工程 JSON、截图画布」类工具；改内存模型 → 与手动编辑同一刷新链 → 用户确认保存。禁止在 MCP 路径直接覆盖 `custom/`。

---

## 6. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0** | 本文评审 + 合规清单 + LVGL minor 锁定 + 壳选型 | 2～3 天 | 决策通过 |
| **P1** | Schema + Hello 双屏示例 | 3～5 天 | validate 通过 |
| **P2** | fu-codegen（C + custom + cmake） | 1～2 周 | CLI 可生成可编译 |
| **P3** | fu-preview（SDL） | 1～2 周 | 双屏切页 + custom 可改 Label |
| **P4** | Studio 设计器 MVP | 6～10 周 | 拖完即可 generate+preview |
| **P5** | SDK 接入文档 + 最小模板 | 1～2 周 | 板端或第二仿真工程跑通 |
| **P6** | V1：样式库、更多控件、字体/i18n、代码查看、可选 MP | 1～2 月 | V1 验收 |
| **P7** | V2：动画增强、存档、MCP AI、跨平台壳 | 按需 | 产品化项 |

原则：**P1→P2→P3→P4→P5**。禁止先堆 AI 与花哨界面。

人力：嵌入式 1～2、前端 1～2、中间层 1。  
MVP（至 P5）约 **4～7 人月**；到 V1 约 **10～15 人月**；接近竞品 2.x 密度（含 AI）约 **18～25 人月**。  
若已有 ForgeLine/ForgeBuilder CodeGen/SDL：**P2/P3 可大幅缩短**。

---

## 7. 兼容迁移策略（可选）

| 策略 | 说明 |
|------|------|
| **人工重建** | 提供控件/事件/目录对照表；在 ForgeUI 中重拖 |
| **单向实验导入** | 内部脚本只读解析 `.bkprj` 子集→写自有 JSON（**不承诺、不宣传**） |
| **禁止** | 「100% 兼容 BEKEN `.bkprj`」作为售卖点 |

产物心智迁移：文档说明 `beken_generated`↔`generated`、`custom`↔`custom`、`beken_ui_init`↔`ui_init`，降低从官方工具过来的成本（L3 形似）。

---

## 8. 质量、安全与合规

### 8.1 验收（功能兼容）

1. 设计器不手写 JSON 完成双页：背景/图/字/按钮  
2. 切屏 + Call function；`custom` 可改 Label  
3. PC 仿真（真 LVGL）正确；日志可见  
4. 再生成后 **custom 不丢**  
5. 同套代码进最小 CMake+LVGL 可运行  
6. 工程格式检测 **不是** 官方 `.bkprj` 方言承诺兼容  

### 8.2 合规清单

- [ ] 发行包无官方 `app.asar` / 未授权品牌资源  
- [ ] 无 BEKEN / 博通集成商标冒充  
- [ ] 未承诺 L4 `.bkprj` 兼容  
- [ ] LVGL 及第三方许可证台账齐全  
- [ ] 文档仓库 MIT 示例若引用需遵守其许可与版权  
- [ ] 法务确认商业模式与商标策略  

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 画布观感争议 | 验收以仿真/板端为准 |
| 控件矩阵膨胀 | MVP 锁 8～12；注册表扩展 |
| 被要求兼容 `.bkprj` | 引导用正版或签单独迁移项目 |
| Electron 体积/杀毒 | 工具链外置或改 Tauri；加白名单说明 |
| 与 ForgeLine 产品重复 | 共享内核；包装突出免费/双语言/MCP 路线图 |
| LVGL API 漂移 | 锁 minor；模板按版本目录拆分 |
| AI 范围蔓延 | V2 单独立项；不挡 MVP |

---

## 9. 目录与交付物建议

```text
forgeui/
  docs/                 # 本设计说明、上板指南、对照表
  schema/
  codegen/              # fu-codegen
  preview-sdl/          # fu-preview
  designer/             # Electron/Tauri 应用
  templates/boards/
  examples/hello/
  mcp/                  # V2 可选
```

交付物：可安装设计器、CLI、SDL 预览、Hello 示例、上板文档、测试用例、本设计说明。

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | Electron+Vue 编辑 `.bkprj` → Handlebars 出 LVGL C/MP → SDL 仿真 → SDK；可选 MCP AI |
| 逆向重点 | L2 产物隔离与 L4 体验；L1 用开源 LVGL；勿误读为「Vue→C」 |
| 兼容策略 | **L1+L2 功能兼容**；格式自有；拒绝默认 L4/L5 |
| 重构抓手 | **Schema → CodeGen(generated+custom) → SDL 仿真 → Designer → SDK 文档** |
| 与 ForgeLine 差异 | 更强调免费叙事、双语言、编译仿真、MCP 路线；壳默认同 Electron |
| 与 ForgeBuilder 差异 | JSON/Electron 而非 Qt/XML；弱厂商 aicp，强通用 LVGL |
| 成功标准 | 同套生成代码在仿真与板端可点选；custom 可迭代；无 `.bkprj` 依赖 |

BEKEN 公开卖点是 **免费 + 拖拽 + 30+ 组件 + 仿真 + 标准代码 + AI**。ForgeUI 应用工程闭环兑现前四者（AI 放 V2），并用自有格式与可私有化授权形成差异，而不是兼容器或发行包克隆。

---

## 11. 参考资料

1. `beken/博通集成ui工具.txt`  
2. `beken/博通集成_LVGL_UI_Designer分析文档.md`（§2 原理、§3 主要功能）  
3. `beken/博通集成_LVGL_UI工具_分析与仿制方案.md`  
4. `beken/BEKEN_LVGL_UI_Designer实现原理与仿制方案.md`（§7.5 功能对标）  
5. 本地包：`beken/lvgl_ui_designer_2.0.3`（含 `resources/doc/zh-cn/`、`templates/**/*.hbs`、`lv_port_pc_simulate`、`mcp/`）  
6. https://github.com/bekencorp/lvgl_ui_designer  
7. https://docs.bekencorp.com/arminodoc/bk_app/lvgl_ui_designer/zh-cn/index.html  
8. https://dl.bekencorp.com/tools/lvgl_ui_designer  
9. 体例参考：`quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`；`artinchip/ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`  

---

*本文为设计说明，不构成对 BEKEN / 博通集成的授权或工程兼容承诺；商标与许可以官方为准。*
