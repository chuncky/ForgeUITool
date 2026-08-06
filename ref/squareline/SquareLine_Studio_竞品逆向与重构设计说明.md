# SquareLine Studio 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** SquareLine Studio（本地线索 **1.6.1**；示例工程 LVGL **8.3.11**）  
> **输入材料：** `quareline/squareline信息.txt`、`SquareLine_Studio_Windows_v1_6_1`、`example1`；既有分析/仿制/综合文档；官网与 docs.squareline.io、社区教程  
> **关联文档：** `SquareLine_Studio分析文档.md`、`SquareLine_Studio_仿制方案.md`、`SquareLine_Studio_分析与仿制方案.md`  
> **重构产品暂名：** **ForgeLine Studio**（可替换）；CLI 暂名 **`fl-codegen` / `fl-preview`**；工程格式暂名 **ForgeLine Project（自有 JSON）**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 SquareLine 所代表的 **桌面可视化设计 + JSON 工程 + Play 预览 + 导出 LVGL C/MicroPython** 范式做结构化拆解，并设计一套 **功能兼容、工程格式自有、量产链路基于开源 LVGL** 的替代工具链。

竞品与 Persim（`.prc` + 专有宿主）不同：护城河在 **设计器体验 + CodeGen 质量 + 板级生态心智**，板上运行时是开源 **LVGL**，不是闭源 GUI 解释器。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清工程文件、导出结构、Play/上板边界、功能面与商业约束 |
| **功能兼容** | 覆盖主路径：工程 → 设计 → 事件 → Play → Export C → `ui_init()` 上板 |
| **格式自有** | 自有 Schema；**默认不**读写官方 `.spj` / `.sll` / `.slp` |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 依赖 LVGL（MIT）及开源工具链；不搬运 SquareLine 安装包闭源 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | Hierarchy / Inspector / Play / Export 工作流接近 | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见综合稿上篇 §3） | ✅ 目标 |
| **L3 产物形似** | 导出目录习惯接近 `ui.c` / `ui_Screen*` / `ui_events` | ✅ 可选形似，**非**官方导出逐文件兼容 |
| **L4 工程兼容** | 直接打开官方 `.spj` 工程 | ❌ 默认不做 |
| **L5 工具链兼容** | 复用/替代官方闭源 Play 引擎或导出器二进制 | ❌ 禁止 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 SquareLine 工程兼容器。若必须 L4 → **购买 SquareLine**。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先 CodeGen 后设计器** | Schema → CodeGen → 真 LVGL 预览打通后，再做桌面设计器 |
| **单一权威模型** | 自有 JSON Schema 同时服务设计器、校验器、CodeGen |
| **generated / user 隔离** | 生成区可覆盖；`user/ui_events.*` 等不覆盖（对齐 Call function 边界） |
| **验收以真 LVGL 为准** | DOM 画布仅编辑辅助；Play = SDL/真 LVGL |
| **注册表扩展控件** | 避免硬编码控件矩阵 |
| **合规优先** | 禁止反编译 Setup、重发闭源、宣传「兼容 `.spj`」 |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | `example1` 工程文件集、导出文档结构 | 读明文 JSON/文档 |
| 行为逆向 | Export → `ui_init` 流程、Play 体感、板模板叙事 | 官网/docs/社区 |
| 功能逆向 | Inspector/事件/字体/组件/许可分级 | 公开能力面 |
| 不做 | 反汇编安装包、破解许可、复制品牌板包 | — |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | SquareLine Studio |
| 形态 | **闭源跨平台桌面 IDE**（Win/macOS/Linux） |
| 版本线索 | 本地编辑器 **1.6.1**；示例 `lvgl_version` **8.3.11** |
| 定位 | LVGL 可视化设计与 C/MP 导出；厂商中立 |
| 商业 | Personal 免费有限额；Business/Enterprise 付费；Trial |
| 与 LVGL | 独立公司；导出代码跑在开源 LVGL 上 |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L4 工具层  SquareLine Studio（闭源）                          │
│   画布 / Hierarchy / Widgets / Inspector / Events            │
│   Font Manager / Assets / Themes / Components / Play / Export│
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  .spj + .sll + .slp + Themes.slt + assets/…        │
│   （权威设计数据；本地 example1 可核对）                        │
├─────────────────────────────────────────────────────────────┤
│ L2 产物层  导出 ui_*.c|py + helpers + events + 图字 + cmake  │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  任意平台 LVGL + 显示/输入 port + ui_init()         │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **L1 可完全自建**（LVGL 开源）——与 Persim「必须自研或授权宿主」不同。  
2. 竞品护城河在 **L4 体验 + L2 导出质量/习惯 + 板级教程心智**。  
3. 只仿画布而不做 CodeGen+真预览，无法形成兼容级产品。  
4. `.spj` 虽为可读 JSON，但是 **厂商方言**（GUID + `strtype: OBJECT/...`）；兼容它等于长期格式债。

