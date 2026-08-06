# 博通集成 BEKEN LVGL UI Designer 分析文档

> 基于 `beken/博通集成ui工具.txt`、本地工具包 `lvgl_ui_designer_2.0.3`、官方 GitHub 文档及公开介绍整理。  
> 分析对象：**BEKEN LVGL UI Designer**（博通集成面向 LVGL 的可视化 UI 设计工具）。  
> 说明：公司名为「博通集成 / Beken」，与芯片厂商 Broadcom「博通」不是同一家。

---

## 1. 产品定位

BEKEN LVGL UI Designer 是博通集成推出的 **嵌入式 UI 可视化设计工具**，底层图形库为开源 **LVGL**（文档/仿真侧可见适配 **LVGL 9.3**）。定位接近 SquareLine Studio、NXP GUI Guider：在 PC 上拖拽设计界面，再 **生成标准 LVGL 代码**，接入芯片 SDK 或本机仿真运行。

官方宣传要点（B 站介绍等）：

- 对标 SquareLine / GUI Guider 主流能力，强调 **完全免费、无订阅**  
- 绿色免安装，解压即用  
- 一键生成标准代码；支持 Flex、仿真、30+ 组件、云资源、自定义组件/颜色库等  

版本线索：本地工具包为 **2.0.3**；GitHub 文档仓库持续更新功能与发行说明。

| 项 | 内容 |
|----|------|
| 下载 | https://dl.bekencorp.com/tools/lvgl_ui_designer |
| 文档 | https://docs.bekencorp.com/.../lvgl_ui_designer/（及镜像文档站） |
| 仓库 | https://github.com/bekencorp/lvgl_ui_designer |
| 运行环境 | **Windows** |
| 许可证（仓库声明） | MIT（文档/示例仓库侧；工具本体为 Electron 发行包） |

---

## 2. 实现原理

### 2.1 总体架构

与「闭源 GUI 运行时 + 专有 UI 文件上板解释」不同，该工具走的是典型的 **设计器 → 导出 LVGL 源码 → 编译链接** 路线：

```text
┌────────────────────────────────────────────────────────────┐
│  BEKEN LVGL UI Designer（Electron 桌面应用）                 │
│  画布 / 组件库 / 组件树 / 属性 / 事件 / 资源 / AI(MCP)       │
└───────────────────────────┬────────────────────────────────┘
                            │ 读写 .bkprj（JSON 工程文档）
                            ▼
┌────────────────────────────────────────────────────────────┐
│  CodeGen（Handlebars 模板 .hbs → C / MicroPython）          │
│  beken_generated/ + custom/（用户区不覆盖）                  │
│  beken_generated.cmake                                      │
└───────────────┬────────────────────────────┬───────────────┘
                │                            │
                ▼                            ▼
     PC 仿真（SDL + LVGL）            板端 / SDK 工程
     lv_port_pc_simulate              include 生成源码后交叉编译
     + 内置 w64devkit 等工具链
```

一句话：

> **设计期编辑 JSON 工程；生成期产出可读的 LVGL 创建/样式/事件代码；运行期就是普通 LVGL 应用（仿真或芯片上的 LVGL port）。**

### 2.2 IDE 宿主技术形态

本地 `lvgl_ui_designer_2.0.3` 目录特征：

- `LVGL-UI-Designer.exe` + `*.pak` / `libEGL.dll` / `LICENSE.electron.txt`  
→ 基于 **Electron** 的 Windows 桌面程序（Chromium + Node）。  

资源目录中可见：

- `resources/app.asar`：主应用逻辑  
- `resources/templates/`：代码生成模板（Handlebars `.hbs`）  
- `resources/lv_port_pc_simulate/`：PC 端 LVGL + SDL 仿真工程  
- `resources/tools/win/w64devkit/`：本机编译仿真用的工具链  
- `resources/mcp/`、`resources/ai-skill/`：AI 设计 MCP/Skill  
- `resources/examples/`、`templates/`、`themes/`：示例与主题  

即：**前端可视化用 Web 技术栈实现；后端用本地 Node/Electron 能力做工程、生成、调编译器。**

### 2.3 工程文档模型：`.bkprj`

示例 `simple_ui.bkprj` 为 **明文 JSON**，核心结构大致为：

