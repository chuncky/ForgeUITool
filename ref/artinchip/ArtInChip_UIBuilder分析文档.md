# ArtInChip UIBuilder（AiUIBuilder）分析文档

> 基于 `artinchip/UIBuilder简介.txt`、`artinchip/UIBuilder使用指南.pdf`（及仓库内 `UIBuilder使用指南.md`）、本机安装包 **AiUIBuilder 2.0.2**、官方文档中心与公开介绍整理。  
> 分析对象：**匠芯创（ArtInChip）UIBuilder / AiUIBuilder** — 面向 ArtInChip 嵌入式平台的 **LVGL 可视化 UI 设计工具**。  
> 本地版本线索：**2.0.2**（`AiUIBuilder-2.0.2_setup.exe` → `D:\ArtInChip\AiUIBuilder`）。

---

## 1. 产品定位

UIBuilder 是 ArtInChip（广东匠芯创）推出的 **嵌入式 GUI 可视化开发工具**，底层图形库为开源 **LVGL**。定位接近 SquareLine Studio、BEKEN LVGL UI Designer：在 PC 上拖拽设计界面，**生成调用 LVGL API 的 C 代码**，经本机仿真验证后，一键复制到 **Luban-Lite SDK** 等工程目录交叉编译上板。

官方表述要点：

- 拖拽完成专业级 UI，降低手写 LVGL 布局成本  
- 一键导出 C（支持 **LVGL V8.3 / V9.1**）  
- 自动生成代码与用户业务逻辑隔离（`custom/`）  
- 直接接入匠芯创 SDK 快速部署  

| 项 | 内容 |
|----|------|
| 厂商 | ArtInChip / 匠芯创 |
| 产品名 | UIBuilder / **AiUIBuilder** |
| 文档 | https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder_user_guide.html |
| 简介页 | https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder-introduction.html |
| 本机安装包 | `artinchip/AiUIBuilder/AiUIBuilder-2.0.2_setup.exe`（约 **216 MB**） |
| 本机安装目录 | `D:\ArtInChip\AiUIBuilder`（Inno Setup；注册表 DisplayName **AiUIBuilder version 2.0.2**） |
| 运行环境 | **Windows 7+ 64 位**（官方） |
| 目标图形库 | **LVGL V8.3 / V9.1**（安装包内仿真侧可见 **8.3.11**、**9.1.0**） |
| 典型落地 | Luban-Lite / 立创等 ArtInChip 芯片方案（D12x/D13x/D21x 等） |

一句话：

> **Qt 桌面设计器编辑 XML 工程描述 → 生成标准 LVGL C（+ custom 隔离）→ 内置 MinGW/CMake + SDL 仿真 → 复制进 SDK 上板。**

---

## 2. 实现原理

### 2.1 总体架构

与「板上闭源 GUI 解释器」不同，UIBuilder 走典型的 **设计器 → 导出 LVGL 源码 → 编译链接** 路线：

```text
┌────────────────────────────────────────────────────────────┐
│  AiUIBuilder（Qt5 Widgets 桌面应用）                         │
│  画布 / 控件库 / 属性 / 样式 / 事件 / 资源 / 代码查看         │
│  核心逻辑：AicUI.dll                                         │
└───────────────────────────┬────────────────────────────────┘
                            │ .aicpro + .cfg + .snapshot（XML）
                            │ + resources / data
                            ▼
┌────────────────────────────────────────────────────────────┐
│  CodeGen（内置生成器）                                       │
│  ui_builder/（生成区）+ custom/（用户区，再生成不覆盖逻辑）   │
└───────────────┬────────────────────────────┬───────────────┘
                │                            │
                ▼                            ▼
     PC 仿真（LVGL + SDL2）           板端 Luban-Lite 等 SDK
     内置 MinGW + CMake               复制 ui_builder → 交叉编译
```

### 2.2 安装包实测技术栈（2.0.2）

对 `D:\ArtInChip\AiUIBuilder` 目录核对：

