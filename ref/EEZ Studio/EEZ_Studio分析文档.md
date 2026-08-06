# EEZ Studio 分析文档

> 基于 `EEZ Studio/eez studio信息.txt`、本地源码树 **`studio-master`（package.json 版本 0.28.0）**、官网 envox.eu、GitHub `eez-open/studio`，以及公开文档 / 社区对比（Seeed、Renesas RZ/G、PicoPixel 对比页等）整理。  
> 分析对象：**Envox EEZ Studio** — 开源、跨平台的可视化低代码工具（嵌入式 / 桌面 GUI + 测试测量仪器遥控）。  
> 范围：实现原理、主要功能、特点、优缺点；并与同类 LVGL / HMI 工具简要对照。  
> 仿制方案：[`EEZ_Studio_仿制方案.md`](./EEZ_Studio_仿制方案.md)。  
> 综合稿（分析+仿制，推荐）：[`EEZ_Studio_分析与仿制方案.md`](./EEZ_Studio_分析与仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`EEZ_Studio_竞品逆向与重构设计说明.md`](./EEZ_Studio_竞品逆向与重构设计说明.md)。

---

## 1. 产品定位

EEZ Studio 由克罗地亚 **Envox** 团队维护，定位为：

> **免费开源的跨平台可视化开发环境**，同时覆盖 **桌面/嵌入式 GUI（含 LVGL 8.x & 9.x）** 与 **T&M 仪器远程控制（SCPI/VISA）**；通过拖拽设计 + **EEZ Flow** 流程图低代码，缩短从原型到可运行应用的周期。

官网（https://www.envox.eu/studio/studio-introduction/）强调：

- **EEZ Flow** 低代码 / 无代码逻辑  
- **LVGL 8.x & 9.x** 支持  
- **Royalty-free** 生成物 / 运行时叙事  
- **SCPI/VISA** 仪器遥控  
- **Linux / macOS / Windows**  
- **FREE and Open Source（GPL-3.0）**

与仓库内其它工具的赛道关系：

| 对照 | 关系 |
|------|------|
| SquareLine / Beken / UIBuilder / LVGL Pro | 同属「设计器 → 导出 LVGL C」大类；EEZ **额外**带 Flow、自研 EEZ-GUI、仪表 Instrument |
| Persim / FlyThings | 不同：EEZ 的 LVGL 路径仍是 **源码进固件**；EEZ-GUI / Dashboard 走自研框架或桌面包，不是 `.prc` / EasyUI so |
| LabVIEW / Keysight VEE | Instrument + Flow 侧定位接近「免费替代商业测控自动化」叙事 |

一句话（嵌入式 LVGL 主路径）：

> **Electron 编辑明文 `.eez-project`（JSON）→ 画布拖拽 LVGL 控件（可选 Flow）→ Wasm 真预览/调试 → Build 生成 `ui.c`/`screens.c` 等 C 源码（可选 `eez-flow` 运行时）→ 接入用户固件。**

| 项 | 内容 |
|----|------|
| 厂商 | Envox d.o.o. |
| 产品名 | EEZ Studio |
| 官网 | https://www.envox.eu/studio/studio-introduction/ |
| 源码 | https://github.com/eez-open/studio ；本地 `EEZ Studio/studio-master` |
| 信息文件 | `EEZ Studio/eez studio信息.txt` |
| 本地版本线索 | **0.28.0**（`package.json`） |
| 许可 | **应用 GPL-3.0**；生成代码所有权见 README（Flow 相关生成物多为 **MIT**；用户拥有 `.eez-project`） |
| 平台 | Windows / macOS / Linux（64 位） |
| 图形库选项 | **LVGL**；自研 **EEZ-GUI / EEZ-GUI Lite**；桌面 **Dashboard** |

---

## 2. 实现原理

### 2.1 总体架构

本地 `studio-master` 为 **Electron + TypeScript 单体仓库**（`packages/` 路径别名，非独立 npm workspace 包发布为主）：