```text
.bkprj
├── name / resolution / lvglVersion（如 "9.3"）
├── project.settings（主题、网格、背景色…）
├── project.pages[]
│     ├── wid / name / type: "page"
│     ├── components[]（控件树节点）
│     │     ├── type（image/label/button/…）
│     │     ├── name / wid
│     │     ├── properties[]（x,y,width,height,text,flags…）
│     │     ├── style.parts[].states[].styles[]（对齐 LVGL part/state）
│     │     ├── children[]
│     │     ├── layout（parent,zIndex,lock,visible）
│     │     └── events[]
│     └── page 级 style
└── componentLibraries[]（自定义组件库）
```

设计器工作方式：

1. 组件库拖入/点击 → 往当前 page 的组件树插入节点  
2. 属性面板改 `properties` / `style` → 更新 JSON 并刷新画布  
3. 组件树管理页面与层级（嵌套上限文档/发行说明中曾提到约 4～5 层，后续版本持续放开复杂控件子树）  
4. 事件编辑器写入 `events`（触发类型 + 动作：跳转/改属性/改样式/调函数/自定义代码等）  

**所见即所得** = Electron 内对同一 JSON 模型的渲染预览（设计期）；**真机一致性**主要靠生成标准 `lv_*` API，由 LVGL 在仿真/板端再渲染一次。

### 2.4 代码生成原理

生成链路（从模板与发行说明可确认）：

1. 读取 `.bkprj` 中的 pages/components/styles/events/资源  
2. 用 **Handlebars** 模板（如 `beken_ui.h.hbs` / `beken_ui.c.hbs` 及各控件 partial）展开  
3. 输出到工程下的生成目录（可配置 `beken_generated` 导出位置）  
4. 附带 `beken_generated.cmake`，便于 CMake 工程 `include` 全部生成 `.c`  

生成代码特征：

- 全局 UI 句柄结构体（模板中为 `bk_lv_ui_t`，成员为各 `lv_obj_t *`）  
- 每页 `init_page_xxx` / `destroy_page_xxx`  
- 入口 `beken_ui_init()`：初始化 i18n（若开启）→ `init_page_启动页` → `lv_screen_load(...)`  
- 图片 `LV_IMAGE_DECLARE`、字体 `LV_FONT_DECLARE`  
- 事件落地为 LVGL 事件回调或页面切换动画相关调用  

**用户业务隔离：**

- `custom/` 目录：重新生成 **不覆盖**；`custom_func.c/.h` 放此处  
- 「生成代码」与「全部清理」分离：避免每次生成冲掉手写逻辑（1.1.4 起明确修复过覆盖问题）  
- 页面属性/事件动作中可插入自定义代码片段  

因此它更接近 SquareLine 的 **「导出源码」** 模型，而不是 FlyThings 的 **「板上解释 UI 文档 + so 插件」** 模型。

### 2.5 PC 仿真 / 预览原理

工具栏提供：

- **C 语言**：全部清理 / 生成代码 / 编译 / 运行（可组合）  
- **MicroPython**：生成代码 / 运行  

C 仿真路径：

```text
生成 beken_ui + 资源
    → 拷贝/使用 lv_port_pc_simulate（LVGL + SDL HAL）
    → 内置工具链编译
    → 运行窗口；main 中 lv_init → sdl_hal_init → beken_ui_init → lv_timer_handler 循环
```

日志在终端输出，用户可在自定义代码里 `printf`。  
版本升级时常见注意：需删除工程内旧 `lv_port_pc_simulate` 再重新生成，避免模板/目录变更导致编译失败。

### 2.6 事件与页面导航

事件不是「只生成空回调等你填」，设计器内可配置：

| 触发（示例） | 动作（示例） |
|--------------|--------------|
| CLICKED / LONG_PRESSED / VALUE_CHANGED / Gesture / Key… | 页面跳转（含动画类型与时长） |
| | 修改属性 / 修改样式 |
| | 调用自定义函数名 |
| | 自定义代码；触发时间轴动画 |

画布可显示 **事件连线**，便于查看跳转与改属性目标关系。  
多页面由组件树管理；可设启动页；预览时先显示启动页。

这与 Android Activity 栈无关，本质是 **LVGL screen/page 切换 + 事件动作表驱动代码生成**。

### 2.7 AI 设计原理（2.x）

2.0 起支持通过 **Cursor / Codex / TRAE / TRAE CN** 自然语言改 UI：

1. Designer 本地跑 **Bridge**（如 `http://127.0.0.1:39001`）  
2. 向 AI 编辑器注册 MCP：`beken_lvgl_ui_designer`（stdio，Electron 以 Node 方式跑 `lvgl-ui-designer-mcp.cjs`）  
3. 安装 Skill，指导模型如何操作页面/组件/属性  
4. AI 通过 MCP **读写当前画布模型**；用户在画布上「保存/撤销」确认  

