# EEZ Studio UI 工具仿制方案

> **依据：** `EEZ Studio/EEZ_Studio分析文档.md`、`EEZ Studio/eez studio信息.txt`、本地源码树 `studio-master`（0.28.0）、官网 envox.eu、GitHub `eez-open/studio`，以及 Renesas / Seeed / 社区公开对比等。  
> **对象：** EEZ Studio 所代表的 **「可视化设计 →（可选 Flow）→ 真 LVGL 预览/调试 → 导出 LVGL C → 上板」** 范式中的 **UI 工具主线**。  
> **仿的是能力与架构，不是品牌、`.eez-project` 官方方言兼容，也默认不 Fork 整仓 GPL 应用作为产品壳。**  
> 分析文档：[`EEZ_Studio分析文档.md`](./EEZ_Studio分析文档.md)。  
> 综合稿（分析+仿制，推荐）：[`EEZ_Studio_分析与仿制方案.md`](./EEZ_Studio_分析与仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`EEZ_Studio_竞品逆向与重构设计说明.md`](./EEZ_Studio_竞品逆向与重构设计说明.md)。

---

## 0. 路线与合规（先锁死）

### 0.1 原厂范式一句话（UI 主路径）

> **Electron 编辑明文 JSON 工程 → 拖拽 LVGL 控件（可选 EEZ Flow）→ Wasm 真 LVGL 预览/调试 → Build 模板生成 `ui.c`/`screens.c`（可选 eez-flow）→ 接入任意 LVGL port。**

与 Persim / FlyThings（宿主 + 应用包）不同；与 SquareLine / Beken / UIBuilder / LVGL Pro **同属 LVGL 源码导出赛道**。EEZ 的差异化在于：**开源可审计、Flow 低代码、Wasm 真预览 + 调试、以及测控 Instrument 共壳**（后两者 UI 仿制可分期砍掉）。

### 0.2 双锁定

| 维度 | 约定 |
|------|------|
| **能力** | 对齐 EEZ **LVGL 工程主路径**：多屏设计、样式、资源、Build 导出 C、真 LVGL 预览；Flow / 多语言 / 动画按分期 |
| **格式** | **自有 JSON Schema**；**不**承诺读写官方 `.eez-project` |
| **量产** | 导出标准 LVGL C：`generated/`（可覆盖）+ `user/`（不覆盖） |
| **品牌 / 许可** | 自有产品名；自研代码建议 **Apache-2.0 / MIT**（避免把商用产品绑死在 GPL-3.0 应用壳上） |

| 诉求 | 建议 |
|------|------|
| 立刻要开源现成工具、可接受 GPL 与学习曲线 | **直接用官方 EEZ Studio** |
| 要同范式、控产品许可与功能边界、自控格式 | **本文仿制** |
| 只要轻量「拖拽→C→SDL」 | 跟 Beken/SquareLine 仿制即可，本文作 **Wasm/Flow 上限参考** |

### 0.3 禁止事项

- 把官方 EEZ 安装包 / 仓库 **原样换皮** 当自有闭源或「自研」商用产品对外销售（GPL 合规与商标双重风险）  
- 对外宣传「兼容 `.eez-project` 一键打开」作为产品承诺（除非明确做只读导入且标注非官方）  
- 冒用 Envox / EEZ / BB3 等商标与品牌资源  
- 把官方预编译 `lvgl_runtime_v*.js/.wasm` **原样拷贝进闭源商业发行**却不遵守 GPL 义务（这些产物随 Studio 源码树分发，法务需单独评估；**自研应自建 Wasm 或改用 SDL**）  
- MVP 范围混入 **Instrument/SCPI、BB3 Applet、Dashboard、EEZ-GUI 全量**（易做成「半个 LabVIEW」，拖垮专项）

### 0.4 仿制范围裁剪（相对原厂）