### 2.3 数据流逆向

```text
Inspector / 拖拽改 .spj 树
    → 保存 .sll 元数据（分辨率、lvgl_version、导出选项…）
    → Play：编辑器内像素级预览（闭源实现）
    → Export UI Files
         → ui.c / ui_Screen*.c / ui_helpers / ui_events 骨架
    →（可选）Create Template Project 生成板级骨架
    → 用户工程：lv_init → 驱动 → ui_init()；业务填 ui_events
```

与 Beken 同为 **设计器 → 源码**；SquareLine 差异是 **Play 体感更强、板模板/生态叙事更强、商业订阅**。

### 2.4 工程文件逆向（本地 example1）

| 文件 | 职责 | 重构对应 |
|------|------|----------|
| `.spj` | UI 对象树 | `screens/*.json`（自有节点模型） |
| `.sll` | 板型、分辨率、LVGL 版本、导出开关 | `project.json` |
| `.slp` | 导出路径、FS drive | `project.json` 的 export 段或本地用户设置 |
| `Themes.slt` | 主题 | `themes/*.json` |
| `assets/` | 图等 | `assets/` |
| `components/` | 自定义组件 | `components/` |
| `backup/` | 备份 zip | 可选自动备份 |

打开工程依赖 **`.spj` + `.sll` 成对**（社区多次确认）。

### 2.5 导出产物逆向（文档）

| 产物 | 职责 | 重构对应 |
|------|------|----------|
| `ui.c` / `ui.h` | 初始化、主题、加载默认屏 | `generated/ui.*` |
| `ui_ScreenN.c` | 分屏创建 | `generated/ui_screen_*.c` |
| `ui_helpers.*` | 切屏/动画辅助 | `generated/ui_helpers.*` |
| `ui_events.*` | Call function 骨架 | **`user/ui_events.*`（不覆盖）** |
| `ui_comp_hook.*` | 组件创建钩子 | 可选 `user/` |
| `CMakeLists` / `filelist` | 接入构建 | 同步生成 |
| 图/字 C 数组或 FS | 资源 | `generated/assets` 或路径宏 |

上板序：`lv_init` → display/indev → **`ui_init()`** → `lv_timer_handler`。常有色深等与工程设置对齐的编译期检查。

### 2.6 功能面逆向摘要

工程（板型/色深/版本）· 多屏设计 · Inspector · 事件（切屏/属性/Call function）· 字体裁剪 · Assets · Themes · Components · Play · Export C/MP · Template Project · 许可分级。  
详见综合稿上篇。

### 2.7 竞品优劣对重构的启示

| 启示 | 行动 |
|------|------|
| 标准 LVGL 是最大优点 | 重构必须导出可编译 `lv_*`，勿做专有运行时 |
| 订阅痛点是市场机会 | 自有工具可做「可私有化 / 无限额」差异化 |
| Play 是体验锚点 | 预览必须真 LVGL，并尽量缩短反馈环 |
| `ui_events` 边界有价值 | 严格 generated/user |
| `.spj` 兼容成本高 | 默认不做 L4 |
| 可与 Beken 仿制共享内核 | CodeGen/SDL 复用，差异做在体验与导出布局 |

