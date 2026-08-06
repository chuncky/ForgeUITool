# EEZ Studio：分析与仿制方案

> 综合 `EEZ_Studio分析文档.md`、`EEZ_Studio_仿制方案.md`、`eez studio信息.txt`、本地源码树 **`studio-master`（0.28.0）**，以及官网 envox.eu、GitHub `eez-open/studio`、Renesas / Seeed / 社区公开资料。  
> 对象：**Envox EEZ Studio**（开源跨平台低代码工具：嵌入式/桌面 GUI + 可选 T&M 仪器遥控）。  
> 结构：**上篇分析**（定位 / 原理 / 主要功能 / 优劣）+ **下篇仿制**（合规 / 目标 / 分期 / 落地）。  
> **仿制约定：** 对齐 **LVGL UI 主路径**能力；**格式自有**；不兼容官方 `.eez-project`；不做 Instrument/BB3 全家桶；不 Fork 换皮 GPL 仓当「自研闭源」。  
> 分册：[`EEZ_Studio分析文档.md`](./EEZ_Studio分析文档.md) · [`EEZ_Studio_仿制方案.md`](./EEZ_Studio_仿制方案.md)  
> 竞品逆向 + 兼容重构设计说明：[`EEZ_Studio_竞品逆向与重构设计说明.md`](./EEZ_Studio_竞品逆向与重构设计说明.md)。

---

# 上篇：工具分析

## 1. 产品定位

EEZ Studio 由 **Envox** 维护：免费开源、跨平台（Win/macOS/Linux），用拖拽 + **EEZ Flow** 做桌面/嵌入式 GUI，并可选 **SCPI/VISA** 仪器遥控。

官网要点：Flow 低代码；**LVGL 8.x & 9.x**；Royalty-free 生成物叙事；仪器遥控；GPL-3.0 开源。

| 项 | 内容 |
|----|------|
| 官网 / 源码 | https://www.envox.eu/studio/studio-introduction/ ；https://github.com/eez-open/studio |
| 本地 | `studio-master`，**0.28.0** |
| 许可 | 应用 **GPL-3.0**；用户拥有 `.eez-project`；Flow 相关生成框架多为 **MIT**（以官方 README 为准） |
| 图形库 | **LVGL**；另有 EEZ-GUI / Lite、Dashboard |
| 同赛道（LVGL 导出） | SquareLine、Beken、UIBuilder、LVGL Pro |
| 不同赛道 | Persim / FlyThings（应用包 + 专有宿主） |
| 测控叙事近 | LabVIEW / Keysight VEE（Instrument 侧） |

一句话（嵌入式 LVGL 主路径）：

> **Electron 编辑 `.eez-project` JSON → 拖拽 LVGL（可选 Flow）→ Wasm 真 LVGL 预览/调试 → Build 出 `ui.c`/`screens.c`（可选 eez-flow）→ 任意 LVGL port 上板。**

---

## 2. 实现原理

### 2.1 一句话与易混点

> **设计期改 JSON；预览期在 Wasm 里跑真 LVGL（+Flow）；导出期产出标准 LVGL C（或带 eez-flow）；板上无「解释 .eez-project」的闭源 GUI 宿主（LVGL 路径）。**

- Wasm 包是 **EEZ 用 Emscripten 自编**（LVGL 源码 + 自家桥接），**不是** LVGL 官方现成 Studio Runtime。  
- Instrument / Dashboard / BB3 与纯 LVGL 导出 **可剥离**；GUI 用户不必用测控。  
- Flow 开启后板上常需链接 **eez-flow**，不再是「纯最小 ui_*.c」。

### 2.2 总体架构

```text
Electron Main（串口/VISA/IPC）
        │
Renderer：React 18 + MobX + flexlayout
  Home / Instruments / Project Editor
        │
   .eez-project JSON ──► Build（LVGLBuild + 模板）──► ui.c / screens.c …
        │                         │
        └──── Wasm Worker ◄───────┘
              lvgl_runtime_v*.js（Emscripten）
              canvas ← 帧缓冲 putImageData
```