```text
┌──────────────────────────────────────────────────────────────────┐
│  Electron Main（packages/main）                                    │
│  窗口 / IPC / 串口·VISA 等原生能力                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  Renderer：React 18 + MobX + flexlayout-react                      │
│  packages/home — Home / Instruments / Project 标签壳               │
│  packages/project-editor — 工程编辑器（核心体量）                    │
│  packages/instrument — SCPI 会话、历史、快捷方式                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  .eez-project JSON    Build 模板展开         Wasm Worker
  (MobX 对象图)         LVGLBuild / Flow       eez_runtime /
                        二进制资源            lvgl_runtime_v*.js
```

| 层级 | 技术 / 路径证据 |
|------|-----------------|
| 桌面壳 | **Electron 39.x**（`package.json`）；`main`: `build/main/main.js` |
| UI | **React 18**、**MobX 6**、Bootstrap 5、flexlayout 停靠面板 |
| 工程核心 | `packages/project-editor/`（数百 TS/TSX） |
| LVGL 生成 | `packages/project-editor/lvgl/build.ts`（`LVGLBuild`）、`to-lvgl-code.ts` |
| Flow | `packages/project-editor/flow/`；表达式 PEG：`resources/expression-grammar.pegjs` |
| 嵌入式 Flow 运行时 | `resources/eez-framework-amalgamation/`（`eez-flow.cpp/h` + LZ4/SHA256） |
| 图字工具 | 内嵌 `lv_img_conv_v9`；依赖 `lv_font_conv` |
| 构建 | `tsc` + gulp + less；`electron-builder` 打包 |
| 无头构建 | `electron . --build-project path.eez-project` |

### 2.2 工程类型（多目标同一 IDE）

枚举见 `packages/project-editor/core/object.ts`：

| `projectType` | 界面名（约） | 嵌入式 GUI？ | 典型产出 |
|---------------|--------------|--------------|----------|
| `lvgl` | LVGL / LVGL+Flow | ✅ | `ui.c`、`screens.c`、样式/图/字；可选 `eez-flow.*` |
| `firmware` | EEZ-GUI | ✅（自研 GUI） | 模板 C++ + 压缩资源 blob |
| `eez-gui-lite` | EEZ-GUI Lite | ✅ | 轻量 C（`ui_init` / `ui_tick`） |
| `dashboard` | Dashboard | 桌面应用 | `.eez-dashboard` 包 |
| `applet` | BB3 Applet | EEZ BB3 | `.app` |
| `resource` | BB3 MicroPython | EEZ BB3 | `.res` + 可选 `.py` |
| `iext` | IEXT | ❌（仪器扩展） | 仪器定义 / 目录项 |
| `firmware-module` | EEZ-GUI Library | 库模块 | 可被导入的模块资源 |

**LVGL 与「LVGL + Flow」** 不是两个枚举值，而是同一 `ProjectType.LVGL`，由 `settings.general.flowSupport`（及向导模板）区分。

### 2.3 工程文档模型（`.eez-project`）

- **格式：** 明文 **JSON**；MobX 对象图经 `packages/project-editor/store/serialization.ts` 序列化（剥离内部 `_eez_*` 字段）。  
- **用户拥有工程文件**（README 明确）。  

主要顶层键（`project.tsx` 中 `Project` 模型）：

| 键 | 作用 |
|----|------|
| `settings` | `general`（类型、LVGL 版本、分辨率、`flowSupport`…）+ `build`（输出目录、模板文件、导出模式…） |
| `userPages` / `userWidgets` | 页面与可复用用户控件（历史键 `pages` 会迁移） |
| `variables` / `actions` | 变量与原生动作 |
| `styles` / `lvglStyles` / `lvglGroups` | EEZ-GUI 样式 vs LVGL 样式与输入组 |
| `bitmaps` / `fonts` / `texts` / `colors` / `themes` | 资源与主题 |
| `scpi` / `instrumentCommands` / `shortcuts` | 仪器 / IEXT 相关 |
| `micropython` / `extensionDefinitions` 等 | BB3 / 扩展元数据 |

