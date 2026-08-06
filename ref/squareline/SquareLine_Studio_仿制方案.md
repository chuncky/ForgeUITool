# SquareLine Studio 仿制方案

> 依据：`quareline/SquareLine_Studio分析文档.md`、`quareline/squareline信息.txt`、本地 **1.6.1** 安装包与 `example1`（`.spj`/`.sll`/`.slp`），以及官网、docs.squareline.io 与社区公开资料。  
> 对象：SquareLine 所代表的 **「可视化设计 → 导出 LVGL C/MicroPython → 任意板级 LVGL 工程」** 范式。  
> **仿的是能力与架构，不是品牌、安装包、闭源预览器，也默认不兼容官方 `.spj` 工程格式。**  
> 与分析合并的综合稿（推荐）：[`SquareLine_Studio_分析与仿制方案.md`](./SquareLine_Studio_分析与仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`SquareLine_Studio_竞品逆向与重构设计说明.md`](./SquareLine_Studio_竞品逆向与重构设计说明.md)。

---

## 0. 路线与合规（先锁死）

### 0.1 原厂范式一句话

> **桌面设计器编辑 JSON 系工程 → Play 即时预览 → 导出标准 LVGL C/MP（`ui_init` + 分屏 + helpers + events 骨架）→ 接入已有 LVGL port。**

与 Persim（`.prc` + 专有宿主）不同；与 Beken / UIBuilder **同赛道**。仿制可大量复用「Schema → CodeGen → SDL 仿真 → 设计器」方法论，对标 SquareLine 的体验密度（Play、板模板、Components、字体裁剪等）。

### 0.2 双锁定

| 维度 | 约定 |
|------|------|
| **能力** | 对齐 SquareLine 公开主路径：多屏设计、Inspector、事件、资源/字体、Play/仿真、导出 C（可选 MP）、板级接入文档 |
| **格式** | **自有 JSON Schema**；**不**承诺读写官方 `.spj` / `.sll` / `.slp` |
| **量产** | 导出标准 LVGL C：`generated/`（可覆盖）+ `user/` 或 `ui_events` 等价区（不覆盖） |
| **品牌** | 自有产品名；勿冒充 SquareLine |

若必须官方工程兼容 + 官方支持 → **购买 SquareLine**。本方案是「功能对齐、格式自有」。

### 0.3 禁止事项

- 反编译 / 重打包 `SquareLine_Studio_*_Setup.exe` 及安装目录闭源二进制用于商业发行  
- 对外宣传「兼容 SquareLine 工程一键打开」作为产品承诺  
- 抄袭官方品牌资源、板级模板商标包  

### 0.4 与买 SquareLine / 仿 Beken 的选型

| 诉求 | 建议 |
|------|------|
| 立刻商用、要成熟生态与板教程 | **买 SquareLine** |
| 要同范式、控订阅成本、自控格式 | **本文仿制**（可对标 Beken 已有仿制经验加速） |
| 只要免费 LVGL 设计器且接受 Beken 形态 | 可直接跟 Beken 仿制方案，再补 Play/板模板体验 |

---

## 1. 仿制目标

### 1.1 目标表述

> **自有 JSON 工程 ↔ 可视化设计器 ↔ 模板 CodeGen（generated/user 隔离）↔ 真 LVGL 预览（Play/SDL）↔ 导出进任意 LVGL SDK。**

MVP 必须打通：**拖两页 → 配点击切页与 Call function → 一键生成 C → PC SDL 可点选 → 板端最小工程调用 `ui_init()`。**

### 1.2 能力对齐表（对标 SquareLine，落点自有）

