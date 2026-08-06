# ArtInChip UIBuilder：仿制方案

> 依据 `artinchip/ArtInChip_UIBuilder分析文档.md`、本机 AiUIBuilder 2.0.2 安装结构、官方使用指南与公开资料整理。  
> 目标：弄清 **「仿什么、不仿什么、怎么落地」**。  
> **仿的是工程范式与能力分层，不是品牌、安装包、AicUI.dll 或专有格式二进制兼容。**

仓库内另有较细的 `仿制UIBuilder需求文档.md` / `仿制UIBuilder软件设计说明文档.md`，可与本文对照；**本文以分析文档为基线给出可执行分期方案**。

---

## 0. 边界与合规

| 允许 / 应对齐 | 不要做 |
|---------------|--------|
| 自研设计器 + **自有工程格式** + 生成 **标准 LVGL C** + SDL 仿真 | 破解 / 重打包官方安装包、搬迁 `AicUI.dll` |
| 对齐拖拽、样式 Part/State、事件、`custom`/weak、一键仿真与拷贝 SDK 的**能力** | 宣称「兼容官方 `.aicpro` / `.snapshot`」作对外产品卖点（除非商务授权） |
| 开源 LVGL + 自备/精简工具链（MinGW、CMake、字体工具） | 整包复制厂商 aicp 闭源转换器与未授权素材 |
| 文档写明独立产品 | 使用 ArtInChip / AiUIBuilder 商标冒充官方 |

工程格式建议：**自有 JSON（或自研 XML 方言）**，语义可参考 snapshot 的 Screen/Widget/Style/Event 树，但标签/扩展名独立，避免与官方文件混用。

### 0.4 原厂主要功能清单（对标用）

依据官方简介「主要特性」、基本操作 / 事件文档、厂商介绍与立创对接说明，以及分析文档 §3。仿制时按能力对齐，**格式与二进制自有**。

