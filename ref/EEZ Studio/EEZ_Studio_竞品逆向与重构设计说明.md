# EEZ Studio 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** Envox **EEZ Studio**（本地源码线索 **0.28.0**；LVGL **8.x & 9.x**）  
> **范围锁定：** **UI 工具主线（LVGL 工程）**；Instrument / BB3 / Dashboard / EEZ-GUI 全产品线默认不纳入重构 MVP  
> **输入材料：** `EEZ Studio/eez studio信息.txt`、本地 `studio-master`；既有分析 / 仿制 / 综合文档；官网 envox.eu、GitHub `eez-open/studio`、Renesas / Seeed / 社区资料  
> **关联文档：** `EEZ_Studio分析文档.md`、`EEZ_Studio_仿制方案.md`、`EEZ_Studio_分析与仿制方案.md`  
> **体例参考：** `quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`、`beken/BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`、`lvgl_pro/LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md`  
> **重构产品暂名：** **ForgeFlow Studio**（可替换）；CLI 暂名 **`ff-codegen` / `ff-preview` / `ff-build`**；工程格式暂名 **ForgeFlow Project（自有 JSON）**；可选预览包暂名 **`preview-lvgl-vX.Y.wasm`（自研）**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 EEZ Studio 所代表的 **Electron 可视化设计 + 明文 JSON 工程 + Wasm 真 LVGL 预览/调试 +（可选）EEZ Flow + Build 导出 LVGL C** 范式做结构化拆解，并设计一套 **功能兼容、格式与许可自有、量产基于开源 LVGL** 的替代工具链。

竞品与 Persim / FlyThings（专有宿主 + 应用包）不同：LVGL 路径板上是开源 **LVGL**，护城河在 **开源可审计 + Flow 低代码 + Wasm 真预览/调试 +（可选）测控共壳**。  
与 SquareLine / Beken / UIBuilder / LVGL Pro 同属「设计器 → LVGL 源码」赛道；差异是 **GPL 开源、Flow、自研 Emscripten `lvgl_runtime_v*`、多工程类型与 Instrument**。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清工程类型、`.eez-project`、LVGLBuild、Wasm 预览、Flow/eez-flow 边界、功能面与 GPL 约束 |
| **功能兼容** | 覆盖 UI 主路径：工程 → 设计 → 事件/（可选）逻辑图 → 真预览 → 生成 C → `ui_init()` 上板 |
| **格式自有** | 自有 Schema；**默认不**读写官方 `.eez-project` |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 自研壳建议 MIT/Apache；依赖 LVGL（MIT）；**不**把 GPL 换皮当闭源产品；**不**盗用官方 Wasm 当闭源依赖 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 多屏设计 / 属性样式 / Build-预览工作流接近 | ✅ 目标 |
| **L2 功能兼容** | LVGL UI 主功能清单对齐（见综合稿上篇 §3 / 分析文档 §3） | ✅ 目标（UI 子集） |
| **L3 产物形似** | 导出习惯接近 `ui`/`screens`/`user` 隔离 | ✅ 可选形似，**非**官方生成逐文件兼容 |
| **L4 工程兼容** | 直接打开官方 `.eez-project` | ❌ 默认不做 |
| **L5 工具链兼容** | 复用官方 `lvgl_runtime_v*` / eez-flow 调试协议 / 整仓 Fork 换皮 | ❌ 默认禁止 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 EEZ 工程兼容器，也不是 GPL 仓商业换皮。若必须完整 EEZ（含 Flow 调试 + 仪器）→ **直接使用官方 EEZ Studio**（遵守 GPL）。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先 CodeGen 后设计器** | Schema → CodeGen → 真 LVGL 预览打通后，再做桌面设计器 |
| **预览可插拔** | MVP=SDL；Wasm 为体验插件，**不是**产品底座 |
| **单一权威模型** | 自有 JSON 同时服务设计器、校验、CodeGen、预览后端 |
| **generated / user 隔离** | 生成区可覆盖；用户事件/动作不覆盖 |
| **产品面收敛** | 重构默认只做 LVGL UI；Instrument/BB3/Dashboard 另册 |
| **Flow 可选且自有** | 逻辑可视化不兼容 eez-flow 字节码 |
| **合规优先** | 禁止冒用 Envox/EEZ 商标；禁止闭源盗用官方 runtime；GPL 边界写进法务清单 |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | `studio-master` 包结构、`ProjectType`、`.eez-project` 模型、`lvgl/build.ts`、`flow/runtime/wasm/` | 读开源源码与明文 JSON |
| 行为逆向 | Build 模板展开、Wasm 帧缓冲预览、Flow 调试、无头 `--build-project` | 源码 + 官网文档 |
| 功能逆向 | 控件面、样式、i18n、动画、多类型工程 | 公开能力 + 分析文档 |
| 不做 | 破解付费 Support、冒充官方发行、宣称 `.eez-project`/eez-flow 二进制兼容 | — |