### 2.8 赛道选择

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| LVGL 可视化出 C、控订阅 | **本文（SquareLine 范式）** |
| 已有 Beken 仿制库 | 本文作体验增强规格，复用内核 |
| 官方 Pro XML / Figma Flow | LVGL Pro 设计说明，非本文 |
| JS 轻应用包 | Persim 设计说明，非本文 |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| 桌面设计器（Electron/Tauri） | 官方 `.spj` 读写兼容 |
| 自有工程 Schema + CodeGen C | 官方导出逐字节兼容 |
| 真 LVGL Play（SDL；可选热更） | 搬 SquareLine Play 引擎 |
| `user` 事件区、cmake/filelist | 复制厂商商标板包 |
| 板接入文档 + 1～2 模板 | Personal/Business 计费文案抄袭 |
| 可选 MP、字体裁剪、Components | — |

### 3.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  ForgeLine Studio（Electron / Tauri + Vue3）                  │
│  Project / Designer / Inspector / Events / Assets / Play     │
└──────────────────────────────┬───────────────────────────────┘
                               │ 自有 JSON 工程
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  fl-codegen                                                  │
│  generated/  +  user/ui_events.c  +  CMakeLists / filelist   │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     fl-preview（LVGL + SDL2）           任意板级 LVGL 工程
     Play / 热替换（V1）                  ui_init() + port
```

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 | Electron 或 Tauri 2 | 跨平台；对齐竞品桌面形态 |
| 设计器 | Vue3 + TS + Element Plus + Pinia | 与 Beken/Persim 工具栈一致，易复用人才 |
| 画布 | DOM 绝对定位近似 | 实现快；不以之为验收 |
| CodeGen | Handlebars / Jinja2 + CLI | 可测试、可 CI |
| 预览 | LVGL + SDL2 + CMake/MinGW 或 MSVC | 真渲染；对齐 Play |
| 字体 | lv_font_conv 或等价开源 | 对齐 Font Manager |
| LVGL 版本 | 工程字段锁定（建议先 **8.3.x 或 9.x 二选一**） | 与仿真/导出一致 |

### 3.4 逻辑模块

| 模块 | 职责 |
|------|------|
| **Schema** | project/screen/component JSON Schema 与校验 |
| **ProjectService** | 新建/打开/保存、板型与导出设置、备份 |
| **WidgetRegistry** | 控件元数据；设计器与 CodeGen 同源 |
| **Designer** | 画布、树、拖拽、对齐、撤销 |
| **Inspector** | 属性/样式/状态表单写回 JSON |
| **EventEditor** | 触发→动作（切屏、改属性、Call function） |
| **AssetService** | 图片导入；导出 SOURCE 或 FS 路径 |
| **FontPipeline** | TTF→LVGL 字体、字符子集（V1） |
| **CodeGen** | JSON→generated + user 骨架 |
| **PreviewOrchestrator** | 调 fl-preview；日志面板（Play） |
| **BoardTemplates** | SDL / 一款 MCU 骨架（V1） |
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
  components/                 # 可选
  assets/images|fonts/
  themes/default.json         # 可选
  generated/                  # fl-codegen 输出（可清）
  user/                       # 手写（不清）
    ui_events.c
    ui_events.h
```

`project.json` 建议字段：`name`、`width`、`height`、`color_depth`、`lvgl_version`、`board`、`export`（flat、image_mode、lvgl_include）、`naming`。

### 4.2 屏幕节点（示意）

```json
{
  "schemaVersion": 1,
  "id": "home",
  "type": "Screen",
  "frame": { "x": 0, "y": 0, "w": 800, "h": 480 },
  "style": { "bg_color": "#000000" },
  "children": [
    {
      "type": "Button",
      "id": "btn_next",
      "frame": { "x": 40, "y": 40, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "events": [
        { "trigger": "CLICKED", "action": "CHANGE_SCREEN", "target": "settings" },
        { "trigger": "CLICKED", "action": "CALL_FUNCTION", "handler": "on_btn_next" }
      ]
    }
  ]
}
```