高级能力（复杂事件链、时间轴精细调参等）文档标明可能仍需手工补全。

### 2.8 与板端 / SDK 的关系

工具本身侧重 **设计 + 代码生成 + PC 仿真**，不是完整的「编译固件 + ADB 下载」一体化芯片 IDE。

上板典型路径：

1. 生成 C 代码与资源  
2. 用 `beken_generated.cmake`（或手动加源）并入 Beken SDK / 自有 LVGL 工程  
3. 板端提供 LVGL display/indev port、文件系统（图片可配外部 SD 等）  
4. 在应用启动时调用 `beken_ui_init()`（或等价入口）  

因此：**图形栈是开源 LVGL；工具是厂商免费设计器；芯片适配在 SDK，不在 Designer 闭源运行时里。**

---

## 3. 主要功能

依据官方 README「核心功能」、工作台文档全集、发行说明（至本地 **2.0.3**）、GitHub / docs.bekencorp.com 与公开介绍整理。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **运行环境** | Windows 绿色桌面客户端 | Electron；解压即用；免订阅（官方宣传） |
| **LVGL 版本** | 面向 LVGL **9.x**（文档/仿真侧可见 **9.3**） | 生成标准 `lv_*` API |
| **项目管理** | 多项目、新建/打开、导入导出、示例模板、云资源示例 | 工程为明文 `.bkprj`（JSON）；路径宜 ASCII、无空格 |
| **工作台布局** | 五区：工具栏、组件库、画布、组件树、属性面板 | 面板可调宽；可点选/拖拽加组件 |
| **可视化设计** | 拖拽布局；网格/标尺/参考线；缩放平移 | 设计期 **DOM 近似预览**；真效果靠仿真/板端 LVGL |
| **编辑增强** | 撤销/重做；多选对齐；锁定/隐藏；层级调整 | 右键对齐等；组件树拖拽排序 |
| **页面管理** | 多页面；复制/排序/置顶置底；启动页 | 组件树侧管理页面 |
| **组件库** | **30+** LVGL 组件；搜索；系统 + **自定义组件** | 常用：按钮/输入/滑块/列表等；高级：图表/仪表/日历等；复杂：TabView/Menu/Win 等 |
| **样式** | 完整 Part/State 样式；样式库复用；颜色库/主题 | 对齐 LVGL 样式系统；Flex 布局 |
| **事件** | 图形化事件编辑；可选连线可视化 | 触发：Clicked/长按/值变化等；动作：跳转页、改属性、改样式、调自定义函数、自定义代码、切语言（i18n 开启时）等 |
| **动画** | 时间轴动画（关键帧改属性） | 画布预览；事件触发播放 |
| **资源** | 图片（PNG；可外置 SD）、字体 TTF、**自定义字符** / FontAwesome | 自定义字符可同步工程用字以裁剪字库 |
| **多语言** | 项目开关；语言包/翻译/字体方案 | 组件启用翻译；事件可「切换语言」；检测未翻译 Key |
| **代码生成** | **C** 与 **MicroPython** 双通道 | 产出 `beken_generated/` + `custom/`（再生成不覆盖）+ `beken_generated.cmake` |
| **代码编辑** | 内置编辑器查看/改 `custom_func` 等 | Monaco；用户扩展进 `custom/` |
| **模拟仿真** | C：清理/生成/编译/运行；MP：生成/运行 | 本机 `lv_port_pc_simulate`（SDL）；日志面板/`printf` 可调试 |
| **导出设置** | 自定义 `beken_generated` 导出路径；字体抗锯齿等 | 便于对接不同 SDK 目录 |
| **存档历史** | 项目存档、历史预览、恢复版本（2.0.3） | 可对历史做 MicroPython 预览 |
| **AI 设计** | Cursor / TRAE / Codex 等 + **MCP + Skill** | 自然语言改工程 JSON（页面/属性/事件/动画/i18n 等，视版本）；用户确认保存/撤销 |

官方 README 所列「拖拽、实时预览、网格参考线、30+ 组件、自定义组件、完整样式/多状态/样式库、多项目管理与模板、AI 协同」均已落入上表；工作台文档进一步覆盖事件、i18n、动画、自定义字符、存档与工具栏预览拆分。

### 3.2 分模块要点