### 1.6 本设计默认范围

| 纳入 | 默认不纳入（可二期） |
|------|----------------------|
| LVGL 设计器 + CodeGen + SDL/可选 Wasm 预览 | SCPI/VISA Instrument 台 |
| 可选自有逻辑图（事件-动作 → C） | 完整 eez-flow VM + 官方调试协议 |
| 1～2 个 LVGL 版本线 | EEZ-GUI / Lite / BB3 / Dashboard / IEXT |
| CLI validate/generate/preview | Docker Full Simulator 全家桶 |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | EEZ Studio |
| 厂商 | Envox d.o.o. |
| 形态 | **开源跨平台 Electron IDE**（Win/macOS/Linux） |
| 版本线索 | `package.json` **0.28.0** |
| 定位 | 低代码 GUI（LVGL/EEZ-GUI/Dashboard）+ Flow + T&M 仪器遥控 |
| 商业 | 免费开源（GPL-3.0）；可选付费 Support plans |
| 图形库（UI 主路径） | **开源 LVGL 8.x/9.x**；板上无闭源 GUI 解释器（纯 LVGL 导出时） |

### 2.2 分层逆向模型（UI 主路径）

```text
┌─────────────────────────────────────────────────────────────┐
│ L5 可选扩展  Instruments / Dashboard / BB3 / IEXT / EEZ-GUI   │
│   （与纯 LVGL 导出可剥离；重构默认不上）                        │
├─────────────────────────────────────────────────────────────┤
│ L4 工具层  Electron + React + MobX + flexlayout               │
│   Project Editor / 停靠面板 / Build / Runtime·Debugger        │
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  .eez-project（明文 JSON，MobX 序列化）              │
│   settings / userPages / lvglStyles / bitmaps / fonts / flow  │
├─────────────────────────────────────────────────────────────┤
│ L2a 预览运行时  自研 Emscripten：lvgl_runtime_v*.js/.wasm      │
│   （LVGL 源码 + EEZ 桥接；非 LVGL 官方现成包）                 │
│ L2b 产物层  Build → ui.c / screens.c / 图字 /（可选）eez-flow │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  板端 LVGL port + ui_init/loadScreen；（Flow 时）eez-flow │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **L1 可完全自建**（LVGL 开源）——与 Persim/FlyThings 不同。  
2. 护城河在 **L4 开源体验 + L2a Wasm 真预览 + Flow 调试 +（L5）测控广度**；板上不锁专有 GUI 宿主（无 Flow 时）。  
3. **L2a Wasm 是 EEZ 自制品**（路径痕迹如 `studio-wasm-libs/lvgl-runtime/...`），维护成本高；仿制可 SDL 替代。  
4. **L3 `.eez-project` 可读但方言重**（多工程类型、Flow、仪器字段交织）；兼容它 = 长期格式债。  
5. 只仿画布不做 CodeGen+真预览，无法形成兼容级 LVGL 工具。  
6. **GPL-3.0** 使「Fork 换皮闭源卖」不可行；功能兼容重构应 **自写核心** 或合规开源分发。

### 2.3 数据流逆向（LVGL）

```text
拖拽 / 属性改 .eez-project（MobX 图）
    → 编辑态：LVGLPageEditorRuntime
         require(lvgl_runtime_vX.Y.js)
         → _init / lvglCreate* / _mainLoop
         → HEAPU8 帧 → canvas.putImageData
    →（可选）F5/F6：Wasm Worker 跑 Flow + 调试协议
    → Build：LVGLBuild 两阶段 + settings.build.files[] 模板
         → destinationFolder：ui/screens/styles/images/fonts…
         →（flowSupport）可选 eez-flow 合并源
    → 用户固件：lv_init → 驱动 → ui_init / loadScreen