**禁止**对外使用官方 `strtype: "OBJECT/Name"` 等字符串作为产品格式（可做内部映射表，不进发行 Schema）。

### 4.3 CodeGen 接口

```text
fl-codegen validate <projectDir>
fl-codegen generate <projectDir> [--clean-generated]
fl-preview     <projectDir>   # 内部可先 generate 再编译运行
```

生成规则：

- 覆盖 `generated/**`  
- 若 `user/ui_events.c` 不存在则创建带弱符号/空实现的骨架；**已存在则不改**  
- 写出 `generated/CMakeLists.txt`、`filelist.txt`  
- 可选生成色深静态断言（对齐竞品体验）

### 4.4 运行时集成接口（板端）

```c
#include "ui.h"

lv_init();
/* display + indev port */
ui_init();
while (1) { lv_timer_handler(); /* sleep */ }
```

业务：

```c
/* user/ui_events.c */
void on_btn_next(lv_event_t * e) { /* ... */ }
```

### 4.5 Preview 编排

1. `generate`  
2. 配置预览工程 `LV_COLOR_DEPTH` 等与 `project.json` 一致  
3. CMake 构建并启动窗口  
4. V1：监听 generated 变更→增量编译或热替换  

---

## 5. 模块详细设计（要点）

### 5.1 Designer / Inspector

- 读 screens JSON 渲染绝对定位近似控件  
- 选中→Inspector 编辑 props/style/states→写回  
- 控件库从 WidgetRegistry 拖入，生成默认节点  
- 树支持改父子、隐藏、锁定  
- 撤销：工程快照栈  

### 5.2 EventEditor

动作枚举：`CHANGE_SCREEN`（含简单动画名）、`SET_PROP`、`CALL_FUNCTION`。  
`CALL_FUNCTION` 在 generate 时确保 `user` 中有对应函数声明/空实现。

### 5.3 CodeGen

- 按屏生成 `ui_screen_<id>.c`  
- `ui_init` 创建主题、初始化各屏、`lv_screen_load` 默认屏  
- helpers：切屏、通用 setter  
- 控件映射表：`Button→lv_button_*` 等（随 LVGL 大版本分支模板）  

### 5.4 FontPipeline（V1）

输入 TTF + Unicode 范围/字符集 → 输出 `lv_font_*.c` 进 generated；Inspector 选 font 引用 id。

### 5.5 BoardTemplates（V1）

`templates/boards/sdl_pc`、`templates/boards/<mcu>`：已接 LVGL port 的空工程，README 说明如何 `add_subdirectory(generated)` 与放置 `user/`。

### 5.6 WidgetRegistry

```json
{
  "id": "button",
  "lvgl": { "create": "lv_button_create", "major": [8, 9] },
  "label": { "zh-CN": "按钮", "en": "Button" },
  "isContainer": false,
  "props": [ { "name": "text", "type": "text", "default": "Button" } ],
  "events": ["CLICKED", "PRESSED", "RELEASED"]
}
```

设计器与 CodeGen 共读；缺映射的控件在 generate 期报错。

---

## 6. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0** | 本文评审 + 合规清单 + LVGL 大版本选定 | 2～3 天 | 决策通过 |
| **P1** | Schema + Hello 双屏示例 | 3～5 天 | validate 通过 |
| **P2** | fl-codegen（C + user 隔离 + cmake） | 1～2 周 | CLI 可生成可编译 |
| **P3** | fl-preview（SDL Play） | 1～2 周 | 双屏切页可点 |
| **P4** | Studio 设计器 MVP | 1.5～2.5 月 | 拖完即 generate+preview |
| **P5** | 上板文档 + 最小模板 | 1～2 周 | 板端或第二仿真工程跑通 |
| **P6** | V1：字体、模板、CLI 完善、可选 MP | 1～2 月 | V1 验收 |
| **P7** | V2：Components/动画/i18n/可选 Figma | 按需 | 产品化项 |

原则：**P1→P2→P3→P4**。  