| 层级 | 技术 / 文件 |
|------|-------------|
| 宿主 | **Qt5**（`Qt5Core/Gui/Widgets/Sql/Xml/Svg/Network…`） |
| 主程序 | `AiUIBuilder.exe`（约 **250 MB**，体积大，内嵌资源多） |
| 核心逻辑 | **`AicUI.dll`** |
| 代码查看 | **QScintilla**（`qscintilla2_qt5.dll`） |
| 工程数据 | XML（`.cfg` / `.snapshot`）+ **SQLite**（`data/param_data.db`，`qsqlite`） |
| 仿真 | **SDL2.dll** + `tool/simulator/lvgl/{8.3.11,9.1.0}` |
| 编译 | 内置 **MinGW** + **CMake**（`tool/`） |
| 字体 | `lv_font_conv.exe`、`pyftsubset.exe` |
| 音视频 | **FFmpeg** 系列 DLL（`avcodec-61` 等）— 对应视频控件/模板 |
| 语言包 | `l18n/zh_cn.qm`、`en.qm` |
| 模板 | `app_template/`：smart_home、order_coffee、bread_machine、multi_language、video_template 等 |
| 手册 | 安装目录含用户手册 PDF |

安装树合计约 **1 GB** 级（含完整工具链与双版本 LVGL），setup 约 216 MB。

**不是** Electron/Theia；相对 LVGL Pro 的重 IDE，UIBuilder 是 **传统 Qt 专业桌面工具 + 内嵌仿真工具链**。

### 2.3 工程文档模型

| 文件 | 作用 |
|------|------|
| `*.aicpro` | 工程入口（打开项目时选此后缀） |
| `*.cfg`（XML，`ai_cfg`） | 分辨率、色深、多语言开关等项目配置 |
| `*.snapshot`（XML，`ailv-app`） | **UI 权威描述**：Screen → Widgets 树、Style（Part/State）、Event、Attribute |
| `resources/` | 图/字等资源 |
| `ui_builder/` | 生成代码与仿真产物目录 |
| `custom/` | 用户业务代码（再生成时保留约定） |

`.snapshot` 片段特征（模板实测）：

```xml
<ailv-app>
  <Screen id="..." name="Cooking" is-default="1">
    <Style><Part name="Main"><State name="Default">...</State></Part></Style>
    <Widgets>
      <Widget type="5" name="left_bg" ...>  <!-- type 数字映射 LVGL 控件 -->
        <Normal><postion>0,0</postion><size>200,600</size></Normal>
        <Attribute><src>left_bg.jpg</src>...</Attribute>
        <Style>...</Style>
        <Event>...</Event>
      </Widget>
    </Widgets>
  </Screen>
</ailv-app>
```

设计器行为：拖入/改属性/改样式/配事件 → 更新 XML 模型 → 画布刷新。  
**设计期画布**由 Qt 侧按模型绘制；**真 LVGL 画面**靠「生成 + 仿真运行」（SDL）。

### 2.4 代码生成原理

1. 解析 `.snapshot` / 配置 / 资源  
2. 展开为 C：`ui_init()` 入口、`screen_*.c`、样式、事件回调、`ui_objects` 等  
3. 输出到工程下 `ui_builder/`  
4. **用户扩展**：事件可挂「自定义函数名」；生成 **弱符号（weak）** 空实现，用户在 `custom.c` 写同名强函数覆盖  
5. 明确约束：**不要改生成区**；手写与 custom 资源放 `custom/`（含 `custom/assets`），避免再生成被删  

生成代码风格：直接调用 `lv_*` API（创建、坐标、样式 Part/State、事件 cb），平台无关；资源路径常用宏（如 `LVGL_IMAGE_PATH`），上板需在 SDK 侧定义存储路径。

### 2.5 PC 仿真原理

```text
运行(F5) →（若需要）先生成代码
    → CMake + 内置 MinGW 编译
    → LVGL + SDL2 窗口
    → ui_init() → lv_timer_handler 循环
```

双 LVGL 版本由工程创建时选择（V8.3 / V9.1），对应 `tool/simulator/lvgl` 下不同树。

### 2.6 事件与页面导航

设计器内图形化配置：

| 触发（示例） | 动作（示例） |
|--------------|--------------|
| Clicked / Pressed / Created… | 切 Screen |
| | 改属性 / 播动画 |
| | 调自定义函数（weak→custom 强函数） |

本质是 **事件表 → CodeGen 成 LVGL 回调 + screen load**，不是 Android Activity 栈。

### 2.7 资源与芯片侧能力