```

与 Beken：**同为设计器→源码**；EEZ 预览更重（Wasm 内嵌），Beken 是生成后 SDL。  
与 SquareLine：Play 都是「编辑器内快反馈」；SquareLine 闭源 Play，EEZ 开源 Wasm。  
与 LVGL Pro：同 Wasm 真预览族；Pro 另有官方 XML 规范壁垒，EEZ 无此合规红线但有 GPL。

### 2.4 工程与产物逆向

| 竞品要素 | 职责 | 重构对应 |
|----------|------|----------|
| `.eez-project` | 权威工程 JSON | ForgeFlow `project.json` + `screens/*.json` |
| `settings.general.lvglVersion` | 版本锁 | `project.json.lvglVersion` |
| `flowSupport` | 是否带 Flow | 可选模块开关；默认关 |
| `LVGLBuild` + 模板 files[] | CodeGen | `ff-codegen`（Handlebars/Jinja） |
| `lvgl_runtime_v*.js` | 编辑器真预览 | MVP：`ff-preview` SDL；V1+：自研 wasm |
| `eez-flow.*` | 板上 Flow 运行时 | **默认不生成**；V2 自有逻辑→C |
| `.eez-project-build` | 生成清单 | 可选 `.ff-build-manifest.json` |
| `--build-project` | 无头构建 | `ff-build` / `ff-codegen` |

### 2.5 功能面逆向（UI 主清单）

| 类别 | 竞品能力 | 重构优先级 |
|------|----------|------------|
| 工程 | LVGL 向导、分辨率、版本、模板 | P0 |
| 设计 | 多屏、~40 控件、树、属性 | P0（控件子集）→ P1 扩展 |
| 样式/主题 | lvglStyles、颜色主题 | P1 |
| 事件 | 切页、回调/动作 | P0 |
| Flow | 流程图 + 调试器 | P2（可选自有子集） |
| 预览 | Wasm / Debugger / Full Sim | P0=SDL；P1=自研 Wasm；Full Sim 不做 |
| 导出 | Build C、图字 | P0；不绑 eez-flow |
| i18n/动画 | XLIFF、时间轴 | P1～P2 |
| 仪器/BB3/… | Instrument 等 | **排除** |

### 2.6 竞品优劣（重构输入）

| 可吸收 | 应避开 |
|--------|--------|
| 明文 JSON、无头 Build | 多工程类型噪声进 MVP |
| Wasm 真预览思路（自建） | 首期维护 8.4～9.5 全矩阵 |
| generated 与用户逻辑分离 | 强制板上 eez-flow |
| 开源可参考实现细节 | GPL 换皮闭源商用 |
| 跨 OS Electron | Instrument 拖垮专项 |

---

## 3. 兼容软件重构设计

### 3.1 产品定义

**ForgeFlow Studio**：面向嵌入式团队的 **LVGL 可视化设计与代码生成工具**，在体验与主功能上兼容 EEZ 的 **LVGL UI 主路径**，工程格式与预览运行时自有，量产依赖开源 LVGL。

定位口号（对内）：

> **开源竞品级能力，自有格式与许可；先能生成能跑，再追 Wasm/逻辑图。**

### 3.2 逻辑架构

```text
┌──────────────────────────────────────────────────────────────┐
│  ForgeFlow Designer（Electron / Tauri）                       │
│  控件库 / 画布 / 树 / 属性 / 事件 / 资源 / 预览·生成           │
│  （可选）Logic Graph 模块                                     │
└────────────────────────────┬─────────────────────────────────┘
                             │ ForgeFlow Project JSON
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Core                                                           │
│  Schema 校验 │ ff-codegen │ PreviewPort │（可选）ff-build     │
└──────────────┬───────────────────────────┬────────────────────┘
               ▼                           ▼
     PreviewPort-SDL                 PreviewPort-Wasm（自研）
     generate→cmake→窗口              编辑器内嵌真 LVGL
               │
               ▼
     板端：LVGL + ui_init()（标准 port）
```

可与 **ForgeUI / ForgeLine** 共享 `schema` + `codegen` + `preview-sdl`；ForgeFlow 增量在 **Wasm 预览插件** 与 **可选逻辑图**。

### 3.3 模块职责

| 模块 | 职责 | 对标竞品 |
|------|------|----------|
| **schema** | JSON Schema、控件注册表、版本字段 | `.eez-project` 模型（自有方言） |
| **ff-codegen** | 模板生成 `generated/` + 保护 `user/` | `LVGLBuild` + build.files |
| **ff-preview** | SDL 真预览 | 竞品 Wasm 的「真 LVGL」目标；实现改为 SDL |
| **preview-wasm** | 可选自研 Emscripten 包 | `lvgl_runtime_v*`（能力对齐，二进制自有） |
| **designer** | 五区 IDE | Project Editor（砍仪器壳） |
| **logic-graph** | 可选事件图→C | EEZ Flow（不兼容） |
| **docs/templates** | 上板与 SDL/MCU 模板 | 官方模板叙事的自有替代 |

### 3.4 关键接口（示意）

```text
ff-codegen  validate <projectDir>
ff-codegen  generate <projectDir> [--out generated]
ff-preview  run <projectDir>          # SDL
ff-build    ci <projectDir>           # validate+generate（无头）
```

设计器仅调用上述 CLI/库 API，不内嵌第二套生成逻辑。

### 3.5 数据模型（ForgeFlow Project）

```text
ForgeFlowProject/
  project.json
  screens/*.json
  styles/                 # 可选
  assets/images|fonts/
  generated/              # 可清
  user/ui_events.c|h      # 不清
  .ff-build-manifest.json # 可选
```

`project.json` 核心字段：`schemaVersion`、`name`、`display{width,height,colorDepth}`、`lvglVersion`、`previewBackend: "sdl"|"wasm"`、`screens[]`、`assets`。

控件节点：`type`、`id`、`name`、`frame`、`props`、`style`、`states`、`events`、`children`。  
**禁止**对外暴露 EEZ 内部 type id / `_eez_*` 字段作为兼容层。

### 3.6 预览后端策略（设计决策）

| 后端 | 何时用 | 说明 |
|------|--------|------|
| **SDL** | MVP 默认 | 与上板同源；实现成本低 |
| **自研 Wasm** | V1+ 体验目标 | Emscripten 编 LVGL+窄桥；**一版本线**；CI 出包 |
| **官方 EEZ wasm** | 禁止作闭源依赖 | GPL/合规风险 |
| **仅 DOM** | 仅编辑辅助 | **不可**作为验收 |

Wasm 自研硬约束：与 CodeGen **共用控件语义表**；`lvglVersion` 字段与包名绑定；黄金用例 SDL/Wasm 双跑。

### 3.7 逻辑可视化策略（设计决策）

| 策略 | 说明 | 推荐 |
|------|------|------|
| **A. 事件-动作表 → C** | 切页/设属性/Call function/改变量；无板上 VM | **默认** |
| **B. 自有流程图 → C 或轻量 VM** | 对标 Flow 体验；调试挂 SDL/Wasm | 明确需求时 |
| **C. 兼容 eez-flow** | L4/L5 倾向 | **拒绝** |

### 3.8 与「直接用官方 EEZ」的边界

| 场景 | 建议 |
|------|------|
| 内部提效、接受 GPL、要 Flow+仪器 | **用官方 EEZ** |
| 自有品牌工具、宽松许可、SDK 捆绑 | **ForgeFlow 重构** |
| 只要轻量拖拽→C | ForgeUI/ForgeLine 内核即可，不必单独立项 ForgeFlow |

---

## 4. 分期与里程碑

### 4.1 MVP（功能兼容最小集）

- Schema + Hello 双屏  
- 8～12 控件；切屏 + Call function  
- `ff-codegen` → `generated/` + `user/`  
- `ff-preview` SDL 可点选  
- 五区设计器  
- 板上 `ui_init` 文档  
- **不做：** `.eez-project`、Flow、Wasm、Instrument、Full Sim  

**门禁：** 无设计器时仅 CLI 即可 SDL 通关，才开始打磨 UI。

### 4.2 V1

- 字体裁剪、样式/主题、控件扩展  
- CLI 完整；1～2 模板  
- **可选** PreviewPort-Wasm（单 LVGL 版本）  
- 简单 i18n  

### 4.3 V2

- Logic Graph 子集（策略 A 或 B）  
- 动画时间轴；XLIFF  
- 可选 MCP 改自有 JSON  
- 自定义控件注册  

### 4.4 明确不做（默认）

- L4 `.eez-project` 兼容承诺  
- L5 官方 `lvgl_runtime_*` / eez-flow 二进制兼容  
- Instrument / BB3 / Dashboard / EEZ-GUI 产品线  
- GPL Fork 换皮闭源销售  

---

## 5. 工作拆分（研发序）

| 序 | 工作包 | 交付 | 周期参考 |
|----|--------|------|----------|
| 0 | 合规与选型纪要 | 用官方 vs 重构；GPL/Wasm 策略 | 2～3 天 |
| 1 | Schema + 示例 | 可校验 Hello | 3～5 天 |
| 2 | ff-codegen | JSON→C + user 保护 | 1～2 周 |
| 3 | ff-preview SDL | 一键可点 | 1～2 周 |
| 4 | Designer | 拖完即生成+预览 | 1.5～2.5 月 |
| 5 | 板级文档/模板 | 上板同套代码 | 1～2 周 |
| 6 | V1 Wasm/工程化 | 可选真预览内嵌 | 1～2 月 |
| 7 | V2 逻辑图等 | 差异化 | 按需 |

**人员：** 嵌入式（CodeGen/预览/模板）+ 前端（设计器）+ 中间层（Schema/CLI）。  
**工期：** MVP 4～7 人月；+Wasm +2～4；+Flow 调试再 +3～6。  
**复用：** 优先合并 ForgeUI/ForgeLine 的 schema/codegen/sdl。

---

## 6. 质量、安全与合规

### 6.1 功能兼容验收

1. 设计器完成双页：背景/图/字/按钮  
2. 切屏 + Call function；`user` 可改业务且再生成不丢  
3. SDL（或自研 Wasm）真 LVGL 预览正确  
4. 同套代码进 CMake+LVGL 工程可运行  
5. 工程格式检测 **不是** 官方 `.eez-project` 方言  
6. 发行物 **不含** 未合规使用的官方 `lvgl_runtime_v*`  

### 6.2 合规清单

- [ ] 自研许可（MIT/Apache 等）与第三方台账（LVGL、Electron…）齐全  
- [ ] 未将 GPL 修改版闭源再分发  
- [ ] 未承诺 L4/L5  
- [ ] 无 Envox/EEZ/BB3 商标冒用  
- [ ] Wasm 若存在：来源为自研 CI，非法务未批的官方包拷贝  

### 6.3 风险

| 风险 | 对策 |
|------|------|
| 范围膨胀到仪器 | 章程 + 模块裁剪 |
| 先做 Wasm/Flow | CLI SDL 门禁 |
| 预览与导出不一致 | 单一 Schema + 双跑用例 |
| 与 ForgeUI 重复建设 | 共享 Core，产品包差异化 |
| 被要求打开 `.eez-project` | 引导用官方 EEZ 或签迁移项目 |
| LVGL 版本债 | 只承诺 1～2 版本 |

---

## 7. 目录与交付物建议

```text
forgeflow/
  docs/                  # 本设计说明、上板指南、合规说明
  packages/
    schema/
    codegen/             # ff-codegen
    preview-sdl/         # ff-preview
    preview-wasm/        # 可选
    designer/
    logic-graph/         # 可选 V2
  templates/boards/
  examples/hello/
```

交付物：可安装设计器、CLI、SDL 预览、（可选）Wasm 包、Hello 示例、上板文档、测试用例、本设计说明。

---

## 8. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | 开源 Electron IDE：`.eez-project` → Wasm 真 LVGL（±Flow）→ Build 出 LVGL C（±eez-flow）；另挂仪器等多类型 |
| 逆向重点 | L3 工程模型、L2a 自研 Wasm、L2b CodeGen；L5 仪器可剥离；L1 用开源 LVGL |
| 兼容策略 | **L1+L2 功能兼容（UI 子集）**；格式自有；拒绝默认 L4/L5 |
| 重构抓手 | **Schema → CodeGen(generated/user) → SDL 真预览 → Designer →（可选）自研 Wasm / 逻辑图** |
| 与 SquareLine/Beken 重构关系 | 同内核可共享；ForgeFlow 增量 = 预览体验与可选逻辑可视化 |
| 与「用官方 EEZ」 | 要完整 Flow+仪器+零开发 → 用官方；要自有产品许可 → 走本文 |
| 成功标准 | 同套自有工程在设计器/SDL（或自研 Wasm）/板端可点选；user 可迭代；无 `.eez-project`/官方 runtime 依赖 |

EEZ 公开卖点是 **开源 + 真预览 + Flow +（可选）测控**。ForgeFlow 用工程闭环兑现 **开源竞品级的 LVGL 设计→生成→上板**，并以自有格式、宽松许可与可插拔预览形成差异；**不**做兼容器，**不**做 GPL 换皮闭源。

---

## 9. 参考资料

1. `EEZ Studio/eez studio信息.txt`  
2. `EEZ Studio/EEZ_Studio分析文档.md`（§2 原理、§3 功能）  
3. `EEZ Studio/EEZ_Studio_仿制方案.md`  
4. `EEZ Studio/EEZ_Studio_分析与仿制方案.md`  
5. `EEZ Studio/studio-master/`（`README.md`、`package.json`、`packages/project-editor/lvgl/`、`flow/runtime/wasm/`、`build/`）  
6. https://www.envox.eu/studio/studio-introduction/  
7. https://www.envox.eu/eez-studio-docs/8-projects-general-options/  
8. https://github.com/eez-open/studio  
9. Renesas / Seeed 公开 EEZ+LVGL 集成指南  
10. 体例参考：`quareline/…竞品逆向与重构设计说明.md`；`beken/…`；`lvgl_pro/…`  
11. `report/嵌入式UI工具_竞品对比分析报告.md`  

---

*本文为设计说明，不构成对 Envox / EEZ 的授权或工程兼容承诺；GPL、商标与生成物许可以官方为准。默认范围以 LVGL UI 工具为主；Instrument/Flow 全量兼容见「直接使用官方」路径。*