| SquareLine 公开能力 | 仿制对齐方式 | 不要 |
|---------------------|--------------|------|
| `.spj` 对象树 + `.sll` 元数据 | 自有 `project.json` + `screens/*.json`（或单文件） | 兼容官方 `.spj` |
| Hierarchy + 拖拽控件 | Vue 设计器：树 + 画布 + 控件库 | 抄官方 UI 皮肤资源 |
| Inspector 属性/样式/状态 | 属性表单写回 Schema；字段贴 LVGL 概念 | 照搬官方 `strtype` 字符串表作为对外格式 |
| Events（切屏、改属性、Call function） | 事件表 CodeGen；`user/ui_events.c` 骨架 | — |
| Play 即时预览 | **优先真 LVGL**：进程内 SDL 或生成后热加载；DOM 仅设计期近似 | 仅 DOM 验收 |
| Font Manager（TTF 裁字符） | 调用开源 lv_font_conv / 自研裁剪管线 | 搬官方字体工具闭源 |
| Assets / 图片 SOURCE 或 FS | 导出 C 数组或路径宏；可配 | — |
| Themes / Components | V1：主题色；V1～V2：组件库 | — |
| Export C / MicroPython | MVP：C；V1：可选 MP | 导出文件名故意撞车误导 |
| Create Template Project | V1：1～2 个板级模板（SDL + 一款 MCU） | 复制厂商商标板包 |
| CMakeLists / filelist | CodeGen 附带 | — |
| 多平台 IDE（Win/Mac/Linux） | Electron/Tauri；MVP 可先 Windows | — |
| Personal 限额商业模式 | 自定授权；技术上可不设控件上限 | 复制其计费文案 |

### 1.3 原厂功能面 → 分期落点

| 类别 | 原厂能力 | 分期 |
|------|----------|------|
| 工程 | 板型、分辨率、色深、LVGL 版本、备份 | MVP 基础；备份 V1 |
| 设计 | 多屏、常用控件、布局/滚动/样式 | MVP 8～12 控件 |
| 事件 | 切屏、Call function | MVP |
| 资源 | 图、字体裁剪 | MVP 图；字体裁剪 V1 |
| 预览 | Play | MVP（真 LVGL） |
| 导出 | C + helpers + events | MVP |
| 模板工程 | Create Template | V1 |
| 组件/主题/MP/i18n | Components、Themes、MP、多语言 | V1～V2 |

---

## 2. 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  Designer（Electron / Tauri + Vue3 推荐）                      │
│  画布(DOM近似) / 树 / Inspector / 事件 / 资源 / Play 入口      │
└──────────────────────────────┬───────────────────────────────┘
                               │ 自有 JSON 工程
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  CodeGen CLI（Handlebars / Jinja 等）                          │
│  generated/  ui.c ui_Screen*.c ui_helpers.*  图片字体          │
│  user/       ui_events.c（再生成不覆盖）                        │
│  CMakeLists.txt / filelist.txt                                 │
└───────────────┬────────────────────────────┬─────────────────┘
                ▼                            ▼
     Preview：LVGL+SDL（Play）         板端：任意 LVGL port
     生成→编译→窗口 或 常驻 sim 热更     include 后 ui_init()