辅助产物：`.eez-project-build`（生成文件清单，便于清理孤儿文件）、Dashboard 的 `.eez-dashboard` zip。

### 2.4 LVGL 代码生成原理

```text
.eez-project
    │
    ▼
assets 编排（build/assets.ts）
    │
    ▼
LVGLBuild 两阶段生成（lvgl/build.ts）
    │  占位符：LVGL_SCREENS_* / STYLES_* / IMAGES_* / FONTS_* / …
    ▼
settings.build.files[] 模板展开（如 ${eez-studio LVGL_SCREENS_DEF}）
    │
    ▼
destinationFolder：ui.c/h、screens.c/h、styles、images、fonts、actions、vars…
    （flowSupport 时可选生成/拷贝 eez-flow 合并源）
```

要点：

- 每控件通过 `BuildLVGLCode`（`to-lvgl-code.ts`）发出对应 **LVGL API** 调用。  
- 全局 `objects_t objects`、`loadScreen(SCREEN_ID_*)`、`ui_create_groups()` 等构成板上入口约定。  
- 图：`lv_img_conv_v9`；字：`lv_font_conv` / `buildLvglFontDefinition`。  
- LVGL 版本矩阵在 `lvgl-versions.ts`（源码侧覆盖 **8.4～9.5** 一带；与官网「8.x & 9.x」一致）。

### 2.5 EEZ Flow 原理

| 阶段 | 机制 |
|------|------|
| 编辑 | 流程图节点（Widget/Action）+ 连线；表达式构建器（变量/常量/算子） |
| 编译进板 | `build/flows.ts` 将图编译为二进制 `DataBuffer`（可 LZ4）；进固件资源或伴随 `eez-flow` |
| PC 预览 | **Wasm Worker** 加载 `eez_runtime.js` / `lvgl_runtime_v*.js`；`WasmRuntime` 桥接 React |
| 调试 | 断点、单步、变量监视、执行队列与日志（官网 Visual debugger） |
| 与 LVGL | Flow 可驱动页面逻辑、变量与动作；需板上链接 **eez-flow**（MIT）而非纯「无框架 LVGL C」 |

### 2.6 预览 / 仿真模型

| 模式 | 作用 |
|------|------|
| 编辑态画布 | LVGL：`LVGLPageEditorRuntime` 经 **Wasm 内 LVGL** 画到 canvas（接近真库像素） |
| Runtime（如 F5） | 完整 Flow + UI 在 Wasm 中跑 |
| Debugger（如 F6） | 同上 + 调试面板 |
| Full Simulator（如 F7） | Docker 侧更完整的原生/交叉仿真链路（`lvgl/docker-build`、`resources/docker-build`） |

与 SquareLine「闭源 Play」、Beken「生成后本机编译 SDL」对比：EEZ 的编辑器内预览更接近 **LVGL Pro 的 Wasm 真预览**，且与 Flow 调试一体。

### 2.7 Instrument / SCPI 与 GUI 路径的关系

- **IEXT / Instrument** 模块负责仪器扩展目录、会话、历史、波形与 FFT 等，对 **纯 LVGL 嵌入式导出并非必需**。  
- **Dashboard + Flow** 可通过 SCPI Action 在 PC 侧遥控仪器（Wasm → 主进程连接）。  
- 产品叙事上，GUI 与测控 **共壳**，是相对 SquareLine/Beken 的最大差异化来源，也是学习曲线与体积的来源。

---