**（1）工程与工作台**  
首页管多项目与模板；进入五区工作台设计。工程权威数据为 `.bkprj` JSON。

**（2）设计器（核心）**  
从组件库拖入或点击添加；画布对齐与参考线；树管层级与多页；属性面板改基础属性与 Part/State 样式；可保存样式库与自定义组件。

**（3）交互与动效**  
事件：LVGL 风格触发 → 跳转（含切页动画）、改属性/样式、调函数、自定义代码、i18n 切换。时间轴动画用关键帧编排属性变化，可预览并由事件触发。

**（4）资源与国际化**  
图/字导入；自定义字符集优化字库体积；多语言文案与按语言字体方案。

**（5）生成 · 仿真 · 上板闭环**  
工具栏分 C / MicroPython：生成 →（C 再编译）→ 运行仿真。业务写在 `custom/`。上板：把生成目录并入 Beken 或其他 LVGL SDK，调用 `beken_ui_init()`（名称随生成约定），**工具本身不是烧录 IDE**。

**（6）AI（2.x）**  
经 MCP 改内存中的工程模型并刷新画布；复杂精调仍以手工为主。

### 3.3 主要特点（归纳）

- **工具形态：** Windows Electron + Vue 设计器 + 内置仿真工具链  
- **开发模型：** JSON 工程 → 标准 LVGL C/MP 源码（非解释型 UI 包）  
- **隔离模型：** `beken_generated` + `custom`  
- **差异化：** 免费无订阅、双语言导出、MCP AI、存档历史  
- **闭环叙事：** 拖拽设计 → PC 仿真 → 源码进 SDK 上板（与 SquareLine / UIBuilder 同属「设计器→源码」范式）

---


## 4. 优点

| 维度 | 说明 |
|------|------|
| **免费无订阅** | 相对 SquareLine 等商业订阅，降低团队试用与量产工具成本 |
| **标准 LVGL 输出** | 生成的是常见 `lv_obj` API 风格代码，可移植到支持 LVGL 的平台，不绑定闭源 GUI 解释器 |
| **学习曲线友好** | 拖拽 + 属性 + 事件配置即可出交互原型；示例与云资源齐全 |
| **PC 仿真闭环** | 内置仿真 port 与工具链，改 UI 后本机即可点选验证，少刷机 |
| **用户代码隔离** | `custom/` + 生成/清理策略分离，比「每次全量覆盖」更适合迭代 |
| **样式体系贴 LVGL** | Part/State/Flex 等与 LVGL 概念一致，减少「设计器一套、库一套」的认知割裂 |
| **工程文件可读** | `.bkprj` 明文 JSON，利于备份、简单 diff、脚本处理（相对压缩二进制 UI 格式） |
| **AI 辅助** | MCP 直改画布，适合搭框架、批量改布局 |
| **持续迭代** | 发行说明显示从 1.0 到 2.0.3 功能密度高（事件、i18n、动画、复杂控件、AI、存档等） |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **仅 Windows** | 官方系统要求为 Windows；无原生 macOS/Linux IDE |
| **不是完整芯片 IDE** | 设计/仿真强，固件编译、烧录、板级调试仍依赖 Beken SDK 或其他工具链，需自行集成 |
| **导出源码模型的通病** | 大项目生成代码量大；设计器与手改生成文件若边界不清仍可能冲突；需纪律只用 `custom/` |
| **版本升级摩擦** | 多次提示删除 `lv_port_pc_simulate` 再生成；旧项目要「重新导入」才吃到新特性 |
| **嵌套/复杂控件演进中** | 早期有嵌套层数、子控件支持限制；虽在放开，复杂 HMI 仍可能踩版本能力边界 |
| **路径与命名约束** | 目录 ASCII/无空格，组件名标识符规则，对既有目录习惯不友好 |
| **资源格式限制** | 图片曾长期以 PNG 为主；字体 TTF；大字符集字体生成有超时类问题（发行说明有修） |
| **AI 能力边界** | 复杂事件链、动画精调等仍需手工；依赖本机已装 Cursor/TRAE 等 |
| **生态相对垂直** | 文档与社区以 Beken QQ 群/GitHub Issue 为主；跨芯片通用性有，但厂商支持重心在自有芯片方案 |
| **Electron 体积与安全软件** | 发行包含完整 Chromium/工具链，体积大；曾提示杀毒拦截需加白名单 |

---

## 6. 与同类方案对比（简表）