- **字体裁剪**：内置工具，按字符集生成精简字库  
- **图片转换**：png/jpg/**aicp**（ArtInChip 自定义图格式，分平台支持 alpha）  
- **视频**：mp4/avi 等；平台相关编解码限制（文档按 D21 / D12x/D13x 区分）；FFmpeg 支撑 PC 侧  
- **外置存储读图/字**：生成侧按路径宏，适配板端文件系统  
- **一键复制到 SDK**：工具/项目级配置 SDK 路径，覆盖复制 `ui_builder`

### 2.8 与板端 / SDK 的关系

工具 = **设计 + 生成 + PC 仿真 + 拷贝到 SDK**，不是完整烧录 IDE。

上板典型路径：

1. 生成 / 复制 `ui_builder` 到 Luban-Lite（或立创文档所述路径）  
2. 补路径宏、SConscript/编译脚本、在 `aic_ui_init` 等处调 `ui_init()`  
3. 按需打开 FreeType 等 LVGL 配置  
4. 交叉编译烧录  

图形栈仍是开源 LVGL；**aicp、视频管线、SDK 目录约定**体现厂商绑定。

---

## 3. 主要功能

依据官方简介「主要特性」、基本操作 / 事件处理文档、厂商公开介绍、立创 SDK 对接说明，以及本机 AiUIBuilder **2.0.2** 安装结构整理。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **运行环境** | Windows 7+ 64 位桌面客户端 | 官方明确仅 Windows；安装包自带 MinGW/CMake 等工具链 |
| **LVGL 版本** | V8.3 / V9.1 双版本工程 | 新建时选择；仿真侧可见 8.3.11、9.1.0 |
| **工程管理** | 新建向导、打开 `.aicpro`、导入已有工程、项目导出 | Empty UI 或模板；分辨率 / 色深可配；导出可去掉大体量 `simulator` |
| **可视化设计** | 拖拽式 UI；**30+** 控件；属性设置 | 中心画布；拖入/点击添加；改位置尺寸与属性 |
| **编辑增强** | 复制/粘贴/删除；撤销/重做；自动对齐；坐标微调；层级调整 | 方向键微调；Alt/Ctrl+方向键调 Z 序；多开工程时 **全局复制/粘贴** |
| **样式** | Style 设置；预设样式 / 自定义预设 | 贴近 LVGL **Part / State** 样式模型 |
| **事件** | 图形化 event 配置 | 改属性、**页面加载/切屏**、动画、**自定义函数名**（生成 weak，`custom.c` 强函数覆盖）；Screen Created 等 |
| **组件** | 容器及其子树「保存为组件」 | 可像标准控件一样再次拖入复用 |
| **字体** | 字体导入；独立「字体裁剪」工具 | 按字符集裁剪矢量字；支持从外部存储器读字体（生成侧路径宏） |
| **图片** | 图片导入；独立「图片转换」 | 输出 png/jpg/**aicp**（厂商格式，分芯片平台支持 alpha）；可从外部存储读图 |
| **视频** | 视频/APNG 导入 | mp4/avi 等；编解码能力因 D21 / D12x/D13x 等平台而异 |
| **多语言** | 新建工程开关；变量表 + 多语言字体 | 增语言/变量；变量值同步；按语言字体与动态加载选项 |
| **代码生成** | 一键生成 LVGL C；代码查看器 | 入口 `ui_init()`；输出目录 `ui_builder/`；用户代码放 `custom/` |
| **模拟仿真** | 运行 / **F5** | 未生成则先生成 → CMake+MinGW → SDL 窗口验证交互 |
| **SDK 集成** | 配置 SDK 路径；一键复制 `ui_builder` | 项目设置优先于工具全局设置；对接 Luban-Lite / 立创等文档路径 |
| **调试辅助** | 导出代码可在 VS Code 改与单步调试 | 官方流程：PC 设计仿真 →（可选）VS Code → SDK 交叉编译烧录 |
| **界面语言** | 设计器中文 / 英文切换 | 工具 UI 本地化，非业务多语言 |
| **模板与示例** | 多套项目模板 | 安装包内智能家居、点餐、面包机、多语言、视频等，降低上手成本 |

官方简介所列能力（新建/导入、拖拽、剪贴板与撤销、属性/style/预设、字体裁剪、event、中英 UI、30+ 控件、代码导出、仿真、外置图/字、项目导出、一键复制 SDK）均已落入上表。

### 3.2 分模块要点

**（1）工程与向导**  
选 LVGL 版本与模块（Empty / 模板），设名称、路径、色深、分辨率；打开本地 `.aicpro`；可导出精简工程包（去掉自动生成的大体积 simulator）。

**（2）设计器（核心）**  
拖拽 30+ LVGL 向控件；属性 + Style Part/State + 预设样式；对齐参考线与层级快捷键；容器另存为组件；多工程全局复制粘贴。

**（3）事件与业务扩展**  
右键配置 Clicked / Pressed / Created 等 → 切 Screen、改属性、播动画、挂自定义函数名。CodeGen 出 weak 桩；业务写在 `custom.c`（及 `custom/assets`），再生成不覆盖用户区。

**（4）资源工具链**  
字体裁剪、图片转 png/jpg/aicp、视频/APNG；生成侧常用外置存储路径宏，适配板端 FS。

**（5）生成 · 仿真 · 上板闭环**  
生成 `ui_builder` → F5 SDL 仿真 →（可选）VS Code 改 custom → 一键复制到 SDK → 补宏/SConscript → `ui_init()` → 烧录。工具本身不是完整烧录 IDE。

### 3.3 主要特点（归纳）

- **工具形态：** Windows Qt 桌面 IDE + 内置仿真工具链  
- **开发模型：** XML 工程描述 → 标准 LVGL C 源码（非解释型 UI 包）  
- **隔离模型：** `ui_builder` 生成区 + `custom`/weak 用户区  
- **厂商向能力：** aicp、视频管线约定、外置图/字、一键进 Luban-Lite  
- **闭环叙事：** 拖拽设计 → PC 仿真 → SDK 上板（与 SquareLine / Beken Designer 同属「设计器→源码」范式）

---


## 4. 优点

| 维度 | 说明 |
|------|------|
| **贴近 LVGL 产出** | 生成可读 `lv_*` C，可进 SDK，不绑定闭源板上 GUI 解释器 |
| **学习曲线友好** | 拖拽 + 属性 + 事件即可出交互；模板与文档齐全 |
| **仿真闭环** | 内置工具链与 SDL，改 UI 后本机验证，少刷机 |
| **用户代码隔离清晰** | `custom/` + weak 覆盖，比「每次全量覆盖手写」更适合迭代 |
| **双 LVGL 版本** | V8.3 / V9.1 兼顾存量与较新工程 |
| **厂商资源链路** | aicp、外置存储、视频、一键进 Luban-Lite，缩短芯片方案交付 |
| **工程可备份** | XML 明文 snapshot/cfg，可 diff/归档；导出可去掉 simulator 减体积 |
| **Windows 绿色工具链** | 自带 MinGW/CMake/字体工具，减少环境搭建 |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **仅 Windows** | 官方要求 Win7+ 64 位；无 macOS/Linux 原生设计器 |
| **厂商垂直** | 文档与最佳实践围绕 ArtInChip SDK/芯片；跨平台移植要自理 port 与路径宏 |
| **安装体积大** | 安装树约 **1 GB**（双 LVGL + 编译器 + FFmpeg），机器磁盘压力明显 |
| **设计画布 ≠ 真 LVGL** | 编辑期 Qt 绘制，最终观感以仿真/板端为准，复杂样式需养成「常跑仿真」习惯 |
| **导出源码通病** | 生成文件多；误改 `ui_builder` 会被再生成冲掉；需纪律只用 `custom/` |
| **控件 type 数字化** | snapshot 内 type 为数字枚举，可读性弱于「标签名即控件」的声明式方案，二次工具要维护映射表 |
| **无官方 Figma/在线协作套件** | 相对 LVGL Pro：缺 Figma Flow、Online Viewer、官方 CLI/CI 产品化能力（公开资料层面） |
| **AI/MCP** | 公开能力以传统桌面工具为主，未见与 Pro/Beken 对等的 MCP 直改画布叙事 |
| **版本与 SDK 摩擦** | LVGL 大版本、SDK 路径、FreeType/存储宏需人工对齐；社区文档（如立创）常需补步骤 |

---

## 6. 与同类方案对比（简表）

| 对比项 | ArtInChip UIBuilder | LVGL Pro | BEKEN LVGL UI Designer |
|--------|---------------------|----------|-------------------------|
| 宿主 | **Qt5** 桌面 | Theia + Electron | Electron |
| 工程源 | XML `.snapshot` + `.aicpro` | 官方 Pro XML 多文件 | `.bkprj` JSON |
| 预览 | 生成后 **SDL+LVGL** 仿真 | 编辑器内 **Wasm 真预览** | DOM 近似 + SDL 仿真 |
| 产出 | C → SDK | C；可选运行时 XML | C / MicroPython |
| LVGL 版本 | **8.3 / 9.1** | 随 Pro 绑定较新（如 9.4/9.5） | 文档侧约 9.3 |
| 芯片生态 | **强绑 ArtInChip** | 弱（通用 LVGL） | 偏 Beken，可移植 |
| Figma / 在线 | 无对等公开套件 | 有 | 无对等 |
| 平台 | Windows | Win/macOS/Linux | 官方 Windows |
| 商业 | 厂商工具（随芯片生态） | 非商用免费 / 商用授权 | 免费宣传 |

对「已选匠芯创芯片 + 要快速出 LVGL 界面」：UIBuilder 是路径最短的官方设计前端。  
对「跨芯片、要声明式 Git/CI/Figma」：更应看 LVGL Pro 或自研/其它通用设计器。

---

## 7. 适用与不适用

**较适合**

- ArtInChip SoC + Luban-Lite（或兼容其目录约定的方案）  
- 需要拖拽出多页面、事件跳转、本机仿真、再进 SDK  
- 团队以 Windows + C 为主，接受 `custom/` 扩展模式  
- 需要字体裁剪、aicp、视频等厂商资源能力  

**不太适合**

- 需要 macOS/Linux 设计器工作流  
- 强依赖 Figma→UI、在线评审、官方 XML 运行时热更  
- 非 LVGL 或非 ArtInChip 生态且不愿自接仿真/SDK  
- 希望编辑器内「改一下立刻真 LVGL 像素预览、无需编译」的体验（Pro 更强）

---

## 8. 结论

ArtInChip **UIBuilder / AiUIBuilder** 的实现本质是：

> **Qt5 + AicUI 编辑 XML 工程（`.aicpro` / `.cfg` / `.snapshot`）→ 生成标准 LVGL C（`ui_builder` + `custom`/weak 扩展）→ 内置 MinGW/CMake + SDL 仿真 → 一键进入 Luban-Lite 等 SDK。**

它站在 **开源 LVGL** 上，用 **厂商垂直工具链**（aicp、双版本仿真库、SDK 复制）缩短芯片方案 UI 交付。

**主要功能面**覆盖：双 LVGL 工程、向导/模板与 `.aicpro`、拖拽 30+ 控件与组件复用、Part/State 样式与预设、图形化事件（切页/动画/custom weak）、字体裁剪与图转（含 aicp）、视频/APNG、多语言、代码生成与查看、F5 SDL 仿真、一键复制 SDK，以及设计器中英 UI 等。

强项是拖拽、事件、仿真闭环与用户代码隔离；弱项是 Windows/体积、画布与真机双轨、生态绑定，以及相对 LVGL Pro 缺少现代协作与编辑器内 Wasm 预览。

选型建议：已锁定匠芯创平台时优先用 UIBuilder 提效；要通用 LVGL 工程化与 Figma 时另评估 Pro；要轻量免费跨场景拖拽时可并列看 Beken 等工具。

---

## 9. 参考资料

1. 本地：`artinchip/UIBuilder简介.txt`  
2. 本地：`artinchip/UIBuilder使用指南.pdf`；仓库 Markdown：`UIBuilder使用指南.md`  
3. 本地安装包：`artinchip/AiUIBuilder/AiUIBuilder-2.0.2_setup.exe`  
4. 本机安装：`D:\ArtInChip\AiUIBuilder`（2.0.2 目录/DLL/模板/snapshot 实测）  
5. 官方文档：https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder_user_guide.html  
6. 简介 / 基本操作 / 事件 / 控件：aicdoc …/uibuilder-introduction.html 、uibuilder-function-intro.html 、uibuilder-events.html 、uibuilder-widgets.html  
7. 厂商介绍：https://www.artinchip.com/detail/301.html  
8. 立创对接示例：https://wiki.lckfb.com/zh-hans/hspi-d133ebs/beginner/aiuibuilder-code-integration-sdk/…  
9. 仓库既有深挖：`UIBuilder实现方案分析文档.md`（数据模型/CodeGen 细节可作补充阅读）  
10. 姊妹文档：`ArtInChip_UIBuilder_仿制方案.md`、`ArtInChip_UIBuilder_分析与仿制方案.md`  
11. 竞品逆向与重构设计：`ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`  

---

*文档性质：基于公开资料与本机安装包结构的技术分析，非官方白皮书；具体能力以当前安装版本与官方文档为准。*