人力：嵌入式 1～2、前端 1～2、中间层 1。  
MVP（至 P5）约 **4～7 人月**；主功能密度约 **12～18 人月**。  
若已有 Beken 类 CodeGen/SDL：**P2/P3 可大幅缩短**，工期转向 Inspector/Play 体验与导出布局。

---

## 7. 兼容迁移策略（可选）

| 策略 | 说明 |
|------|------|
| **人工重建** | 提供控件/事件对照表；在 ForgeLine 中重拖 |
| **单向实验导入** | 内部脚本只读解析 `.spj` 子集→写自有 JSON（**不承诺、不宣传**） |
| **禁止** | 「100% 兼容 SquareLine 工程」作为售卖点 |

导出习惯迁移：文档说明 `ui_events` → `user/ui_events` 的对应关系，降低从 SquareLine 过来的心智成本（L3 形似）。

---

## 8. 质量、安全与合规

### 8.1 验收（功能兼容）

1. 设计器不手写 JSON 完成双页：背景/图/字/按钮  
2. 切屏 + Call function；`user` 可改 Label  
3. Play（真 LVGL）正确  
4. 再生成后 **user 不丢**  
5. 同套代码进 CMake+LVGL 工程可运行  
6. 工程格式检测 **不是** 官方 `.spj` 方言  

### 8.2 合规清单

- [ ] 发行包无 SquareLine Setup/安装目录二进制  
- [ ] 无官方品牌/板商标识未授权使用  
- [ ] 未承诺 L4 `.spj` 兼容  
- [ ] LVGL 及第三方许可证台账齐全  
- [ ] 法务确认商业模式不侵犯竞品商标  

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 画布观感争议 | 合同验收以 Play/板端为准 |
| 控件矩阵膨胀 | MVP 锁 8～12；注册表扩展 |
| 被要求兼容 `.spj` | 引导购正版或签单独迁移项目 |
| 与 Beken 仿制品重复 | 共享内核，产品包装差异化 |
| LVGL 8/9 API 差 | 模板分 major；工程锁版本 |

---

## 9. 目录与交付物建议

```text
forgeline/
  docs/                 # 本设计说明、上板指南、API
  schema/
  codegen/              # fl-codegen
  preview-sdl/          # fl-preview
  designer/             # Electron/Tauri 应用
  templates/boards/
  examples/hello/
```

交付物：可安装设计器、CLI、SDL 预览、Hello 示例、上板文档、测试用例、本设计说明。

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | 闭源设计器 + `.spj` 工程 + Play + 导出 LVGL C/MP |
| 逆向重点 | L2 导出结构与 L4 体验；L1 运行时用开源 LVGL 即可 |
| 兼容策略 | **L1+L2 功能兼容**；格式自有；拒绝默认 L4/L5 |
| 重构抓手 | **Schema → CodeGen(generated/user) → 真 LVGL Play → Designer → 板模板** |
| 与 Persim 重构差异 | 无专有宿主/包格式；核心是 CodeGen 而非 JS 轻应用 |
| 成功标准 | 同套生成代码在 Play 与板端可点选；user 可迭代；无 `.spj` 依赖 |

SquareLine 公开卖点是 **快（Play）+ 中立（任意 LVGL 板）+ 完整导出**。ForgeLine 应用工程闭环兑现这三点，并用自有格式与可私有化授权形成差异，而不是兼容器或安装包克隆。

---

## 11. 参考资料

1. `quareline/squareline信息.txt`  
2. `quareline/SquareLine_Studio分析文档.md`、`SquareLine_Studio_仿制方案.md`、`SquareLine_Studio_分析与仿制方案.md`  
3. `quareline/example1/`、`SquareLine_Studio_Windows_v1_6_1/`  
4. https://squareline.io/ ；http://docs.squareline.io/docs/1.5.2/introduction/typical_dev/  
5. 体例参考：`rt-thread/Persim_Studio_竞品逆向与重构设计说明.md`；根目录 `仿制UIBuilder软件设计说明文档.md`  
6. 同赛道落地：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`  

---

*本文为设计说明，不构成对 SquareLine 的授权或工程兼容承诺；商标与许可以官方为准。*
