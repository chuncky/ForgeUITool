# ArtInChip UIBuilder 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** ArtInChip / 匠芯创 **UIBuilder / AiUIBuilder**（本地线索 **2.0.2**）  
> **输入材料：** `artinchip/UIBuilder简介.txt`、本机安装 `D:\ArtInChip\AiUIBuilder`、既有分析/仿制/综合文档；官方 aicdoc 使用指南；厂商介绍与立创对接文档  
> **关联文档：** `ArtInChip_UIBuilder分析文档.md`、`ArtInChip_UIBuilder_仿制方案.md`、`ArtInChip_UIBuilder_分析与仿制方案.md`  
> **体例参考：** `quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`、`rt-thread/Persim_Studio_竞品逆向与重构设计说明.md`；根目录 `report/仿制UIBuilder软件设计说明文档.md`  
> **重构产品暂名：** **ForgeBuilder Studio**（可替换）；CLI 暂名 **`fb-codegen` / `fb-preview` / `fb-sdk-copy`**；工程格式暂名 **ForgeBuilder Project（自有 JSON）**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 UIBuilder 所代表的 **Qt 可视化设计 + XML 工程 + 生成 LVGL C + MinGW/CMake SDL 仿真 + 一键进厂商 SDK** 范式做结构化拆解，并设计一套 **功能兼容、工程格式自有、量产链路基于开源 LVGL** 的替代工具链。

竞品与 Persim（`.prc` + 专有宿主）不同：板上运行时是开源 **LVGL**，护城河在 **设计器体验 + CodeGen/`custom` 隔离 + 仿真工具链 + Luban-Lite/aicp 等垂直集成**。  
与 SquareLine 同属「设计器→源码」赛道；差异是 **Windows Qt + XML snapshot + F5 编译仿真 + 强厂商绑定**，而非跨平台订阅 IDE + 编辑器内 Play。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清安装栈、工程文件、生成/`custom` 边界、F5 仿真、SDK 复制与功能面 |
| **功能兼容** | 覆盖主路径：工程 → 设计 → 事件 → 生成 → F5 仿真 → 复制 SDK → `ui_init()` 上板 |
| **格式自有** | 自有 Schema；**默认不**读写官方 `.aicpro` / `.cfg` / `.snapshot` |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 依赖 LVGL（MIT）及开源工具链；不搬运 `AiUIBuilder.exe` / `AicUI.dll` / 闭源 aicp 转换器 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 五区设计器 / 属性样式事件 / F5 仿真 / 生成与拷 SDK 工作流接近 | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见分析文档 §3 / 仿制方案 §0.4） | ✅ 目标 |
| **L3 产物形似** | 导出目录习惯接近 `ui_builder` + `custom` + `ui_init()` + weak | ✅ 可选形似，**非**官方生成逐文件兼容 |
| **L4 工程兼容** | 直接打开官方 `.aicpro` / `.snapshot` | ❌ 默认不做 |
| **L5 工具链兼容** | 复用/替代官方 `AicUI.dll`、闭源图转/视频管线二进制 | ❌ 禁止 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 UIBuilder 工程兼容器。若必须 L4 → **使用官方 AiUIBuilder**（或商务授权迁移工具）。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先 CodeGen 后设计器** | Schema → CodeGen → SDL 真预览打通后，再做桌面设计器 |
| **单一权威模型** | 自有 JSON Schema 同时服务设计器、校验器、CodeGen |
| **generated / custom 隔离** | 生成区可覆盖；`custom/`（含 `custom/assets`）与 weak 强符号覆盖不丢 |
| **验收以真 LVGL 为准** | Qt/DOM 画布仅编辑辅助；F5 = 编译后的 SDL/真 LVGL |
| **注册表扩展控件** | 字符串 `type` + WidgetRegistry；避免对外数字 type 枚举 |
| **合规优先** | 禁止反编译 Setup、重发闭源、宣传「兼容 `.aicpro`/`.snapshot`」；aicp 仅授权客户按需 |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | 安装目录栈、模板工程、`ui_builder`/`custom` 产物结构 | 读明文 XML/目录/文档 |
| 行为逆向 | 生成→F5→拷 SDK→`ui_init` 流程 | aicdoc / 立创 / 厂商介绍 |
| 功能逆向 | 30+ 控件、Part/State、事件、字体/图转、多语言、组件 | 公开能力面 + 分析文档 §3 |
| 不做 | 反汇编 `AiUIBuilder.exe` / `AicUI.dll`、破解授权、复制品牌模板未授权素材 | — |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | UIBuilder / **AiUIBuilder** |
| 形态 | **闭源 Windows Qt5 桌面 IDE** + 内嵌仿真工具链 |
| 版本线索 | 本地 **2.0.2**（`AiUIBuilder-2.0.2_setup.exe` → `D:\ArtInChip\AiUIBuilder`） |
| 定位 | 面向 ArtInChip 平台的 LVGL 可视化设计与 C 导出 |
| 图形库 | **LVGL V8.3 / V9.1**（仿真侧可见 8.3.11、9.1.0） |
| 商业/生态 | 厂商垂直工具；与 Luban-Lite / D12x·D13x·D21x 方案深度绑定 |
| 与 LVGL | 导出标准 `lv_*` C；板上无专有 GUI 解释器 |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L4 工具层  AiUIBuilder.exe + AicUI.dll（闭源 Qt5）            │
│   画布 / 控件库 / 属性 / Style / Event / 资源 / 代码查看      │
│   字体裁剪 / 图片转换 / 视频 / 多语言 / F5 / 代码复制 SDK     │
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  .aicpro + .cfg + .snapshot(XML) + resources/      │
│   （权威设计数据；模板与本地工程可核对）                        │
├─────────────────────────────────────────────────────────────┤
│ L2 产物层  ui_builder/（生成）+ custom/（用户）+ assets 宏路径 │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  LVGL +（PC：SDL2）或（板：Luban-Lite port）+ ui_init│
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **L1 可完全自建**（LVGL 开源）——与 Persim「必须自研或授权宿主」不同。  
2. 竞品护城河在 **L4 体验 + L2 生成习惯（custom/weak）+ 厂商资源/SDK 一键链路**。  
3. 只仿画布而不做 CodeGen + F5 真预览，无法形成兼容级产品。  
4. `.snapshot` 虽为明文 XML，但是 **厂商方言**（数字 `type`、`ailv-app` 标签）；兼容它等于长期格式债。  
5. 安装体积约 **1GB**（双 LVGL + MinGW/CMake/FFmpeg）：重构应 **锁单版本 + 精简工具链**，勿照抄体积。