| 类别 | 原厂主要功能 | 仿制建议落点 |
|------|--------------|--------------|
| 运行环境 | Win7+ 64 位；自带 MinGW/CMake | MVP：Windows 或跨平台壳 + 自备工具链 |
| LVGL 版本 | V8.3 / V9.1 双版本 | MVP 锁一版；V1 可选双版本 |
| 工程管理 | 新建向导（Empty/模板）、打开 `.aicpro`、项目导出 | MVP：自有工程创建/打开；V1：模板与精简导出 |
| 可视化设计 | 拖拽 **30+** 控件；属性编辑 | MVP：8～12 控件；V1：20+ |
| 编辑增强 | 剪贴板、撤销重做、对齐、微调、Z 序、跨工程全局复制 | MVP：撤销+基础剪贴板；V1：对齐/层级；V2：全局复制 |
| 样式 | Part/State；预设样式 | MVP：Main+Default；V1：多 Part/State + 预设 |
| 事件 | 切页、改属性、动画、自定义函数（weak→custom） | MVP：切页 + custom 函数名；V1：动画/更多触发 |
| 组件 | 容器另存为组件再拖入 | V1 |
| 字体 | 导入 + 字体裁剪工具；外置字路径 | MVP：基础字体；V1：裁剪 GUI（开源链） |
| 图片 | 导入；转 png/jpg/**aicp**；外置图路径 | MVP：png/jpg；aicp→V2/授权客户 |
| 视频 | mp4/avi、APNG；平台编解码差异 | V2 / 按需 |
| 多语言 | 变量表、多语言字体、动态加载 | V1 |
| 代码生成 | `ui_builder` + `ui_init()`；代码查看器 | MVP：CodeGen+weak；V1：查看器 |
| 模拟仿真 | F5：生成→编译→SDL | MVP 必做 |
| SDK 集成 | 配路径、一键复制 `ui_builder` | MVP：文档拷贝；V1：一键复制 |
| 调试 | 导出代码可 VS Code 改与调试 | 文档约定即可 |
| UI 语言 | 设计器中/英 | V1 按需 |
| 模板 | 多套行业模板 | V1～V2 |

闭环主路径（原厂）：**拖拽设计 →（可选）配事件/资源 → 生成 C → F5 仿真 → 复制进 SDK → `ui_init()` 上板**。

---

## 1. 要仿的本质（范式）

分析文档一句话：

> **Qt 设计器编辑工程描述 → 生成 LVGL C（ui_builder + custom 隔离）→ MinGW/CMake + SDL 仿真 → 复制进 SDK。**

仿制压成同一范式（格式自有）：

> **自有工程 IR ↔ 可视化设计器 ↔ 模板 CodeGen（generated + custom/weak）↔ SDL+LVGL 仿真 ↔ SDK/CMake 导出**

| 原工具能力 | 仿制应对齐 | 仿制不要对齐 |
|------------|------------|--------------|
| `.aicpro` / `.cfg` / `.snapshot` | 自有多文件工程 + 可校验 Schema | 官方后缀与数字 type 枚举照搬对外兼容 |
| Qt 画布 + AicUI | 五区工作台：库/树/画布/属性/工具栏 | 必须 Qt 且逆向 DLL |
| Part/State 样式 | 同样映射 `lv_style` / part/state | — |
| 事件切页 / 动画 / 自定义函数 | 事件表 → CodeGen；custom weak 覆盖 | — |
| F5 仿真 | 生成→CMake→SDL 窗口 | 编辑器内 Wasm（可选二期） |
| 双 LVGL 8.3/9.1 | MVP 锁 **一个** 小版本；V1 再双版本 | 首期塞两套完整 LVGL 撑到 1GB |
| aicp / 视频 / 一键 Luban | V2 或按芯片客户需要 | MVP 必做厂商专有格式 |
| 字体裁剪 / 图转 | V1 接开源工具链 | 必拷官方 exe |

---

## 2. 推荐目标架构

```text
┌─────────────────────────────────────────────────────────────┐
│  Designer（Qt5/6 或 Electron/Tauri）                          │
│  控件库 / 画布 / 树 / 属性 / 样式 / 事件 / 资源               │
└──────────────────────────────┬──────────────────────────────┘
                               │ 自有工程（JSON 优先）
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Project IR                                                  │
│  project meta + screens[] + assets + i18n?                   │
└──────────────┬─────────────────────────────┬────────────────┘
               │                             │
               ▼                             ▼
     ┌──────────────────┐         ┌──────────────────────────┐
     │ CodeGen CLI      │         │ Simulator Host           │
     │ → generated/*    │         │ LVGL + SDL2 + CMake      │
     │ → custom/* 不覆盖│         │ F5：生成→编译→运行       │
     │ + weak 桩        │         └────────────┬─────────────┘
     └────────┬─────────┘                      │
              └────────────┬───────────────────┘
                           ▼
                板端 / 最小 CMake：普通 LVGL 应用
                （可选「复制到 SDK 目录」脚本）
```

### 2.1 宿主选型

| 路径 | 适用 | 说明 |
|------|------|------|
| **A. Qt5/6 + C++（推荐求「形似」）** | 团队 C++ 强、要对齐原厂手感 | 与官方同族；画布用 QGraphics/自定义 Widget；体积与工期高于 Web 壳 |
| **B. Electron/Tauri + Vue/React（推荐求「快出 MVP」）** | 前端人力足 | 对齐 Beken 仿制路线；画布 DOM 绝对定位即可；仿真仍走原生 SDL |

两条路径 **共用** 同一套 Schema + CodeGen + 仿真模板，避免 UI 壳绑死后端。

---

## 3. 仿制目标分层

### 3.1 MVP（必须打通）

- 自有工程 Schema + 校验（分辨率、色深、多屏、控件树）  
- 约 **8～12** 类控件：obj/container、label、btn、img、slider、switch、bar、arc…  
- 属性：x/y/w/h、text、基础颜色/字号  
- 样式：**Part Main + State Default** 起步  
- 事件：Clicked → 切屏；Clicked → 调 custom 函数名  
- CodeGen → `generated/`（或 `ui_builder/`）+ `custom/` + weak 桩 + `ui_init()`  
- F5：生成 → CMake → SDL 仿真窗口  
- 文档：如何并入最小 LVGL CMake（及可选 SDK 目录说明）  

**明确不做（MVP）：** 官方格式兼容、aicp、视频、完整 30+ 控件、多语言全量、预设样式库、双 LVGL、字体裁剪 GUI、Figma、烧录 IDE。

### 3.2 V1（可用产品）

- 控件扩到约 **20+**；Style 多 Part/State；预设样式  
- 撤销重做、对齐参考线、组件（容器另存复用）  
- 字体导入 + 裁剪（接 `lv_font_conv` / fonttools 等开源链）  
- 图片导入；基础图格式转换（png/jpg）  
- 多语言变量表（可先 SQLite 或 JSON）  
- 代码查看器；「复制到 SDK 路径」  
- （可选）工程创建时选 LVGL 8.3 或 9.1 第二套仿真树  

### 3.3 V2（对齐原厂差异化）

- 视频/APNG（按需，体积大）  
- 客户芯片专有图格式（若有授权再做，勿抄 aicp 实现）  
- 动画事件增强；全局跨工程复制  
- 更多模板；MCP/AI 改工程 IR（自有格式）  
- （可选）Wasm 真预览，缩短「改一下就编译」周期  

---

## 4. 工作拆分（按顺序）

**原则：Schema → CodeGen → 仿真 → Designer → SDK 脚本。禁止先堆花哨界面。**

| 序号 | 工作包 | 周期参考 | 交付 |
|------|--------|----------|------|
| **0** | 范围与格式冻结 | 2～3 天 | 自有 Schema 决议；控件 MVP 清单；合规备忘 |
| **1** | 工程 Schema + 示例 | 1～2 周 | JSON Schema/Zod 或 XSD；双页 Hello 工程 |
| **2** | CodeGen CLI | 2～3 周 | IR→`generated/*` + `custom` 骨架 + weak + cmake 片段；**优先打通** |
| **3** | PC 仿真模板 | 1～2 周 | 单版本 LVGL+SDL；一键 compile/run |
| **4** | Designer MVP | 6～10 周 | 五区 UI；拖完即可生成仿真 |
| **5** | SDK/CMake 接入包 | 1～2 周 | 最小工程 +「复制 ui 目录」脚本 + 文档 |
| **6** | V1 增强 | 1～2 月 | 样式/组件/字体/i18n/更多控件 |
| **7** | V2 | 按需 | 视频/专有格式/AI/Wasm |

粗算：**MVP 约 4～7 人月**；到 V1 约 **10～14 人月**；接近原厂 2.x 功能密度约 **18～25 人月**（含资源工具与模板）。  
人员：嵌入式（CodeGen/仿真/SDK）+ 桌面或前端（Designer）+ 一人兼 Schema。

---

## 5. 关键设计：自有工程格式

不要对外兼容官方 `.snapshot` 数字 type。建议例如：

```text
my_ui/
├── project.json          # name, lvglVersion, width, height, colorDepth, i18n?
├── screens/
│   └── main.json         # 或单文件 pages[]
├── assets/images|fonts/
├── generated/            # 或 ui_builder/：每次生成覆盖
└── custom/               # 不覆盖；custom.c + assets/
```

节点示意（可读字符串 type，优于数字枚举）：

```json
{
  "type": "label",
  "name": "title",
  "x": 85, "y": 35, "w": 100, "h": 32,
  "props": { "text": "Hello" },
  "style": {
    "main": { "default": { "text_color": "#FFFFFF", "text_font": "montserrat_16" } }
  },
  "events": [
    { "trigger": "clicked", "actions": [{ "type": "load_screen", "target": "settings" }] }
  ],
  "children": []
}
```

Design 与磁盘同一 IR；可选导出「精简工程包」（去掉 simulator 构建缓存）。

---

## 6. CodeGen 怎么做

对齐原厂「可维护导出」：

1. 遍历 screens → AST  
2. 模板引擎（Handlebars / Jinja / Qt 字符串模板）生成：  
   - `ui_init.c/h`、`screen_*.c/h`、样式、事件 cb  
   - 资源 declare / `LVGL_IMAGE_PATH` 类宏  
3. 事件自定义名 → `__attribute__((weak))` 空函数；指引在 `custom/` 强符号覆盖  
4. **禁止**改 `generated/`；再生成不删 `custom/`  

验收：无设计器时，仅用 CLI + CMake + LVGL 能编过并显示双页切换。

---

## 7. 仿真怎么做

对齐原厂 F5 闭环，不必首期 Wasm：

```text
保存工程 → CodeGen → CMake -B build → MinGW 编译
→ 启动 SDL 窗口 → ui_init() → lv_timer_handler
```

- MVP：**锁定一个 LVGL 版本**（建议 9.1 或团队 SDK 一致版本）  
- 工具链：文档化「系统已装」或精简内置 MinGW（控制安装体积，避免照抄 1GB）  
- 验收：**必须以仿真窗口为准**，不能只看设计器画布  

---

## 8. Designer 怎么做

### 8.1 模块

| 模块 | 做什么 |
|------|--------|
| 工程 | 新建/打开/保存；分辨率、色深、LVGL 版本 |
| 控件库 | 元数据拖入，写入默认节点 |
| 画布 | 按 x/y/w/h 绘制；拖改；网格/选中/对齐辅助 |
| 树 | 层级、显隐、删、Z 序 |
| 属性 / 样式 | 表单写回 IR |
| 事件 | 触发 + 动作列表（切屏、调函数） |
| 资源 | 拷入 assets，IR 记相对路径 |
| 工具栏 | 生成 / 仿真(F5) / 打开目录 / 复制到 SDK |

内部顺序：读写工程 → 只读画布 → 属性写回 → 拖入 → 树/撤销 → 接 CodeGen/仿真 → 事件/资源。

### 8.2 Qt 路径要点（若选 A）

- Qt Widgets 或 Qt Quick；画布可用 `QGraphicsScene` 或自绘  
- 代码查看可用 QScintilla / Qt Creator 组件  
- 调 CLI：`QProcess`  

### 8.3 Electron 路径要点（若选 B）

- Vue3 + Pinia；画布 DOM 绝对定位即可  
- spawn CodeGen/仿真；注意 Windows 路径与杀毒对 MinGW 的误报  

---

## 9. SDK 接入

提供：

1. 最小 `lvgl-cmake-min` 示例（与芯片无关）  
2. 「复制 generated+custom+assets 到指定目录」脚本  
3. 文档：路径宏、`ui_init()` 调用点、FreeType/文件系统开关  

若服务 ArtInChip 客户：另附 Luban-Lite 目录约定说明（**自写文档**，勿复制官方未授权内容）。

---

## 10. 与「直接用官方 / 仿 Beken / 仿 Pro」选型

| 诉求 | 建议 |
|------|------|
| 已用匠芯创芯片，要官方支持与 aicp/视频 | **直接用 AiUIBuilder** |
| 要同类拖拽+仿真+custom，且自控可发 | **按本文仿制** |
| 要轻量 Electron JSON 路线 | 亦可参考 Beken 仿制方案，能力集向 UIBuilder 对齐 |
| 要 Figma/Wasm/声明式官方 XML | 买 / 用 **LVGL Pro**，或走 Pro 仿制路线（自有 JSON） |

---

## 11. 验收标准

### MVP

1. 不手写工程文件，拖出：背景/图 + 文案 + 两按钮两页  
2. 点击切页；custom 强函数改 Label 文本  
3. F5 仿真窗口行为正确  
4. 再生成后 `custom/` 不丢  
5. 生成代码可进最小 LVGL+CMake 工程运行  
6. 文档声明 **独立格式，不兼容官方 AiUIBuilder 工程文件**  

### V1 加测

7. Part/State 样式与预设；组件复用  
8. 字体裁剪进仿真可见  
9. 复制到配置的 SDK 路径可编过（在文档所述环境下）  

---

## 12. 风险与对策

| 风险 | 对策 |
|------|------|
| 画布与板上不一致 | 强制仿真验收；锁 LVGL 小版本 |
| 生成与手写冲突 | 严分 generated/custom；weak 约定写进模板头注释 |
| 安装体积膨胀 | MVP 单 LVGL；工具链可外置；视频/FFmpeg 放 V2 |
| 控件映射失控 | 字符串 type 注册表；每控件一份生成 partial |
| 误走官方格式兼容 | 合规评审；禁止 `.aicpro` 导入作为产品功能（除非授权） |
| 范围膨胀（30+ 控件+视频+双版本） | 按 MVP/V1/V2 砍；先闭环再铺控件 |
| Qt vs Electron 争论 | Schema/CodeGen/仿真先行，壳可替换 |

---

## 13. 仓库目录建议

```text
aic-ui-toolkit/   # 产品名自定
├── docs/
│   ├── schema.md
│   ├── codegen.md
│   └── compliance.md
├── packages/
│   ├── schema/
│   ├── codegen/          # CLI
│   ├── simulator/        # LVGL+SDL 模板
│   └── designer/         # Qt 或 Electron 应用
├── templates/
│   └── hello_two_screens/
└── examples/
    └── lvgl-cmake-min/
```

---

## 14. 总结论

| 维度 | 结论 |
|------|------|
| 原工具本质 | Qt + XML 工程 + LVGL C 生成 + SDL 仿真 + SDK 复制 |
| 仿制精髓 | **自有 IR + 设计器 + generated/custom(weak) + SDL 仿真** |
| 不可仿 | 品牌、AicUI.dll、未授权专有格式/转换器、安装包再分发 |
| 落地顺序 | **Schema → CodeGen → 仿真 → Designer → SDK** |
| MVP 成败关键 | 仿真正确 + custom 不丢 + 可上板，而非 UI 是否长得像官方 |
| 壳选型 | 求形似用 Qt；求速度用 Electron——**后端必须共用** |
| 合规 | 能力对齐、格式自有；不搬闭源工具与官方工程格式 |

公开能力上 UIBuilder 强调拖拽 30+ 控件、双 LVGL、仿真、一键进 SDK、custom 隔离与资源工具；仿制时用 **工程闭环** 兑现，对标清单见 **§0.4**。

一句话：

> **仿 UIBuilder，仿的是「拖拽 XML/IR → 可维护 LVGL C → 本机 SDL 仿真 → 进 SDK」；用自有工程格式合法落地，先打通生成与仿真，再补设计器与资源工具。**

---

## 参考资料

1. `artinchip/ArtInChip_UIBuilder分析文档.md`（§3 主要功能）  
2. `artinchip/ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`（L1+L2 兼容重构总设计）  
3. `artinchip/UIBuilder简介.txt`；`UIBuilder使用指南.pdf` / `UIBuilder使用指南.md`  
4. 本机：`D:\ArtInChip\AiUIBuilder`（2.0.2）  
5. https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder_user_guide.html  
6. 简介 / 基本操作 / 事件：uibuilder-introduction.html 、uibuilder-function-intro.html 、uibuilder-events.html  
7. 厂商介绍：https://www.artinchip.com/detail/301.html  
8. 立创：AiUIBuilder 代码对接 SDK 文档  
9. 对照：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`；`lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`  
10. 可选细读：`report/UIBuilder实现方案分析文档.md`、`report/仿制UIBuilder需求文档.md`  

---

*技术规划建议，不构成法律意见；对外发布前请确认商标与格式策略。以分析文档与现行官方能力为准。*