| 层级 | 技术 |
|------|------|
| 壳 | Electron 39.x |
| UI | React 18、MobX 6、Bootstrap、flexlayout |
| 核心 | `packages/project-editor/` |
| LVGL CodeGen | `lvgl/build.ts`、`to-lvgl-code.ts` |
| Flow | `flow/` + PEG 表达式；板上 `eez-framework-amalgamation` |
| 预览 | 预置 `lvgl_runtime_v8.4.0` … `v9.5.0`；可选 Docker Full Sim |
| 无头 | `electron . --build-project` |

### 2.3 工程类型与文档

| 类型（摘要） | 产出 |
|--------------|------|
| **LVGL**（± Flow） | `ui.c`、`screens.c`、图字样式；可选 `eez-flow.*` |
| EEZ-GUI / Lite | 自研 GUI C++/轻量 `ui_init` |
| Dashboard | `.eez-dashboard` |
| BB3 Applet / Resource | `.app` / `.res` |
| IEXT | 仪器扩展（非固件 GUI） |

工程为明文 JSON：`settings`、`userPages`、`lvglStyles`、`bitmaps`/`fonts`、可选 `scpi` 等。LVGL+Flow 由 `flowSupport` 开关区分，非另一枚举。

### 2.4 LVGL 生成与 Wasm 预览

- **生成：** 两阶段 `LVGLBuild` → 模板占位符展开 → `destinationFolder`。  
- **编辑态预览：** `LVGLPageEditorRuntime` 调 Wasm 内 `_lvglCreate*` / `_mainLoop`，从 `HEAPU8` 取 RGBA 贴 canvas。  
- **调试：** Runtime/Debugger 同套 Wasm；Flow 可单步、监视变量。

---

## 3. 主要功能、优劣与对比

### 3.1 功能总览（UI 相关为主）

| 类别 | 能力 |
|------|------|
| 工程 | 多类型向导、40+ 模板叙事、Recent、版本/分辨率 |
| 设计 | 拖拽、~40 LVGL 控件、样式/主题、用户控件 |
| 逻辑 | Flow 图、表达式、Visual debugger |
| 预览 | Wasm 真 LVGL；可选 Full Simulator |
| 导出 | Build C/C++；无头构建；图字管线 |
| 工程化 | 多语言/XLIFF、动画时间轴、主题 |
| 额外（非 UI MVP） | Instruments、Dashboard、BB3、EEZ-GUI |

LVGL 工作流：选 LVGL（±Flow）→ 设计 → Wasm 预览/调试 → Build → STM32CubeIDE/Arduino/CMake 等接入（Renesas、Seeed 有公开指南）。

### 3.2 优点

零订阅；开源可审计；标准 LVGL 路径芯片中立；Flow+调试；Wasm 预览质量高；XLIFF；跨 OS；可与测控同工具。

### 3.3 缺点

GPL 边界需法务评估；学习曲线陡、产品面宽；Electron 重；生成约定/`eez-flow` 体积；Issues 尽力制；非 MP 一等公民；无 Web 实时共编；版本仍 0.x。

### 3.4 对比简表

| 对比项 | EEZ | SquareLine | Beken | LVGL Pro |
|--------|-----|------------|-------|----------|
| 许可 | GPL 开源 | 订阅闭源 | 宣传免费闭源 | 官方分层 |
| 预览 | Wasm + Flow 调试 | Play | 生成后 SDL | Wasm + 套件 |
| 逻辑 | Flow 图 | 事件 + ui_events | 事件 + custom | Subjects 等 |
| 额外 | 仪器/Dashboard | 板教程生态 | MCP AI | Figma/CLI |

选型：要开源可改 → EEZ；要轻快闭源 → Beken/SquareLine；要官方工程化 → Pro；要应用包 → Persim/FlyThings。

### 3.5 对自研的启示

