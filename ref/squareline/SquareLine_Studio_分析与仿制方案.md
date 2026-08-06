# SquareLine Studio：分析与仿制方案

> 综合 `SquareLine_Studio分析文档.md`、`SquareLine_Studio_仿制方案.md`、`quareline/squareline信息.txt`、本地安装包 **1.6.1** 与示例 `example1`，以及官网、docs.squareline.io 与社区公开资料。  
> 对象：**SquareLine Studio**（面向 **LVGL** 的商业可视化 UI 设计与代码导出工具）。  
> 结构：**上篇分析**（定位 / 原理 / 功能 / 优劣）+ **下篇仿制**（合规 / 目标 / 分期 / 落地）。  
> **仿制约定：** 能力对齐、**格式自有**；不兼容官方 `.spj`；不搬运安装包闭源二进制。  
> 竞品逆向 + 兼容重构设计说明：[`SquareLine_Studio_竞品逆向与重构设计说明.md`](./SquareLine_Studio_竞品逆向与重构设计说明.md)。

---

# 上篇：工具分析

## 1. 产品定位

SquareLine Studio 是独立公司推出的 **跨平台（Windows / macOS / Linux）嵌入式 GUI 可视化 IDE**：桌面拖拽设计 → 导出 **平台无关的 LVGL C 或 MicroPython** → 编入任意厂商 MCU/MPU 工程。

官网要点（https://squareline.io/）：All in one；Vendor agnostic；**Play** 即时预览；Components；个人免费（有限额）+ 企业订阅。官网声明与 LVGL **无官方隶属关系**。

| 项 | 内容 |
|----|------|
| 官网 / 文档 | https://squareline.io/ ；http://docs.squareline.io/ |
| 本地 | Setup **1.6.1**；`example1`（LVGL **8.3.11**，800×480，SDL PC 板型） |
| 图形库 | 开源 **LVGL**（板上无 SquareLine 运行时） |
| 商业 | Personal / Business / Enterprise；另有 Trial |
| 同赛道 | Beken Designer、UIBuilder、GUI Guider |
| 不同赛道 | Persim / FlyThings（应用包 + 专有宿主） |

一句话：

> **JSON 系工程（`.spj` 等）→ Play 预览 → 导出 `ui_*.c` / MicroPython → 任意 LVGL port 上 `ui_init()`。**

---

## 2. 实现原理

### 2.1 一句话与易混点

> **设计期编辑工程 JSON；导出期产出标准 LVGL 源码；运行期就是普通 LVGL 应用。**

- 不是 Vue/画布编译进固件；权威数据在工程文件。  
- 不是板上解释 `.spj`；量产只认导出的 C/MP。  
- Play 很快，真机色深/驱动仍需板级验收。

### 2.2 总体架构

```text
SquareLine Studio（闭源桌面 IDE）
  画布 / Hierarchy / Inspector / Events / Font / Assets / Play
        │ .spj + .sll + .slp + Themes.slt + assets/components
        ▼
Export UI Files  （可选 Create Template Project）
        │
        ▼
ui.c/h、ui_Screen*.c、ui_helpers.*、ui_events.*（或 ui.py…）
        ├─► 任意 LVGL 工程：lv_init → 驱动 → ui_init()
        └─► 板级模板骨架 + 反复只更 UI
```

### 2.3 工程与导出（本地 + 文档）

| 文件 | 作用 |
|------|------|
| `.spj` | UI 树 JSON：`guid`、`isPage`、`properties[]`（`OBJECT/*`、`SCREEN/*`） |
| `.sll` | 分辨率、板型、编辑器/LVGL 版本、导出选项 |
| `.slp` | 导出路径与 FS drive |
| `Themes.slt` | 主题 |

打开工程通常需 **`.spj` + `.sll` 同目录**。属性命名贴 LVGL，便于 CodeGen。

导出典型：`ui_init`、分屏、`ui_helpers`、**`ui_events`（Call function 骨架）**、可选 `ui_comp_hook`、CMakeLists/filelist；图/字可 SOURCE 或 FS。MicroPython 路径对称。

### 2.4 Play 与事件

- **Play**：编辑器内像素级试交互/动画/切屏，免重编整包固件。  
- 板型可含 PC+SDL；与导出后再编互补。  
- 事件：切屏、改属性、Call function → 用户区填业务，减少全量覆盖。

Studio 宿主闭源；分析以行为与产物为准。

---

## 3. 主要功能、优劣与对比

### 3.1 功能总览