```

与原厂概念映射（仅理解用）：

| 原厂 | 仿制 |
|------|------|
| `.spj` | 自有 screens JSON |
| Play | `ui-preview`（真 LVGL） |
| Export UI Files | `ui-codegen` |
| `ui_events.c` | `user/ui_events.c` |
| Create Template Project | `templates/boards/*` |

---

## 3. 自有工程格式（建议）

刻意 **不同于** `.spj` 的 `GUID` + `strtype: OBJECT/...` 方言，避免被当成兼容层：

```text
MyUi/
  project.json          # name, resolution, color_depth, lvgl_version, board
  screens/
    screen_home.json    # id, children[], style, events
  components/           # 可选复用组件
  assets/images|fonts/
  generated/            # CodeGen 输出（可清）
  user/                 # 手写业务（不清）
```

`screen_*.json` 节点建议字段：`type`、`id`、`name`、`frame`、`props`、`style`、`states`、`events`、`children`。  
类型枚举对齐 LVGL 常用控件（button/label/image/slider/…），用 **注册表** 扩展。

---

## 4. 分期计划

### 4.1 MVP（可上板）

- Schema + Hello 双屏示例  
- 8～12 控件；切屏 + Call function  
- CodeGen → C + `user/ui_events.c` + cmake/filelist  
- 真 LVGL + SDL 一键预览（对齐 Play 体验）  
- 设计器五区：库 / 画布 / 树 / 属性 / 导出·预览  
- 板端最小接入文档（`ui_init`）  
- **不做：** `.spj` 兼容、MP、完整字体裁剪、多板模板、Components 商城  

### 4.2 V1

- 字体裁剪管线；图片 SOURCE/FS 双模式  
- 1～2 个 Template Project（SDL PC + 一款目标 MCU）  
- 简单 Components；主题色  
- CLI：`validate | generate | preview`  
- 可选 MicroPython 导出  

### 4.3 V2

- 更全控件与动画时间线；i18n；多板模板库  
- 可选 Figma→自有 JSON（对标「设计稿进工具」，非 SquareLine 专有能力也可做差异化）  
- 可选 MCP/AI 改工程 JSON  

**永不做：** 官方 `.spj` 兼容承诺；搬安装包闭源。

---

## 5. 工作拆分（按顺序）

| 序号 | 工作包 | 周期参考 | 交付 |
|------|--------|----------|------|
| **0** | 合规 + 能力对照清单 | 2～3 天 | 决策纪要 |
| **1** | JSON Schema + 示例工程 | 3～5 天 | 可校验 Hello |
| **2** | CodeGen CLI | 1～2 周 | JSON→generated/user + cmake；**优先打通** |
| **3** | PC 预览（LVGL+SDL） | 1～2 周 | generate→编译→窗口；Play 按钮可调 |
| **4** | 设计器 UI | 1.5～2.5 月 | 拖完即可生成+预览 |
| **5** | 板级文档 + 最小模板 | 1～2 周 | 上板跑同套代码 |
| **6** | V1 增强 | 1～2 月 | 字体、模板、CLI、可选 MP |
| **7** | V2 产品化 | 按需 | 动画/i18n/多板/Figma |

**原则：0→1→2→3，再 4。** 与 Beken 仿制顺序一致；SquareLine 差异点是把「预览体验」提高到接近 **Play**（真 LVGL，尽量短反馈）。

人员：嵌入式（CodeGen/仿真/模板）+ 前端（设计器）+ 中间层（Schema）。  
MVP 约 **4～7 人月**；接近 SquareLine 主功能密度约 **12～18 人月**（不含 Figma/AI）。

若团队已有 Beken 仿制代码库：可 **直接复用 Schema/CodeGen/SDL**，把工期重点放在 Inspector 体验、Play 热路径与导出目录结构对齐 SquareLine 用户习惯。

---

## 6. CodeGen / 预览 / 设计器怎么做

### 6.1 CodeGen（工作包 2）

| 项 | 建议 |
|----|------|
| 模板引擎 | Handlebars / Jinja2 / CTemplate |
| 输出 | `ui.c/h`、`ui_Screen_*.c`、`ui_helpers.*`、图片/字体 |
| 用户区 | `user/ui_events.c`：**Call function** 空实现；再生成不覆盖 |
| 钩子 | 可选 `user/ui_comp_hook.c`（对齐组件定制） |
| 构建 | `CMakeLists.txt` + `filelist.txt` |
| LVGL 版本 | 工程字段锁定（对标 `.sll` 的 `lvgl_version`）；与仿真一致 |

验收：对 Hello JSON 生成的工程，在无设计器情况下仅用 CLI 即可 SDL 跑通。

### 6.2 预览 Play（工作包 3）

| 方案 | 说明 | 推荐 |
|------|------|------|
| A. 生成后 cmake 编译运行 | 实现简单，反馈秒～十秒级 | MVP 可用 |
| B. 常驻 sim + 热替换 generated | 更接近「不重编整固件」体感 | V1 优化 |
| C. Wasm 真 LVGL | 对齐 Pro 路线，成本高 | 可选 |

**强制：** 验收以真 LVGL 为准；DOM 画布只做编辑辅助。

### 6.3 设计器（工作包 4）

| 用途 | 推荐 |
|------|------|
| 壳 | Electron（electron-vite）或 Tauri 2 |
| 前端 | Vue 3 + TS + Element Plus |
| 状态 | Pinia 持有工程 JSON |
| 画布 | DOM 绝对定位 + 拖拽（不必强上 Konva） |
| 撤销 | 深拷贝历史栈 |
| 调 CLI | child_process / Tauri Command |

模块：工程管理、控件库（注册表）、画布、树、Inspector、事件编辑、资源、「生成」「预览」按钮。  

内部顺序：读写工程 → 只读渲染 → 拖+属性 → 树/撤销 → 接 CodeGen/预览 → 事件/资源。

### 6.4 目录建议

```text
squareline-like/
  schema/
  codegen/                 # 工作 2
  preview-sdl/             # 工作 3
  designer/                # 工作 4
  templates/boards/        # V1
  examples/hello/
用户工程/
  project.json / screens / assets / generated / user
```

---

## 7. 板端集成（工作包 5）

文档最少包含：

1. LVGL 与色深/`LV_COLOR_16_SWAP` 与工程设置对齐  
2. `add_subdirectory(ui)` 或加入 `filelist.txt` 中的源  
3. 启动序：`lv_init` → display/indev → **`ui_init()`** → `lv_timer_handler`  
4. 业务只改 `user/`，勿改 `generated/`  

可选提供 SDL 与一款 MCU（如 ESP-IDF）模板，对标 Create Template Project 的价值，而不是抄官方板包。

---

## 8. 验收标准

### MVP

1. 不手写 JSON，设计器拖出双页：背景/图/字/按钮  
2. 配置切屏 + Call function；生成后 `user/ui_events.c` 可填计数改 Label  
3. 一键真 LVGL 预览正确  
4. 再改样式重新生成后 **user 不丢**  
5. 同套 `generated+user` 可进最小 CMake+LVGL 工程上板或仿真  
6. 工程格式 **不是** 官方 `.spj` 魔数/方言  

### V1

字体裁剪可用；至少一种 Template Project；CLI 三件套可用。

### V2

Components 或动画或 i18n 或 Figma 导入至少一项主路径通过。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| 画布≠真 LVGL | Play/仿真强制验收 |
| 被要求兼容 `.spj` | 拒绝产品承诺；最多内部单向实验导入 |
| 低估 CodeGen 控件矩阵 | 注册表扩展；MVP 控控件数量 |
| 与 Beken 仿制品重复建设 | 共享内核，差异做在体验与导出布局 |
| 许可 | LVGL MIT；自有工具闭源/开源自定；勿搬 SquareLine 二进制 |
| 订阅市场预期 | 用「无控件商业限额 / 可私有化」做差异化，而非抄定价文案 |

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 原厂本质 | 闭源设计器 + JSON 工程 + Play + 导出 LVGL C/MP |
| 仿制抓手 | **自有 Schema → CodeGen(generated/user) → 真 LVGL 预览 → Designer → 板模板** |
| 合规 | 能力对齐、格式自有；不兼容 `.spj`；不搬安装包 |
| 加速路径 | 复用 Beken 类仿制栈，补齐 Play 体验与导出结构习惯 |
| 成功标准 | 同套生成代码在预览与板端可点选运行，user 区可迭代 |

公开材料里 SquareLine 的核心卖点是 **快（Play）+ 中立（任意 LVGL 板）+ 完整导出**。仿制应用工程闭环兑现这三点，而不是复刻品牌与 `.spj`。

---

## 11. 参考资料

1. `quareline/squareline信息.txt`  
2. `quareline/SquareLine_Studio分析文档.md`  
3. `quareline/example1/`、`SquareLine_Studio_Windows_v1_6_1/`  
4. https://squareline.io/  
5. http://docs.squareline.io/docs/1.5.2/introduction/typical_dev/  
6. 同仓库可参考：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`（同赛道落地顺序）  
7. `lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`（格式自有、能力对齐体例）  

---

*本方案为技术规划；SquareLine 商标与许可条款以官方为准。*