可借鉴：明文 JSON、无头 Build、Wasm 真预览思路、版本矩阵显式化。  
慎照搬：Instrument 进 MVP、完整 Flow VM、Docker Full Sim、GPL 换皮商用。

---

## 4. 上篇结论

EEZ 是 **开源的「LVGL 设计器 + Flow +（可选）仪器台」**：LVGL 路径与 SquareLine/Beken 同范式，体验上限接近 Pro 的 Wasm 预览，并多出 Flow/测控。专项若只做「拖拽→可编译 UI」，应把它当 **参考实现与能力上限**，而不是必须全量克隆的产品规格。

---

# 下篇：仿制方案

## 5. 路线与合规

### 5.1 双锁定

| 维度 | 约定 |
|------|------|
| **能力** | 对齐 EEZ **LVGL UI 主路径**（设计、导出 C、真预览）；Flow/Wasm/i18n 分期 |
| **格式** | **自有 JSON**；不承诺读写 `.eez-project` |
| **量产** | `generated/` + `user/` 标准 LVGL C |
| **许可** | 自研建议 MIT/Apache；需要现成工具 → **直接用官方 EEZ** |

禁止：换皮闭源销售；冒用商标；闭源盗用官方 `lvgl_runtime_v*`；MVP 塞 Instrument/BB3/Dashboard/EEZ-GUI。

范围：只做 LVGL UI 工具；Wasm 自建可选；不做官方 Flow/eez-flow 二进制兼容。

### 5.2 目标一句话

> **自有 JSON ↔ 设计器 ↔ CodeGen ↔ 真 LVGL 预览（先 SDL，后可选 Wasm）↔（可选）逻辑图 ↔ 上板 `ui_init()`。**

MVP：**两页 + 切页/Call function → 生成 C → SDL 可点 → 板上跑通。**

---

## 6. 能力对齐与分期

| EEZ 能力 | 仿制落点 | 不要 |
|----------|----------|------|
| `.eez-project` | 自有 `project.json` + `screens/` | 官方方言兼容 |
| 多工程类型 | MVP 仅 LVGL | IEXT/BB3/… |
| ~40 控件 | MVP 8～12 → V1 扩展 | 首期全量 |
| Wasm runtime | V1+ 自研；MVP=SDL | 盗用官方 wasm |
| Flow + 调试 | V2 自有事件图/子集 | eez-flow 兼容 |
| Build 模板 | Handlebars/Jinja CLI | 假装兼容 objects_t |
| Instruments | 不做 | 进 UI MVP |

| 分期 | 内容 |
|------|------|
| **MVP** | Schema、CodeGen、SDL 预览、五区设计器、板级文档；无 Flow/Wasm/仪器 |
| **V1** | 字体/样式/CLI/模板；可选自研 Wasm（单版本线） |
| **V2** | 逻辑图子集、动画、XLIFF、可选 MCP |
| **永不** | `.eez-project` 兼容承诺；Instrument 全家桶；官方 runtime/flow 兼容卖点 |

---

## 7. 目标架构与工程格式

```text
Designer（Electron/Tauri + Vue 或 React）
        │ 自有 JSON（唯一权威）
        ▼
Schema + CodeGen CLI + PreviewPort
        ├─ A: SDL+LVGL（MVP）
        └─ B: 自研 Wasm（可选）
        ▼
板端 LVGL port + ui_init()
```

原则：单一 Schema；预览可插拔；产品面收敛；许可写清。

```text
MyUi/
  project.json
  screens/*.json
  styles/  assets/
  generated/   user/ui_events.c
```

`lvglVersion`、`previewBackend` 写入 `project.json`；控件 `type` 用自有枚举。

---

## 8. 工作拆分与模块要点

| 序 | 工作包 | 周期参考 |
|----|--------|----------|
| 0 | 合规：用官方 EEZ vs 仿制 | 2～3 天 |
| 1 | Schema + Hello | 3～5 天 |
| 2 | CodeGen CLI | 1～2 周（优先） |
| 3 | SDL PreviewPort | 1～2 周 |
| 4 | 设计器 | 1.5～2.5 月 |
| 5 | 板级文档/模板 | 1～2 周 |
| 6～7 | V1 Wasm/CLI；V2 逻辑图 | 按需 |