### 2.3 数据流逆向

```text
拖拽 / 属性 / Style / Event 改 .snapshot + .cfg
    → 代码生成 → ui_builder/（覆盖）+ custom/（保留）
    → F5：必要时先生成 → CMake + MinGW → SDL 窗口（真 LVGL）
    →（可选）VS Code 改 custom 并调试
    → 代码复制：ui_builder → 配置的 SDK 路径
    → 板端：补路径宏 / SConscript → aic_ui_init 等处调 ui_init() → 烧录
```

与 SquareLine 对比：竞品 **Play 不是编辑器内即时像素**，而是 **生成后编译仿真**（更接近 Beken）；与 SquareLine 相同的是最终都落在 **标准 LVGL C**。

### 2.4 工程文件逆向

| 文件 | 职责 | 重构对应 |
|------|------|----------|
| `*.aicpro` | 工程入口 | `project.json`（或自有扩展名入口） |
| `*.cfg`（`ai_cfg` XML） | 分辨率、色深、多语言开关等 | `project.json` meta |
| `*.snapshot`（`ailv-app` XML） | Screen→Widget 树、Style、Event、Attribute | `screens/*.json` |
| `resources/` | 图/字等 | `assets/` |
| `data/param_data.db` | SQLite 参数（安装侧） | 可选本地缓存；**不进**发行工程格式核心 |
| `ui_builder/` | 生成代码 + 仿真产物 | `generated/`（命名可形似 `ui_builder`） |
| `custom/` | 用户强函数与 custom assets | `custom/`（同名保留心智） |