## 3. 主要功能

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **工程** | 多项目类型向导、模板/示例（官网称 40+）、工程比较、GitHub/gitea 集成叙事 | `.eez-project`；可检索 Recent |
| **可视化设计** | 拖拽、多页、停靠面板、多标签、亮/暗主题 | 桌面可高度定制布局 |
| **LVGL 控件** | Screen、Button、Label、Image、Slider、Chart、Calendar、Keyboard、Tabview、QRCode、Lottie、UserWidget… | `lvgl/widgets/` 注册约 **40** 类控件 |
| **样式 / 主题** | `lvglStyles`、颜色主题、Widget styles | 无限主题/样式叙事（官网） |
| **EEZ Flow** | 流程图逻辑、表达式、用户 Widgets/Actions | Low-code；可改逻辑而不离开 Studio |
| **调试** | 变量监视、断点、单步、执行队列、执行日志 | 内置 Visual debugger |
| **动画** | 时间轴编辑控件动画 / 切页效果 | 与 LVGL load anim 等枚举对齐 |
| **多语言** | 多语言、LTR/RTL、进度统计、**XLIFF** 导入导出 | 面向量产本地化 |
| **资源** | 位图、字体、文本；图导出模式 / 字导出模式可配 | 含 lv_img_conv、lv_font_conv |
| **Build** | 生成 C/C++；模板文件列表；目的文件夹；可选 Docker | 无头 `--build-project` |
| **LVGL 版本** | 工程可选 8.x / 9.x | 双线支持是相对部分竞品的卖点 |
| **EEZ-GUI / Lite** | 自研嵌入式 GUI 框架路径 | 历史服务 BB3/H24005，现仍可选 |
| **Dashboard** | 桌面仪表盘应用 + Flow | `.eez-dashboard` |
| **BB3** | Applet / MicroPython 资源 | 绑定 EEZ 硬件生态 |
| **Instruments** | SCPI/Serial/Ethernet/VISA、IEXT 目录、会话历史、快捷方式、JS 自动化、波形/FFT/CSV | 测控侧完整产品线 |
| **扩展** | Project extensions、用户控件/动作 | 插件化叙事 |

### 3.2 LVGL 嵌入式典型工作流

1. 向导选择 **LVGL** 或 **LVGL with EEZ Flow**，设分辨率与 LVGL 版本  
2. 拖拽控件、配样式/事件（或 Flow 节点）  
3. 编辑器内 Wasm 预览；需要时进入 Debugger  
4. **Build** 输出到 `destinationFolder`  
5. 将生成源编入 STM32CubeIDE / Arduino / 自有 CMake 等（Renesas、Seeed 等有公开集成指南）  
6. 板端 `ui_init` / `loadScreen` 类入口与 LVGL port 对接  

### 3.3 特点归纳

| 特点 | 说明 |
|------|------|
| **开源可审计** | 全程 GPL 应用源码；社区可改可编 |
| **一工具多范式** | LVGL / EEZ-GUI / Dashboard / 仪器 同壳 |
| **Flow 差异化** | 逻辑可视化，降低纯 C 事件回调门槛 |
| **真 LVGL 预览** | Wasm 路径，调试与设计同环境 |
| **生成物商用友好叙事** | 用户拥有工程；Flow 生成框架多 MIT；无订阅墙 |
| **测控血统** | 从电源/模块化仪器产品反哺 IDE |
| **双 LVGL 大版本** | 8.x 与 9.x 并存（具体小版本以工程选项为准） |

---

## 4. 优点