| 对比项 | BEKEN LVGL UI Designer | SquareLine Studio | NXP GUI Guider | 中科世为 FlyThings IDE |
|--------|------------------------|-------------------|----------------|------------------------|
| 图形库 | LVGL（开源） | LVGL | LVGL | 自研 EasyUI（闭源） |
| 产出 | C / MicroPython 源码 | C / MicroPython | 多为 C/Python（视版本） | `.ftu` + `libzkgui.so` |
| 运行模型 | 编译进 LVGL 应用 | 同左 | 同左 | 宿主加载 so + 解释 UI |
| 商业模式 | 免费 | 订阅制为主 | 随 NXP 生态 | 绑定硬件/授权方案 |
| PC 仿真 | 有（内置） | 有 | 有 | 设计预览；下载偏 ADB |
| AI | MCP 直改画布 | 视版本 | — | 无对等公开能力 |
| 平台锁定 | 弱（LVGL 可移植） | 弱 | 偏 NXP | 强 |

对「只要 Linux/MCU 上跑 LVGL、要可视化、要少花钱」的团队，Beken 工具与 SquareLine 同赛道；对「智能串口屏专有 OS + 插件 so」则与 FlyThings 不是同一架构。

---

## 7. 适用与不适用

**较适合**

- 基于 LVGL 的嵌入式 HMI（含 Beken 芯片方案，也可用在其他已移植 LVGL 的平台）  
- 需要快速出多页面、带基础交互与仿真验证的产品 UI  
- 希望避免 UI 工具订阅费，并能把生成代码纳入自有 Git/CMake 流程  
- 想用 AI 辅助搭界面骨架  

**不太适合**

- 需要 macOS/Linux 原生设计器工作流  
- 期望「设计器一键出固件并烧录」的一站式芯片 IDE  
- 强依赖非 LVGL 图形栈，或必须专有 UI 解释格式与厂商锁定生态  
- 超复杂自定义控件/渲染管线，设计器表达力不足时仍要大量手写 LVGL  

---

## 8. 结论

博通集成 **BEKEN LVGL UI Designer** 的实现本质是：

> **Electron 可视化设计器编辑明文 `.bkprj`（JSON 控件/样式/事件树）→ Handlebars 生成标准 LVGL C/MicroPython → 本机 SDL 仿真或并入芯片 SDK 编译运行。**

它站在 **开源 LVGL 生态** 上，用免费工具降低 UI 搭建成本。

**主要功能面**覆盖：多项目与模板、五区工作台、30+ 组件与自定义组件、Part/State 样式与样式库、事件（跳转/改属性样式/调函数）、时间轴动画、图字与自定义字符、多语言、C/MicroPython 生成与 `custom/` 隔离、本机仿真、导出路径设置、存档历史，以及 2.x MCP AI 设计等。

强项是拖拽、样式/事件、仿真、用户代码隔离与 AI；弱项是 Windows 限定、上板集成需自接 SDK、导出源码工作流的固有维护成本，以及版本升级时的工程清理成本。

若团队已选定 LVGL 作为 Linux/RTOS 上的 GUI，该工具是高性价比的设计前端；若目标是专有串口屏运行时与 so 热更模型，则应另看 FlyThings 一类方案，二者原理不同。

---

## 9. 参考资料

1. 本地：`beken/博通集成ui工具.txt`  
2. 本地工具包：`beken/lvgl_ui_designer_2.0.3`（Electron 发行结构、`.bkprj` 示例、`.hbs` 模板、`lv_port_pc_simulate`）  
3. GitHub：https://github.com/bekencorp/lvgl_ui_designer  
4. 官方文档入口（txt 所给）：https://docs.bekencorp.com/arminodoc/bk_app/lvgl_ui_designer/zh-cn/index.html  
5. 下载：https://dl.bekencorp.com/tools/lvgl_ui_designer  
6. 文档：快速开始 / 工作台 / 事件 / 工具栏 / AI 设计 / 发行说明（仓库 `doc/zh-cn/`；本地包 `resources/doc/zh-cn/`）  
7. 介绍视频：B 站「博通集成UI开发工具 BEKEN LVGL UI Designer」  
8. 姊妹文档：`博通集成_LVGL_UI工具_分析与仿制方案.md`、`BEKEN_LVGL_UI_Designer实现原理与仿制方案.md`  
9. 竞品逆向与重构设计：`BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`  

---

*文档性质：基于公开资料与本地工具包结构的技术分析，非官方白皮书；具体能力以当前安装版本发行说明为准。*