`.snapshot` 特征：`Widget type="5"` 等 **数字枚举** 映射 LVGL 控件；重构对外用字符串 `"image"` / `"button"`，内部可有映射表但不写入产品 Schema。

### 2.5 导出产物逆向

| 产物（典型） | 职责 | 重构对应 |
|--------------|------|----------|
| `ui_init.c/h` | 总入口 | `generated/ui_init.*` |
| `screen_*.c` | 分屏创建 | `generated/screen_*.c` |
| `ui_objects.h` / `ui_util.*` | 对象句柄与辅助 | `generated/` |
| `assets/font|image` | 资源 | `generated/assets` 或路径宏指向外置存储 |
| `custom/custom.c|h` | 业务强函数 | **`custom/`（再生成不覆盖）** |
| `lv_conf_custom.h` | 仿真/工程侧配置片段 | 按需生成或模板提供 |
| 路径宏 | `LVGL_IMAGE_PATH` / `LVGL_FONT_PATH` 等 | 文档 + 板级头文件约定 |

上板序（立创等公开文档）：复制 `ui_builder` → 定义存储路径宏 → 加编译脚本 → `#ifdef … ui_init();`。

**用户扩展模型（竞品核心价值）：**

```text
设计器事件挂自定义函数名
  → CodeGen 生成 __attribute__((weak)) 空实现
  → 用户在 custom.c 写同名强函数覆盖
  → custom/assets 合并进仿真/上板资源（勿直接改 ui_builder/assets）
```

### 2.6 安装栈逆向（2.0.2）

| 层级 | 技术 |
|------|------|
| 宿主 | Qt5 Widgets（非 Electron） |
| 核心 | `AicUI.dll` |
| 代码查看 | QScintilla |
| 仿真 | SDL2 + `tool/simulator/lvgl/{8.3.11,9.1.0}` |
| 编译 | 内置 MinGW + CMake |
| 字体 | `lv_font_conv.exe`、`pyftsubset.exe` |
| 音视频 | FFmpeg DLL（视频模板/控件） |
| 模板 | `app_template/`（smart_home、order_coffee、bread_machine、multi_language、video…） |

### 2.7 功能面逆向摘要

Win 桌面 · 双 LVGL · 向导/模板 · 拖拽 30+ · 对齐/撤销/全局粘贴 · Part/State 与预设 · 事件（切页/属性/动画/custom）· 组件 · 字体裁剪 · 图转（含 aicp）· 视频/APNG · 多语言 · 生成+查看 · F5 仿真 · 一键复制 SDK · 设计器中英 · 精简项目导出。  
详见分析文档 §3。

### 2.8 竞品优劣对重构的启示

| 启示 | 行动 |
|------|------|
| 标准 LVGL C 是最大优点 | 必须导出可编译 `lv_*`，勿做专有运行时 |
| `custom` + weak 边界极有价值 | 严格 generated/custom；验收「再生成不丢」 |
| F5 闭环是体验锚点 | 预览必须真 LVGL；可接受首期「编译后跑」 |
| 厂商 aicp/视频是差异化而非核心 | MVP 不做；V2/授权客户再做 |
| 双 LVGL 撑大安装包 | MVP **锁一个**小版本 |
| `.snapshot` 兼容成本高 | 默认不做 L4 |
| 可与 SquareLine/Beken 仿制共享内核 | CodeGen/SDL 复用；差异在 custom 习惯与 SDK 复制 |

### 2.9 赛道选择

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| 对标 UIBuilder / 厂商垂直 LVGL 出 C | **本文（ForgeBuilder）** |
| 跨平台订阅级 Play + 板模板生态 | SquareLine 设计说明（可共享 CodeGen） |
| 已有 Beken 仿制库 | 本文作「custom/weak + SDK 复制」规格增强，复用内核 |
| 官方 Pro XML / Figma Flow | LVGL Pro 设计说明，非本文 |
| JS 轻应用包 | Persim 设计说明，非本文 |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| 桌面设计器（Qt 或 Electron/Tauri） | 官方 `.aicpro` / `.snapshot` 读写兼容 |
| 自有工程 Schema + CodeGen C | 官方生成逐字节兼容 |
| 真 LVGL F5（SDL；可选热更） | 搬 `AicUI.dll` / 官方仿真树整包 |
| `custom` + weak、cmake 片段 | 未授权 aicp 实现与品牌模板 |
| SDK 复制脚本 + 1～2 上板模板 | 冒用 ArtInChip / AiUIBuilder 商标 |
| V1：字体裁剪、组件、i18n、预设样式 | 完整视频管线（V2/按需） |