**顺序铁律：Schema → CodeGen → 真预览 → 设计器；Wasm/Flow 不得抢跑。**

| 模块 | 做法 |
|------|------|
| CodeGen | 模板引擎；`user/` 不覆盖；无设计器也能 CLI+SDL 通关 |
| 预览 | MVP=SDL；Wasm 须自建桥接+CI 出包+与 CodeGen 共用语义表 |
| 设计器 | 五区；DOM 辅助；JSON 为 store |
| 逻辑 V2 | 优先「事件-动作表→C」；完整 VM 仅强需求 |

工期：MVP **4～7 人月**；+Wasm **+2～4**；+Flow 调试再 **+3～6**。可与 Beken/SquareLine 仿制 **共享 schema/codegen/sdl**。

---

## 9. 风险、验收与和「直接用 EEZ」

| 风险 | 缓解 |
|------|------|
| 范围膨胀 | 章程排除仪器 |
| 先做花哨预览 | CLI SDL 门禁 |
| 预览≠导出 | 黄金用例双跑 |
| GPL/官方 wasm | 法务；自研或不做 |

MVP 验收：validate → generate（user 保留）→ SDL 切页 → 设计器回写 → 板上 `ui_init` → 无官方工程/商标依赖。

| | 用官方 EEZ | 仿制 |
|--|------------|------|
| 速度 | 立刻 | 人月级 |
| 许可/格式 | GPL / `.eez-project` | 自控 |
| 适合 | 内部提效 | 自有产品/SDK 工具 |

混合：内部用 EEZ 出原型，量产走自研格式——人工/脚本迁移，不做 L4 兼容。

---

## 10. 总结论

1. **分析：** EEZ = 开源 LVGL 可视化 + Wasm 真预览 + Flow +（可选）仪器；与 SquareLine/Beken 同 LVGL 导出赛道，能力更重。  
2. **仿制：** 只仿 **UI 主路径**；格式自有；底座 = Schema → CodeGen → SDL；Wasm/Flow 为加分项。  
3. **选型：** 要现成开源工具 → 用官方 EEZ；要产品许可与边界可控 → 按下篇仿制，并与 Beken 内核复用。  
4. **成功标准：** 同套自有工程在设计器 / SDL（或自研 Wasm）/ 板端可点选，且不依赖 `.eez-project` 与官方 runtime 二进制。

原厂功能对标见上篇 **§3** / 分析文档 **§3**；落地总设计见 **`EEZ_Studio_竞品逆向与重构设计说明.md`**。

---

## 11. 参考资料

1. `EEZ Studio/eez studio信息.txt`  
2. `EEZ Studio/EEZ_Studio分析文档.md`  
3. `EEZ Studio/EEZ_Studio_仿制方案.md`  
4. `EEZ Studio/EEZ_Studio_竞品逆向与重构设计说明.md`  
5. `EEZ Studio/studio-master/`（`README.md`、`package.json`、`packages/project-editor/lvgl/`、`flow/runtime/wasm/`）  
6. https://www.envox.eu/studio/studio-introduction/  
7. https://www.envox.eu/eez-studio-docs/8-projects-general-options/  
8. https://github.com/eez-open/studio  
9. Renesas RZ/G：Develop LVGL GUI using EEZ Studio  
10. Seeed：Work with EEZ Studio  
11. https://picopixel.io/compare/（第三方对比，需复核）  
12. `report/嵌入式UI工具_竞品对比分析报告.md`  
13. 体例：`quareline/SquareLine_Studio_分析与仿制方案.md`、`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`

---

*本文为技术分析与架构设计，不构成对 Envox / EEZ 的授权或工程兼容承诺；GPL、商标与生成物许可以官方为准。实施前请结合目标芯片、团队栈与法务裁剪。*