| 纳入（UI 工具） | 默认不纳入（可二期另册） |
|----------------|--------------------------|
| LVGL 工程、设计器、CodeGen、预览、板级接入 | SCPI / VISA / IEXT 仪器台 |
| 可选：轻量事件图或子集 Flow | 完整 eez-flow 虚拟机 + 板上 Runtime 兼容 |
| 可选：Wasm 真预览（自建） | Docker Full Simulator 全家桶 |
| 1～2 个 LVGL 大版本 | EEZ-GUI / Lite / BB3 / Dashboard 全工程类型 |

> **结论：** 本方案是 **「EEZ UI 能力级仿制」**，不是「EEZ 全产品克隆」，也不是「GPL Fork 换皮」。

---

## 1. 仿制目标

### 1.1 目标表述

> **自有 JSON 工程 ↔ 可视化设计器 ↔ 模板 CodeGen（generated/user 隔离）↔ 真 LVGL 预览（先 SDL，后可选 Wasm）↔（可选）逻辑可视化 ↔ 导出进任意 LVGL SDK。**

MVP 必须打通：

**拖两页 → 配点击切页与 Call function → 一键生成 C → PC 真 LVGL 可点选 → 板端最小工程调用 `ui_init()`。**

### 1.2 能力对齐表（对标 EEZ，落点自有）

| EEZ 公开 / 源码能力 | 仿制对齐方式 | 不要 |
|---------------------|--------------|------|
| `.eez-project` JSON | 自有 `project.json` + `screens/*.json` | 官方字段方言兼容承诺 |
| 多工程类型向导 | MVP **仅 LVGL**；其它类型不做 | 复制 FIRMWARE/IEXT/APPLET 枚举 |
| 拖拽 + 停靠面板 | Electron/Tauri + Vue/React 五区工作台 | 抄官方皮肤资源 |
| ~40 LVGL 控件 | MVP 8～12；V1 扩到常用全集 | 一上来全量对表 |
| `lvglStyles` / 主题 | Part/State 或等价样式表；主题色 | — |
| Wasm `lvgl_runtime_v*` | **可选 V1+**：自研 Emscripten 包；MVP 用 **SDL** | 直接盗用官方 runtime 二进制当闭源卖点 |
| Flow 流程图 + 调试器 | V2：自有「事件图/动作图」子集；或显式不做 | 兼容 eez-flow 字节码 / 官方调试协议 |
| Build 模板占位符 | Handlebars/Jinja：`${SCREEN_DEFS}` 一类 | 输出文件名故意撞 `objects_t` 误导兼容 |
| `ui.c` / `screens.c` / 图字 | `generated/` 标准 LVGL API | 强制捆绑板上 eez-flow |
| 用户动作 / 变量 | `user/actions.c`、`user/ui_events.c` 不覆盖 | — |
| 无头 `--build-project` | CLI：`validate \| generate \| preview` | — |
| 字体/图转换 | `lv_font_conv` + 开源/自研 img conv | 搬闭源工具 |
| 多语言 / XLIFF | V1～V2 | MVP 可不做 |
| 动画时间轴 | V1～V2 | — |
| Instruments / Dashboard | **不做**（另立项） | 塞进 UI MVP |
| GPL 开源分发 | 自研许可自定；可 **参考** 开源实现思路 | 违反 GPL 再分发修改版却闭源 |

### 1.3 原厂功能面 → 分期落点

| 类别 | 原厂能力 | 分期 |
|------|----------|------|
| 工程 | LVGL 类型、分辨率、LVGL 版本、模板 | MVP（单类型）；模板 V1 |
| 设计 | 多屏、控件树、属性、样式 | MVP 基础控件；样式加深 V1 |
| 逻辑 | 事件；Flow + 调试 | MVP：切页 + Call function；Flow V2 |
| 预览 | Wasm 编辑态 + Runtime/Debugger + Docker Full Sim | MVP：**SDL**；V1：可选 Wasm；Full Sim 不做或极晚 |
| 导出 | Build → C（± eez-flow） | MVP：纯 LVGL C；不绑 eez-flow |
| 资源 | 图、字、主题 | MVP 图；字体裁剪 V1 |
| i18n / 动画 | XLIFF、时间轴 | V1～V2 |
| 测控 / BB3 / Dashboard | Instrument 等 | **不在本方案** |