| 维度 | 说明 |
|------|------|
| **零订阅成本** | 相对 SquareLine 商业档、LVGL Pro 商用层，EEZ 无功能订阅墙（支持计划为可选服务） |
| **开源透明** | 可二次开发、私有化部署、审计生成器；利于自研工具参考实现 |
| **LVGL 路径标准** | 导出 C 进开源 LVGL，芯片中立（与 Beken/SquareLine 同范式） |
| **Flow + 调试** | 复杂交互可用流程图；内置调试器缩短试错 |
| **预览质量高** | 编辑器内 Wasm LVGL，接近「所见即所得」 |
| **多语言 / XLIFF** | 工程化本地化能力完整 |
| **跨桌面 OS** | Win/macOS/Linux 均有安装包；亦可源码构建 |
| **模板与生态案例** | 官方模板库 + Renesas/Seeed 等板级文档 |
| **Instrument 增值** | 实验室自动化可与 GUI 同工具完成 |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **GPL-3.0 应用许可** | 分发修改后的 Studio 本身需遵守 GPL；与「生成代码 MIT」需分清边界，法务要单独评估 |
| **学习曲线陡** | 工程类型多、Flow/变量/表达式体系重；「只要拖几个按钮出 C」时心智大于 Beken |
| **Electron 体积与性能** | 桌面壳偏重；大工程流畅度依赖机器 |
| **产品面过宽** | GUI 用户仍会碰到 Instrument/BB3/IEXT 概念噪声 |
| **生成结构有自有约定** | `objects_t`、模板占位、可选 `eez-flow` 依赖；纯「最小 ui_*.c」洁癖团队可能不如部分竞品「干净」 |
| **Flow 引入运行时** | LVGL+Flow 需带 eez-flow，Flash/RAM 与集成复杂度上升 |
| **社区支持模式** | Issues「尽力」；快速响应导向付费 Support plans |
| **非 MicroPython 主推** | 与 SquareLine/Beken 双语言导出不完全对等（EEZ 侧偏 C/C++；BB3 另有 MP 资源类型） |
| **协作偏本地** | 无浏览器实时共编；依赖外部 Git（相对 PicoPixel 类 Web 工具） |
| **版本号仍 0.x** | 0.28.0 表示功能已深，但版本语义上仍处活跃演进，升级需回归 |

---

## 6. 与同类方案对比（简表）

| 对比项 | EEZ Studio | SquareLine | BEKEN Designer | LVGL Pro | Persim / FlyThings |
|--------|------------|------------|----------------|----------|---------------------|
| 许可 | GPL 开源应用 | 订阅闭源 | 宣传免费闭源 | 官方分层商用 | 生态/授权 |
| 工程格式 | `.eez-project` JSON | `.spj` 等 | `.bkprj` JSON | 官方 XML | XML+JS / `.ftu` |
| 产出 | LVGL C（± eez-flow）；另有 EEZ-GUI/Dashboard | C / MP | C / MP | C 或运行时 XML | 应用包 / so |
| 预览 | **Wasm LVGL + Flow 调试** | Play | 生成后 SDL 编译 | Wasm + 套件 | simulator / 宿主预览 |
| 逻辑 | **EEZ Flow 流程图** | 事件动作 + `ui_events` | 事件 + `custom/` | Subjects/事件 + 用户包装 | JS / C++ Logic |
| 额外能力 | **SCPI 仪器、Dashboard** | 板级模板生态 | MCP AI | Figma/Online/CLI | 装包部署闭环 |
| 平台锁定 | 弱（LVGL 路径） | 弱 | 弱 | 弱 | 强 |
| 适合 | 要开源/Flow/测控+GUI | 要主流教程与 Play | 要免费快落地 | 要官方工程化 | 要热更新/智能屏 |

选型要点：

- **只要免费开源 LVGL 设计器 + 可改工具本身** → EEZ 优先候选。  
- **只要最快「拖拽 → 干净 C → 上板」且接受闭源** → Beken / SquareLine 可能更轻。  
- **要官方 XML/CI/Figma** → LVGL Pro（注意规范与授权）。  
- **要应用包宿主** → 看 Persim/FlyThings，不是 EEZ。

---

## 7. 适用与不适用

**较适合**

- 需要 **开源、可审计、无订阅** 的 LVGL 可视化工具  
- 希望用 **流程图** 表达业务，而不是大量手写事件 C  
- 同时有 **桌面 Dashboard / 实验室 SCPI 自动化** 需求  
- 需同时维护 **LVGL 8 与 9** 工程  
- 愿意阅读文档、接受一定学习成本以换取调试与 Flow 能力  

**不太适合**