| 类别 | 功能 |
|------|------|
| 工程 | 板型、分辨率/色深、LVGL 版本、备份 |
| 设计 | 多屏拖拽、Hierarchy、常用控件（非全量 LVGL） |
| Inspector | 外观、布局、滚动、状态 |
| 事件 | 触发 + 切屏/属性/Call function |
| 资源 | 图片 Assets；Font Manager 裁字符；Themes；Components |
| 预览/导出 | Play；Export C/MP；Template Project；CMake/filelist |
| 许可 | Personal 限额；Business 商用 |

工作流：建工程 → 拖控件配事件 → Play → 设导出路径 → Export → 工程里 `ui_init()`；业务写 `ui_events.*`。  
生态教程多（ESP、Waveshare、Elecrow 等），是常见 **LVGL 可视化入口**。

### 3.2 优点

标准 LVGL、厂商中立、上手快、设计开发同工程、events/hooks 边界清晰、板模板、跨桌面 OS、字体/图工具全、Personal 可试用。

### 3.3 缺点

商用订阅贵、Personal 限额紧、IDE 闭源、控件不全、生成代码维护成本、LVGL 大版本跟工具走、与官方 Pro 分流、Play≠真机、商用须核许可。

### 3.4 对比简表

| 对比项 | SquareLine | Beken | LVGL Pro | Persim |
|--------|------------|-------|----------|--------|
| 产出 | C/MP 源码 | C/MP | C 或运行时 XML | `.prc` |
| 预览 | 编辑器 Play | 本机编仿真 | Wasm/真 LVGL | simulator |
| 商业 | 订阅为主 | 宣传免费 | 分层 | 生态授权 |
| 锁定 | 弱 | 弱 | 弱 | 强 |

### 3.5 适用

适合：已选 LVGL、多板复用、接受付费或限额内评估。  
不适合：零订阅大规模商用、官方 Pro XML/Figma、JS 应用包热更、强依赖未进设计器的冷门控件。

### 3.6 分析结论

SquareLine = **闭源设计器 + JSON 工程 + Play + 导出 LVGL 源码** 的范式标杆；强在易用与中立，弱在订阅与闭源。对内：要成熟付费基准用它；要同范式控成本看 Beken/UIBuilder/EEZ 或下文仿制；要应用包勿用其架构理解 Persim。

---

# 下篇：仿制方案

## 4. 合规与目标（先锁死）

### 4.1 双锁定

| 维度 | 约定 |
|------|------|
| **能力** | 对齐主路径：多屏、Inspector、事件、资源/字体、Play、导出 C（可选 MP）、板接入 |
| **格式** | 自有 JSON；**不**承诺 `.spj/.sll/.slp` |
| **量产** | `generated/`（可覆盖）+ `user/`（不覆盖） |
| **品牌** | 自有名称 |

必须官方工程兼容 → **买 SquareLine**。禁止搬 Setup/闭源、宣传「兼容 `.spj`」。

| 诉求 | 建议 |
|------|------|
| 立刻商用 + 生态教程 | 买 SquareLine |
| 同范式、控成本、自控格式 | **本文仿制**（可复用 Beken 仿制栈） |
| 接受 Beken 形态 | 跟 Beken 方案，再补 Play/板模板 |

### 4.2 仿制目标

> **自有 JSON ↔ 设计器 ↔ CodeGen(generated/user) ↔ 真 LVGL 预览 ↔ 任意 LVGL SDK。**

MVP：**拖两页 → 切屏 + Call function → 生成 C → SDL 可点选 → 板上 `ui_init()`。**

### 4.3 能力对齐（摘要）

| 原厂 | 仿制 | 不要 |
|------|------|------|
| `.spj` 树 | `project.json` + `screens/*.json` | 兼容 `.spj` |
| Hierarchy/Inspector/Events | Vue 五区 + 事件表 CodeGen | 抄皮肤；照搬 `strtype` 对外格式 |
| Play | 真 LVGL+SDL（可热更） | 仅 DOM 验收 |
| Font/Assets/Themes/Components | 开源裁剪管线；V1 组件/主题 | 搬闭源工具 |
| Export C/MP、Template、CMake | MVP 出 C；V1 模板+可选 MP | 文件名误导兼容 |

分期：MVP 控工程/设计/事件/图/Play/导出 C；V1 字体/模板/CLI/MP；V2 动画/i18n/多板/可选 Figma。

---

## 5. 目标架构与工程格式

```text
Designer（Electron/Tauri + Vue3）
    → 自有 JSON
    → CodeGen → generated/ + user/ui_events.c + CMake/filelist
         ├─ Preview：LVGL+SDL（Play）
         └─ 板端：lv_init → 驱动 → ui_init()
```