---

## 2. 目标架构

```text
┌────────────────────────────────────────────────────────────────┐
│  Designer（Electron / Tauri + Vue3 或 React，推荐 Vue 对齐 Beken）│
│  控件库 / 画布(可 DOM 近似) / 树 / 属性 / 事件 / 资源 / 预览入口  │
│  （V2）逻辑图画布 — 可选模块，可卸载                             │
└──────────────────────────────┬─────────────────────────────────┘
                               │ 自有 JSON 工程（唯一权威）
                               ▼
┌────────────────────────────────────────────────────────────────┐
│  Core：Schema 校验 + CodeGen CLI + Preview Backend 接口          │
│  generate → generated/ + user/                                   │
│  preview  → PreviewPort（可替换实现）                            │
└───────────────┬────────────────────────────┬───────────────────┘
                ▼                            ▼
     PreviewPort A：SDL+LVGL          PreviewPort B：自研 Wasm
     （MVP，与上板同源）               （V1+，编辑器内嵌）
                │
                ▼
          板端：任意 LVGL port + ui_init()
```

**设计原则（相对 EEZ 的改进点）：**

1. **单一权威模型** — 预览与 CodeGen 只消费 JSON，禁止「Wasm 一条路、导出另一套手写」。  
2. **预览可插拔** — Wasm 是体验插件，不是底座（参见既有讨论结论）。  
3. **产品面收敛** — 先做 LVGL UI 工具，不做「IDE + 仪器台」。  
4. **许可清晰** — 工具链与生成物许可在文档中写死，避免 GPL 灰区。

与原厂概念映射（仅理解用）：

| 原厂 | 仿制 |
|------|------|
| `.eez-project` | 自有 `project.json` + `screens/` |
| `LVGLBuild` + 模板 files[] | `ui-codegen`（Handlebars 等） |
| `lvgl_runtime_v*.wasm` | 可选自研 `preview-lvgl.wasm`；MVP 用 SDL |
| EEZ Flow | 可选 `logic-graph` 模块（自有运行时，不兼容 eez-flow） |
| `--build-project` | `ui-codegen` / `ui-preview` CLI |
| Instruments | 不映射 |

---

## 3. 自有工程格式（建议）

刻意 **不同于** `.eez-project` 的顶层键与内部 `_eez_*` 模型，避免被当成兼容层：

```text
ForgeEezUi/                    # 产品目录名可替换
  project.json                 # name, resolution, lvgl_version, color_depth
  screens/
    home.json                  # id, name, children[]
    settings.json
  styles/                      # 可选：命名样式
  assets/
    images/
    fonts/
  generated/                   # CodeGen 输出（可清、可覆盖）
  user/                        # 手写业务（再生成保留）
    ui_events.c
    ui_events.h
  .ui-build-manifest.json      # 可选：生成文件清单（对标 .eez-project-build）
```

`project.json` 建议字段：

```json
{
  "schemaVersion": 1,
  "name": "hello",
  "display": { "width": 480, "height": 320, "colorDepth": 16 },
  "lvglVersion": "9.2.0",
  "previewBackend": "sdl",
  "screens": ["screens/home.json", "screens/settings.json"],
  "assets": { "images": "assets/images", "fonts": "assets/fonts" }
}
```

控件节点建议字段：`type`、`id`、`name`、`frame`、`props`、`style`、`states`、`events`、`children`。  
`type` 用稳定枚举（`button`/`label`/…），内部再映射到 LVGL API；**不要**照搬 EEZ 组件 type id 数字表作为对外格式。

---

## 4. 分期计划

### 4.1 MVP（可上板）