### 3.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  ForgeBuilder Studio（Qt6 或 Electron/Tauri + Vue3）           │
│  Project / Designer / Style / Events / Assets / CodeView / F5│
└──────────────────────────────┬───────────────────────────────┘
                               │ 自有 JSON 工程
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  fb-codegen                                                  │
│  generated/(或 ui_builder/)  +  custom/ + weak 桩 + cmake    │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     fb-preview（LVGL + SDL2）           fb-sdk-copy → 目标 SDK 目录
     F5：生成→CMake→窗口                  任意板级 LVGL：ui_init()
```

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 A | **Qt6 Widgets/QML** | 求形似竞品；嵌入式团队 C++ 友好 |
| IDE 壳 B | **Electron/Tauri + Vue3** | 求快出 MVP；与 Beken/ForgeLine 人才栈一致 |
| 画布 | Qt 自绘 或 DOM 绝对定位 | 不以之为验收 |
| CodeGen | Handlebars / Jinja2 + CLI | 可测试、可 CI；**壳无关** |
| 预览 | LVGL + SDL2 + CMake（MinGW/MSVC） | 对齐 F5 |
| 字体 | `lv_font_conv` / fonttools 开源链 | 对齐字体裁剪，勿拷官方 exe |
| LVGL 版本 | MVP 锁 **一个**（建议与目标 SDK 一致，如 **9.1.x**） | 控制体积；V1 再双版本 |
| 工程格式 | JSON Schema（Zod/ajv） | 可读、可校验；禁止数字 type 对外 |

两条壳路径 **必须共用** Schema + CodeGen + preview。

### 3.4 逻辑模块

| 模块 | 职责 |
|------|------|
| **Schema** | project/screen/component/i18n JSON Schema 与校验 |
| **ProjectService** | 新建/打开/保存、分辨率色深版本、精简导出、备份 |
| **WidgetRegistry** | 控件元数据；设计器与 CodeGen 同源 |
| **Designer** | 画布、树、拖拽、对齐、撤销、Z 序 |
| **StyleEditor** | Part/State 表单；预设样式库（V1） |
| **EventEditor** | 触发→动作（切屏、改属性、动画、CALL_CUSTOM） |
| **ComponentService** | 容器另存为组件 / 再实例化（V1） |
| **AssetService** | 图片/字体导入；基础图转 png/jpg |
| **FontPipeline** | TTF→裁剪字库（V1） |
| **I18nService** | 变量表与语言字体（V1） |
| **CodeGen** | JSON→generated + custom 骨架 + weak |
| **CodeViewer** | 只读浏览生成代码（V1） |
| **PreviewOrchestrator** | F5：generate→build→run；日志面板 |
| **SdkCopy** | 配置路径优先级（项目 > 全局）；覆盖复制 |
| **Cli** | `validate \| generate \| preview \| sdk-copy` |

---

## 4. 数据与接口设计

### 4.1 工程目录

```text
MyUi/
  project.json
  screens/
    home.json
    settings.json
  components/                 # 可选（V1）
  assets/images|fonts|video/
  i18n/                       # 可选（V1）
    strings.json
  generated/                  # fb-codegen 输出（可清；可对外称 ui_builder）
  custom/                     # 手写（不清）
    custom.c
    custom.h
    assets/