```text
MyUi/
  project.json          # resolution, color_depth, lvgl_version, board
  screens/*.json        # type,id,frame,props,style,events,children
  components/ assets/
  generated/            # 可清
  user/                 # 不清
```

节点字段贴 LVGL 概念，**方言不同于** `GUID` + `OBJECT/...`，避免被当成兼容层。控件用注册表扩展。

---

## 6. 分期与工作拆分

| 阶段 | 内容 |
|------|------|
| **MVP** | Schema；8～12 控件；切屏+Call function；CodeGen；真 LVGL 预览；设计器五区；上板文档 |
| **V1** | 字体裁剪；SOURCE/FS；1～2 板模板；Components/主题；CLI；可选 MP |
| **V2** | 动画/i18n/多板；可选 Figma→自有 JSON、MCP |

**永不做：** `.spj` 兼容承诺；搬安装包。

| 序号 | 工作包 | 周期 | 交付 |
|------|--------|------|------|
| 0 | 合规+对照清单 | 2～3 天 | 决策 |
| 1 | Schema+Hello | 3～5 天 | 可校验 |
| 2 | CodeGen CLI | 1～2 周 | generated/user+cmake；**先打通** |
| 3 | LVGL+SDL 预览 | 1～2 周 | Play 可调 |
| 4 | 设计器 | 1.5～2.5 月 | 拖完即生成+预览 |
| 5 | 板文档+最小模板 | 1～2 周 | 上板 |
| 6～7 | V1 / V2 | 按需 | 见分期 |

顺序：**1→2→3，再 4**。相对 Beken，把预览体验抬到接近 Play。  
MVP **4～7 人月**；主功能密度约 **12～18 人月**。已有 Beken 仿制库则可复用内核，重点做 Inspector/Play/导出习惯。

---

## 7. CodeGen / 预览 / 设计器 / 上板

**CodeGen：** Handlebars 等 → `ui*.c`、helpers、图字；`user/ui_events.c` 不覆盖；可选 hook；锁 `lvgl_version`。  

**Play：** MVP 生成后编译运行；V1 常驻 sim 热替换；Wasm 可选。**强制真 LVGL 验收。**  

**设计器：** Electron/Tauri + Vue3 + Pinia；DOM 画布近似；接 CLI。顺序：读写→渲染→拖属性→树/撤销→生成预览→事件资源。  

**上板文档：** 色深对齐；加入 generated 源；`lv_init`→驱动→`ui_init()`；业务只改 `user/`。

```text
squareline-like/
  schema/ codegen/ preview-sdl/ designer/
  templates/boards/ examples/hello/
```

---

## 8. 验收、风险与总结

### 8.1 验收

**MVP：** 设计器双页；切屏+Call function；真预览；user 不丢；CMake 可跑；非 `.spj`。  
**V1：** 字体裁剪；≥1 模板；CLI。  
**V2：** Components/动画/i18n/Figma 至少一项过关。

### 8.2 风险

画布≠LVGL → 强制 Play；要 `.spj` 兼容 → 拒绝；控件爆炸 → 注册表+控 MVP 范围；与 Beken 重复 → 共享内核；许可遵守 LVGL MIT、勿搬 SquareLine；差异化用「可私有化/无商业控件限额」而非抄定价。

### 8.3 总结论

| 维度 | 结论 |
|------|------|
| 原厂本质 | 闭源设计器 + JSON 工程 + Play + 导出 LVGL C/MP |
| 卖点兑现 | **快（Play）+ 中立（任意板）+ 完整导出** |
| 仿制抓手 | Schema → CodeGen(generated/user) → 真 LVGL 预览 → Designer → 板模板 |
| 合规 | 能力对齐、格式自有；不兼容 `.spj` |
| 成功标准 | 同套代码在预览与板端可点选，user 可迭代 |

---

## 9. 参考资料

1. `quareline/squareline信息.txt`、`SquareLine_Studio分析文档.md`、`SquareLine_Studio_仿制方案.md`（本文为其综合稿）  
2. `quareline/example1/`、`SquareLine_Studio_Windows_v1_6_1/`  
3. https://squareline.io/ ；http://docs.squareline.io/docs/1.5.2/introduction/typical_dev/  
4. 社区/板卡教程；许可与价格以官网为准  
5. 同仓库：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`；`lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`  

---

*综合稿以本地 1.6.1 样本与公开资料为准；商标与许可以 SquareLine 官网为准。*