- Schema + Hello 双屏示例 + JSON Schema 校验  
- 8～12 控件；切屏 + Call function  
- CodeGen → C + `user/ui_events.c` + CMakeLists/filelist  
- **真 LVGL + SDL** 一键预览（generate → 编译 → 窗口）  
- 设计器五区：库 / 画布 / 树 / 属性 / 导出·预览  
- 板端最小接入文档  
- **不做：** `.eez-project` 兼容、Flow、Wasm、Instrument、Docker Full Sim、XLIFF、全控件、多 LVGL 小版本矩阵  

### 4.2 V1（体验与工程化）

- 字体裁剪；图片 SOURCE/FS；命名样式 / 主题色  
- 控件扩到日常 HMI 常用集  
- CLI：`validate | generate | preview`  
- 1～2 个板级/SDL 模板  
- **可选：** 自研 **Wasm 真预览**（仅维护 **一个** LVGL 版本线，如 9.2）  
- 简单多语言（可选）  

### 4.3 V2（对标 EEZ 差异化能力）

- **逻辑可视化子集**（事件/动作图，自有解释或直接 CodeGen 成 C，**不**兼容 eez-flow）  
- 可选调试：变量监视 / 断点（若走 Wasm+自有 VM）  
- 动画时间轴；XLIFF  
- 用户自定义控件注册  
- 可选 MCP：改自有 JSON  

**永不做（本方案默认）：** 官方工程兼容承诺；Instrument 台；BB3/EEZ-GUI 全产品线；宣称兼容官方 Wasm/eez-flow 二进制。

---

## 5. 工作拆分（按顺序）

| 序号 | 工作包 | 周期参考 | 交付 |
|------|--------|----------|------|
| **0** | 合规 + 范围裁剪纪要 | 2～3 天 | 决策：只用官方 EEZ vs 仿制；GPL/Wasm 策略 |
| **1** | JSON Schema + Hello 工程 | 3～5 天 | 可校验示例 |
| **2** | CodeGen CLI | 1～2 周 | JSON→`generated/`+`user/`；**优先打通** |
| **3** | PreviewPort-SDL | 1～2 周 | 一键可点选 |
| **4** | 设计器 UI | 1.5～2.5 月 | 拖完即可生成+预览 |
| **5** | 板级文档 + 最小模板 | 1～2 周 | 上板跑同套代码 |
| **6** | V1：字体/样式/CLI/（可选）Wasm | 1～2 月 | 体验接近 EEZ 编辑态 |
| **7** | V2：逻辑图 / i18n / 动画 | 按需 | 差异化 |

**原则：0→1→2→3，再 4。** Wasm 与 Flow **禁止**插到 CodeGen 之前。

| 角色 | 职责 |
|------|------|
| 嵌入式 | CodeGen、SDL/Wasm 桥、板级模板、LVGL 版本锁定 |
| 前端 | 设计器、属性表、（V2）逻辑图编辑器 |
| 中间层 | Schema、校验、CLI、manifest |

**工期粗估：**

- MVP：**4～7 人月**（与 SquareLine/Beken 仿制同量级）  
- 含自研 Wasm 预览：**+2～4 人月**（含 Emscripten 流水线与一版本维护）  
- 含 Flow 子集调试：**再 +3～6 人月**  
- 对标 EEZ「LVGL+Flow+调试」密度且不含仪器：约 **12～20 人月**

若已有 Beken/SquareLine 仿制内核：**直接复用 Schema/CodeGen/SDL**，把增量放在「预览体验（Wasm）」与「逻辑图」——这才是对标 EEZ 的差异点。

---

## 6. 关键模块怎么做

### 6.1 CodeGen（工作包 2）

| 项 | 建议 |
|----|------|
| 引擎 | Handlebars / Jinja2（对标 EEZ 模板占位符，实现更简单） |
| 输出 | `ui.c/h`、`ui_screen_*.c`、helpers、images、fonts |
| 用户区 | `user/ui_events.c`：Call function 空实现；**再生成不覆盖** |
| 构建辅助 | `CMakeLists.txt`、`filelist.txt` |
| LVGL 版本 | `project.json.lvglVersion` 与仿真/Wasm **同一字段** |
| 验收 | **无设计器**仅 CLI 即可 SDL 跑通 Hello |