```

`project.json` 建议字段：`name`、`width`、`height`、`colorDepth`、`lvglVersion`、`defaultScreen`、`i18nEnabled`、`sdkPath`（可选）、`export`（imageMode、storageMacros）、`naming`。

### 4.2 屏幕节点（示意）

```json
{
  "schemaVersion": 1,
  "id": "home",
  "type": "screen",
  "isDefault": true,
  "frame": { "x": 0, "y": 0, "w": 800, "h": 480 },
  "style": {
    "main": { "default": { "bg_color": "#101820" } }
  },
  "children": [
    {
      "type": "button",
      "name": "btn_next",
      "frame": { "x": 40, "y": 40, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "style": {
        "main": { "default": { "bg_color": "#2A6FDB", "radius": 8 } }
      },
      "events": [
        {
          "trigger": "clicked",
          "actions": [
            { "type": "load_screen", "target": "settings" },
            { "type": "call_custom", "handler": "on_btn_next" }
          ]
        }
      ],
      "children": []
    }
  ]
}
```

**禁止**对外使用官方数字 `type` 与 `ailv-app` 标签作为产品格式。

### 4.3 CodeGen 接口

```text
fb-codegen validate   <projectDir>
fb-codegen generate   <projectDir> [--clean-generated]
fb-preview            <projectDir>   # 内部可先 generate 再编译运行
fb-sdk-copy           <projectDir> [--force]
```

生成规则：

- 覆盖 `generated/**`（或配置的 `ui_builder/**`）  
- 若 `custom/custom.c` 不存在则创建带 **weak** 空实现的骨架与声明约定；**已存在则不改**  
- 合并说明：`custom/assets` 在预览/拷贝阶段合并到运行资源，**禁止**用户直接改 `generated/assets`  
- 写出 CMake 片段或 `filelist`，便于仿真与板上接入  
- 自定义 handler 名 → 生成 weak 桩；文档指引在 `custom.c` 写强函数  

### 4.4 运行时集成接口（板端）

```c
#include "ui_init.h"

lv_init();
/* display + indev port */
ui_init();
while (1) { lv_timer_handler(); /* sleep */ }
```

业务：

```c
/* custom/custom.c */
void on_btn_next(void)
{
    /* 通过 generated 暴露的 screen/objects API 改 UI */
}
```

路径宏（板上头文件定义，形似竞品心智即可）：

```c
#define LVGL_STORAGE_PATH "/data/lvgl"
#define LVGL_IMAGE_PATH(y) /* 平台约定 */
#define LVGL_FONT_PATH(y)  /* 平台约定 */
```

### 4.5 Preview（F5）编排

1. `generate`  
2. 配置预览工程 `LV_COLOR_DEPTH` 等与 `project.json` 一致  
3. CMake 构建并启动 SDL 窗口  
4. V1：监听 generated 变更→增量编译；V2：可选 Wasm 缩短环  

### 4.6 SdkCopy 编排

1. 解析 SDK 路径：项目设置 > 工具全局设置  
2. 将 `generated/`（或约定的 `ui_builder` 包名）复制到目标目录  
3. `--force` 覆盖旧生成区；**永不覆盖**目标侧用户误放在生成区外的业务（若用户把业务写进目标 `custom`，文档约定同步策略）  

---

## 5. 模块详细设计（要点）

### 5.1 Designer / StyleEditor

- 读 screens JSON 渲染近似控件  
- 选中→属性/Style Part·State→写回  
- 控件库从 WidgetRegistry 拖入  
- 树：父子、显隐、删除、Z 序快捷键  
- 对齐参考线；方向键微调  
- 撤销：工程快照栈  
- V1：预设样式；组件另存/实例化；跨工程全局复制  

### 5.2 EventEditor

动作枚举：`load_screen`、`set_prop`、`animate`（V1）、`call_custom`。  
`call_custom` 在 generate 时确保 weak 桩存在；Screen `created` 可挂自定义初始化函数（对齐竞品 Created 事件）。

### 5.3 CodeGen

- 按屏生成 `screen_<id>.c`  
- `ui_init`：初始化资源/多语言（若开）、创建各屏、加载 defaultScreen  
- 样式：按 Part/State 调 `lv_obj_add_style` / `lv_style_set_*`  
- 控件映射表随 LVGL major 分支模板（8 vs 9 API 差）  
- weak 桩集中或按屏生成，链接时由 `custom` 强符号覆盖  

### 5.4 FontPipeline / AssetService（V1）

- 字体：TTF + 字符集 → `lv_font_*.c` 或外置字文件 + 路径宏  
- 图片：导入 png/jpg；可选压缩；**不做 aicp**（除非授权单独立项）  
- 视频：V2  

### 5.5 I18nService（V1）

- `strings.json`：变量 × 语言  
- 设计器可切换预览语言  
- CodeGen 生成切换 API 与默认语言字体绑定  

### 5.6 WidgetRegistry

```json
{
  "id": "button",
  "lvgl": { "create": "lv_button_create", "major": [8, 9] },
  "label": { "zh-CN": "按钮", "en": "Button" },
  "isContainer": false,
  "props": [{ "name": "text", "type": "text", "default": "Button" }],
  "styleParts": ["main"],
  "events": ["clicked", "pressed", "released"]
}
```

设计器与 CodeGen 共读；缺映射控件在 generate 期报错。

### 5.7 PreviewOrchestrator / SdkCopy

见 §4.5、§4.6。日志面板展示 cmake/编译错误；失败时定位到最近一次 generate。

---

## 6. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0** | 本文评审 + 合规清单 + LVGL 小版本锁定 + 壳选型（Qt vs Electron） | 2～3 天 | 决策通过 |
| **P1** | Schema + Hello 双屏示例工程 | 3～5 天 | validate 通过 |
| **P2** | fb-codegen（C + custom/weak + cmake） | 1～2 周 | CLI 可生成可编译 |
| **P3** | fb-preview（SDL F5） | 1～2 周 | 双屏切页 + custom 可改文案 |
| **P4** | Studio 设计器 MVP | 6～10 周 | 拖完即可 generate+preview |
| **P5** | fb-sdk-copy + 最小上板/CMake 文档 | 1～2 周 | 板端或第二仿真工程跑通 |
| **P6** | V1：样式 Part/State、组件、字体、i18n、代码查看、更多控件 | 1～2 月 | V1 验收 |
| **P7** | V2：视频、授权图格式、全局复制、可选双 LVGL、可选 Wasm | 按需 | 产品化项 |

原则：**P1→P2→P3→P4→P5**。禁止先堆花哨界面。

人力：嵌入式 1～2、桌面/前端 1～2、中间层 1。  
MVP（至 P5）约 **4～7 人月**；到 V1 约 **10～14 人月**；接近原厂 2.x 密度约 **18～25 人月**。  
若已有 Beken/ForgeLine 类 CodeGen/SDL：**P2/P3 可大幅缩短**，工期转向 Style/Event/custom 习惯与 SdkCopy。

---

## 7. 兼容迁移策略（可选）

| 策略 | 说明 |
|------|------|
| **人工重建** | 提供控件/事件/目录对照表；在 ForgeBuilder 中重拖 |
| **单向实验导入** | 内部脚本只读解析 `.snapshot` 子集→写自有 JSON（**不承诺、不宣传**） |
| **禁止** | 「100% 兼容 AiUIBuilder 工程」作为售卖点 |

产物心智迁移：文档明确 `ui_builder`↔`generated`、`custom`↔`custom`、weak 覆盖规则，降低从官方工具过来的成本（L3 形似）。

---

## 8. 质量、安全与合规

### 8.1 验收（功能兼容）

1. 设计器不手写 JSON 完成双页：背景/图/字/按钮  
2. 切屏 + `call_custom`；`custom.c` 可改 Label/图片  
3. F5（真 LVGL SDL）正确  
4. 再生成后 **custom 与 custom/assets 不丢**  
5. 同套代码进最小 CMake+LVGL 可运行；`fb-sdk-copy` 能落到约定目录  
6. 工程格式检测 **不是** 官方 `ailv-app` / 数字 type 方言  

### 8.2 合规清单

- [ ] 发行包无 AiUIBuilder Setup / `AicUI.dll` / 官方闭源转换器  
- [ ] 无 ArtInChip / AiUIBuilder 商标冒充  
- [ ] 未承诺 L4 `.aicpro`/`.snapshot` 兼容  
- [ ] 未内嵌未授权 aicp 实现与官方模板素材  
- [ ] LVGL 及第三方许可证台账齐全  
- [ ] 法务确认商业模式与商标策略  

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 画布观感争议 | 合同验收以 F5/板端为准 |
| 控件矩阵膨胀 | MVP 锁 8～12；注册表扩展 |
| 被要求兼容官方工程 | 引导用正版或签单独迁移项目 |
| 安装体积膨胀 | 单 LVGL + 系统/精简工具链 |
| 与 ForgeLine/Beken 仿制品重复 | 共享内核；产品包装突出 custom/weak + SdkCopy |
| LVGL 8/9 API 差 | 模板分 major；工程锁版本 |
| 客户强要 aicp/视频 | V2 单独立项 + 授权评估 |

---

## 9. 目录与交付物建议

```text
forgebuilder/
  docs/                 # 本设计说明、上板指南、对照表
  schema/
  codegen/              # fb-codegen
  preview-sdl/          # fb-preview
  designer/             # Qt 或 Electron/Tauri 应用
  tools/sdk-copy/       # fb-sdk-copy
  templates/
    boards/sdl_pc/
    boards/<chip_sdk_stub>/
  examples/hello/
```

交付物：可安装设计器、CLI、SDL 预览、Hello 示例、SDK 复制工具、上板文档、测试用例、本设计说明。

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | Qt + XML 工程 + LVGL C 生成（`ui_builder`/`custom`/weak）+ SDL F5 + 一键进 SDK |
| 逆向重点 | L2 产物隔离模型与 L4 工具体验；L1 用开源 LVGL；警惕厂商 aicp/体积陷阱 |
| 兼容策略 | **L1+L2 功能兼容**；格式自有；拒绝默认 L4/L5 |
| 重构抓手 | **Schema → CodeGen(generated+custom/weak) → F5 SDL → Designer → SdkCopy** |
| 与 SquareLine 重构差异 | 更强调 **编译仿真 + custom/weak + SDK 路径复制**；壳可选 Qt 形似 |
| 与 Persim 重构差异 | 无专有宿主/包格式；核心是 CodeGen 而非 JS 轻应用 |
| 成功标准 | 同套生成代码在 F5 与板端可点选；custom 可迭代；无 `.snapshot` 依赖 |

UIBuilder 公开卖点是 **拖拽快 + 双 LVGL + 仿真闭环 + 一键进匠芯创 SDK + 业务代码隔离**。ForgeBuilder 应用工程闭环兑现前四者（SDK 改为通用/自有芯片路径），并用自有格式与可私有化授权形成差异，而不是兼容器或安装包克隆。

---

## 11. 参考资料

1. `artinchip/UIBuilder简介.txt`  
2. `artinchip/ArtInChip_UIBuilder分析文档.md`（§2 原理、§3 主要功能）  
3. `artinchip/ArtInChip_UIBuilder_仿制方案.md`（§0.4 功能对标）  
4. `artinchip/ArtInChip_UIBuilder_分析与仿制方案.md`  
5. 本机安装：`D:\ArtInChip\AiUIBuilder`（2.0.2）  
6. 官方：https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder_user_guide.html  
7. 简介 / 基本操作 / 事件：uibuilder-introduction.html 、uibuilder-function-intro.html 、uibuilder-events.html  
8. 厂商介绍：https://www.artinchip.com/detail/301.html  
9. 立创对接：AiUIBuilder 代码集成 SDK 文档  
10. 体例参考：`quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`；`rt-thread/Persim_Studio_竞品逆向与重构设计说明.md`  
11. 既有细化设计：`report/仿制UIBuilder软件设计说明文档.md`、`report/仿制UIBuilder需求文档.md`  
12. 同赛道：`beken/…`、`quareline/…`、`lvgl_pro/…`  

---

*本文为设计说明，不构成对 ArtInChip / AiUIBuilder 的授权或工程兼容承诺；商标与许可以官方为准。*