- 法务无法接受 **GPL 工具链**（即使生成代码许可分离，仍需评估分发/修改场景）  
- 只想要「极简五区设计器」，拒绝 Flow/仪器概念  
- 必须 **MicroPython 一等导出**  
- 必须 **官方 Pro XML / Figma 官方流**  
- 目标是 Persim/FlyThings 式 **热更新应用包**  

---

## 8. 对自研 UI 工具的启示（摘要）

| 可借鉴 | 慎直接照搬 |
|--------|------------|
| 明文 JSON 工程 + 可无头 Build | 把测控 Instrument 塞进同一 MVP |
| Wasm 真 LVGL 预览 + 调试器 | 一上来做完整 Flow 虚拟机 |
| 模板占位符式 CodeGen（可测） | GPL 应用与 MIT 生成物边界不清就商用分发 |
| LVGL 8/9 版本矩阵显式化 | Docker Full Simulator 作为 MVP 依赖 |
| 用户控件 / 样式目录化 | 工程类型过多导致向导与文档爆炸 |

与专项「拖拽生成可编译 UI」对齐时：可将 EEZ 视为 **「开源参考实现 + Flow/Wasm 上限样本」**，MVP 仍宜收敛为 **Schema → LVGL CodeGen →（可选）Wasm/SDL 预览 → 设计器**，Flow 与 Instrument 作可选模块。

---

## 9. 结论

EEZ Studio 的实现本质是：

> **Electron（React/MobX）多类型工程 IDE：编辑 JSON `.eez-project` →（LVGL）Wasm 画布与 Flow 调试 → Build 模板生成标准 LVGL C（可选 eez-flow）或 EEZ-GUI/Dashboard/仪器扩展产物。**

**主要功能面**覆盖：多工程类型、拖拽与丰富 LVGL 控件、样式主题、EEZ Flow 与可视化调试、动画、多语言/XLIFF、资源管线、跨平台安装与无头构建，以及完整的 SCPI Instrument 产品线。

**特点**是开源、免费、Flow + 真预览、GUI 与测控共壳、双 LVGL 大版本。  
**优点**是成本与透明度、逻辑可视化、预览/调试一体、芯片中立 LVGL 路径。  
**缺点**是 GPL 边界、学习曲线、Electron 重量、生成约定与可选运行时、产品面过宽。

在嵌入式 LVGL 工具谱系中，EEZ 是 **SquareLine 的开源替代候选** 与 **Beken 的「可改源码」对照物**，又在 Flow/仪器维度上明显更重；选型时应先确认是否真需要 Flow/测控，再决定是「用 EEZ」还是「只吸收其架构思想做自研」。

---

## 10. 参考资料

1. `EEZ Studio/eez studio信息.txt`  
2. 本地源码：`EEZ Studio/studio-master/`（尤其 `README.md`、`package.json`、`packages/project-editor/lvgl/`、`flow/`、`build/`）  
3. https://www.envox.eu/studio/studio-introduction/  
4. https://www.envox.eu/eez-studio-docs/8-projects-general-options/  
5. https://github.com/eez-open/studio  
6. Renesas：Develop LVGL GUI applications using EEZ Studio（RZ/G HMI SDK Wiki）  
7. Seeed：Work with EEZ Studio（ePaper 等应用文档）  
8. 社区对比线索：https://picopixel.io/compare/（第三方营销对比，版本/价格需复核）  
9. 本仓库同类分析：`quareline/SquareLine_Studio分析文档.md`、`beken/博通集成_LVGL_UI_Designer分析文档.md`、`lvgl_pro/LVGL_Pro官方UI工具分析文档.md`、`report/嵌入式UI工具_竞品对比分析报告.md`  
10. 仿制方案：`EEZ Studio/EEZ_Studio_仿制方案.md`

---

*本文为技术分析，不构成对 Envox / EEZ 的授权或兼容承诺；GPL/MIT 边界与商标以官方 LICENSE 与声明为准。*