参考 EEZ 的「两阶段 LVGLBuild + 模板展开」，但输出目录结构应对齐自有约定，不必模仿 `objects_t` 全局表（可选用更清晰的 `screen_home_create()` 风格，减少与 EEZ 生成物撞车）。

### 6.2 预览（工作包 3 / V1）

| 方案 | 说明 | 阶段 |
|------|------|------|
| **A. 生成 → CMake → SDL** | 与上板同源；实现简单 | **MVP 必选** |
| **B. 常驻 sim 热替换 generated** | 反馈更快 | V1 优化 |
| **C. 自研 Wasm 真 LVGL** | 编辑器内嵌；对标 EEZ/Pro | **可选 V1+** |

**Wasm 若做，必须满足：**

1. 自建 Emscripten 工程：LVGL 源码 + **自有**窄桥接（create/setStyle/tick/getFramebuffer）  
2. CI 编译出 `preview_lvgl_vX.Y.js/.wasm`，版本与工程字段绑定  
3. 与 CodeGen **共用控件语义表**（同一 JSON → 预览 create / 导出 C）  
4. **默认只维护 1 条版本线**；加版本 = 加维护预算  
5. 法务：不把官方 EEZ runtime 当闭源商业依赖

**强制：** 验收以真 LVGL 为准；DOM 画布只做编辑辅助。

### 6.3 设计器（工作包 4）

| 项 | 建议 |
|----|------|
| 壳 | Electron 或 Tauri；跨 Win/macOS/Linux（对标 EEZ） |
| 栈 | Vue3+TS（易复用 Beken 仿制）或 React（更近 EEZ 源码习惯） |
| 布局 | 五区即可；停靠面板可 V1 再做 |
| 画布 | MVP：DOM 近似 + 预览按钮；有 Wasm 后再考虑「画布即真 LVGL」 |
| 状态 | 工程 JSON 为唯一 store；撤销=JSON 快照 |

### 6.4 逻辑可视化（V2，可选）

| 策略 | 说明 |
|------|------|
| **推荐 A** | 「事件-动作表」增强（切页/设属性/调函数/改变量），**CodeGen 成 C**，无板上 VM |
| **可选 B** | 自研轻量流程图 → 解释字节码或生成状态机 C；调试挂 SDL/Wasm |
| **禁止** | 兼容官方 Flow 定义 / eez-flow 合并源作为「兼容运行时」卖点 |

多数「拖拽生成可编译 UI」专项用 **策略 A** 已够；只有明确要「非程序员改逻辑、演示中改流程图」再上 B。

### 6.5 资源与 i18n

- 图：PNG → LVGL 资源（C 数组或 FS 路径宏）  
- 字：调用开源 `lv_font_conv`  
- i18n：V1 键值表；V2 可做 XLIFF 导入导出（对标 EEZ 工程化能力）

---

## 7. 与「直接用 EEZ」对照

| 维度 | 用官方 EEZ | 本方案仿制 |
|------|------------|------------|
| 上市速度 | 立刻 | 数人月起 |
| 许可 | 应用 GPL-3.0；生成物另有说明 | 可自定（建议宽松） |
| 格式掌控 | `.eez-project` | 自有 JSON |
| 功能广度 | UI+Flow+仪器+多类型 | **故意变窄、变可控** |
| Wasm/Flow | 现成 | 自建成本高，可分期 |
| 品牌与支持 | Envox 社区 / 付费支持 | 自建 |
| 适合 | 内部提效、可接受 GPL | 要做自有产品/SDK 捆绑工具 |

**混合策略（务实）：** 团队内部设计阶段用 EEZ 出原型；量产工具链用自研 CodeGen+自有格式——**中间用人工/脚本迁移，不做 L4 兼容承诺。**

---

## 8. 风险与验收

### 8.1 主要风险

| 风险 | 缓解 |
|------|------|
| 范围膨胀到仪器/BB3 | 章程写死；Instrument 另册 |
| 先做 Wasm/Flow 导致无生成物 | 门禁：无 CLI SDL 通关不开始设计器美化 |
| 预览与导出行为不一致 | 单一 Schema + 黄金用例双跑（SDL 截图 / 生成代码编译） |
| GPL / 官方 Wasm 误用 | 法务评审；自研 runtime 或不做 Wasm |
| LVGL 版本追赶 | 产品只承诺 1～2 个版本；变更发迁移说明 |
| 与 Beken 仿制重复建设 | 共享 Core 库，EEZ 方案只加「预览/逻辑」插件 |

### 8.2 MVP 验收清单

- [ ] 自有 JSON Hello 工程可 `validate`  
- [ ] `generate` 产出可编译 C，`user/` 再生成不丢  
- [ ] 一键 SDL 预览可点击切页  
- [ ] 设计器可编辑并写回 JSON  
- [ ] 文档：板端 10 步内接入 `ui_init()`  
- [ ] 无官方 `.eez-project` / EEZ 商标依赖  

### 8.3 V1+（Wasm）额外验收

- [ ] 自研 Wasm 包由 CI 产出，版本字段匹配  
- [ ] 同一 JSON 在 SDL 与 Wasm 下关键布局一致（允许 antialias 级差）  
- [ ] 不包含官方 `lvgl_runtime_v*` 闭源再分发问题  

---

## 9. 目录与仓库建议

```text
forge-eez-ui/                 # 名可换
  packages/
    schema/                   # JSON Schema + 类型
    codegen/                  # CLI generate
    preview-sdl/              # PreviewPort A
    preview-wasm/             # PreviewPort B（可选）
    designer/                 # Electron/Vue 应用
  examples/hello/
  templates/boards/
  docs/board-integration.md
```

与 Beken/SquareLine 仿制若同组织：**抽 `schema` + `codegen` + `preview-sdl` 为共享包**，本产品只保留 designer 皮肤与可选 wasm/logic 插件。

---

## 10. 总结论

1. **仿制 EEZ 的 UI 工具 = 仿「开源 LVGL 设计器 + 真预览 +（可选）逻辑可视化」**，不是仿「仪器 IDE 全家桶」。  
2. **底座仍是 Schema → CodeGen → 真 LVGL 预览**；Wasm 与 Flow 是加分项，不是 MVP 前提。  
3. **格式自有、许可自控**；需要现成能力时优先 **直接使用官方 EEZ**，而不是 Fork 换皮。  
4. 与仓库内其它仿制方案关系：和 SquareLine/Beken **共享内核**；EEZ 方案增量在 **预览体验（Wasm）与逻辑图**。  
5. 成功标准：同套自有工程在 **设计器 / SDL（或 Wasm）/ 板端** 可点选运行，且不依赖 `.eez-project` 与官方 runtime 二进制。

---

## 11. 参考资料

1. `EEZ Studio/EEZ_Studio分析文档.md`  
2. `EEZ Studio/eez studio信息.txt`  
3. `EEZ Studio/studio-master/`（`README.md`、`packages/project-editor/lvgl/`、`flow/runtime/wasm/`、`build/`）  
4. https://www.envox.eu/studio/studio-introduction/  
5. https://github.com/eez-open/studio  
6. https://www.envox.eu/eez-studio-docs/8-projects-general-options/  
7. Renesas RZ/G：Develop LVGL GUI using EEZ Studio  
8. Seeed：Work with EEZ Studio  
9. 体例参考：`quareline/SquareLine_Studio_仿制方案.md`、`beken/BEKEN_LVGL_UI_Designer实现原理与仿制方案.md`、`lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`  
10. `report/嵌入式UI工具_竞品对比分析报告.md`  

---

*本方案为技术架构设计，不构成对 Envox / EEZ 的授权或工程兼容承诺；GPL、商标与生成物许可以官方为准。实施前请结合目标芯片、团队栈与法务要求裁剪。*
