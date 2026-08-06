# LVGL Pro 官方 UI 工具分析文档

> 基于 `lvgl_pro/lvglpro信息.txt`、**本机已装 LVGL Pro Editor 2.0.1**、官方站点、GitHub 与 Pro 文档整理。  
> 分析对象：**LVGL Pro**（核心为 **LVGL Pro Editor**）。  
> 本地版本：**2.0.1**（`LVGL_Pro_Editor-2.0.1-setup.exe` → 安装于 `D:\Program Files\LVGL_Pro_Editor`）。

---

## 1. 产品定位

LVGL Pro 是 LVGL 官方推出的 **嵌入式 UI 专业开发工具套件**，目标是：用可视化/声明式方式搭建与手写 LVGL C 同等能力的界面，并在预览、协作、测试、CI 上缩短「改 UI → 刷机验证」循环。

套件由四部分组成：

| 组件 | 作用 |
|------|------|
| **Editor（桌面端）** | 核心 IDE：XML 编辑 + Design 拖拽 + 真 LVGL 预览 + 导出 C / 调试 / 测试 |
| **Online Viewer** | 浏览器打开 GitHub 工程，团队分享预览，无需本地环境（[viewer.lvgl.io](https://viewer.lvgl.io)） |
| **Figma 插件（LVGL Flow）** | 从 Figma 同步布局、样式、资源、数据绑定与导航等到 Pro |
| **CLI** | 无头校验 XML、生成 C、编译、跑 UI 测试，接入 CI/CD |

一句话定位：

> **不是另一套闭源 GUI 库，而是围绕 LVGL 的「XML 声明式 UI + 官方编辑器 + 双路径落地（导出 C / 运行时加载 XML）」工具链。**

| 项 | 内容 |
|----|------|
| 官网 | https://lvgl.io/pro |
| Windows 安装包（本地） | `lvgl_pro/LVGL_Pro_Editor-2.0.1-windows/LVGL_Pro_Editor-2.0.1-setup.exe`（约 **129 MB**） |
| 本机安装目录 | `D:\Program Files\LVGL_Pro_Editor`（发行方 **LVGL Kft**；产品名 LVGL Pro Editor） |
| 用户数据 | `%APPDATA%\LVGL Pro Editor`（Electron/Chromium 缓存、Sentry、`config.json` 等） |
| GitHub Releases 另有 | zip 等形态（见信息文件链接）；本机实测为 **setup 安装器** |
| 仓库 | https://github.com/lvgl/lvgl_editor |
| 文档 | https://lvgl.io/docs/pro/ |
| 运行环境 | **Windows / macOS / Linux** |
| 图形库 | 开源 **LVGL**（MIT）；工具与 XML 规范另有授权 |
| 商业模式 | Community / Evaluation 免费；商用需 **Product / Platform** 授权（无版税） |

---

## 1.1 安装包实测摘要（2.0.1 Windows）

对安装目录与 `resources/app.asar` 的结构核查（只读分析，非逆向业务算法）：

| 项 | 实测 |
|----|------|
| 形态 | **Electron** 桌面应用（含 `LICENSE.electron.txt`、Chromium pak/dll） |
| IDE 框架 | **Eclipse Theia 1.69.0**（`package.json` 名 `theia-electron`；desktopName `io.lvgl.pro-editor`） |
| Electron | **40.10.6**（依赖声明） |
| 产品版本 | FileVersion **2.0.1**；主程序 `LVGL_Pro_Editor.exe` 约 **204 MB**；`app.asar` 约 **123 MB**；安装树合计约 **505 MB** |
| LVGL 业务包 | `theia-lved-core`、`@lved/shared-core`（内部 monorepo 名 **lved**） |
| 代码导出 | `lib/backend/code-export.js` + **`code-export.jsc`（V8 字节码）** — 导出逻辑有保护，非明文模板为主 |
| 真预览 | 内置 `@lved-runtime-resources`：**LVGL v9.4.0 与 v9.5.0** 两套；每套含 `preview-bin/lved-runtime.js` + **`lved-runtime.wasm`**，以及 `libs`（含 **lv_xml / lvrt / lvgl** 头与 `.dorp` 库包）、`xml` 组件库 |
| 工程脚手架 | `ecosystems/`：**ui-only / vscode / linux / zephyr**；Zephyr 带多块板卡元数据（Renesas EK-RA*、STM32U5G9J-DK2、NXP FRDM/MIMXRT、M5Stack Core2 等） |
| 模板 | `templates/`：`examples`、`tutorials`、`new-project-template`、`new-project-basic-template` |
| 内置扩展 | Open VSX 系：**git / github / clangd / CodeLLDB**；另打 **`lvgl.flow`（LVGL Figma Flow 0.2.0-rc.1）** |
| Figma 本机侧 | 扩展拉起本地 **Express + WebSocket** 服务；端口预设 **Alpha 9111/9112、Beta 19111/19112、Gamma 29111/29112**；写出官方 **XML**（`globals.xml` 等）；配 **sharp / prettier-xml**；内置约 **27** 类 base 控件资源目录 |
| 其它 | Monaco 编辑器；React 19；framer-motion；**resvg** 原生模块；文件监视排除 `preview-bin` / `preview-build`；用户目录见 **Sentry** 崩溃上报 |

一句话补正此前文档表述：

> Editor **不是**「简单 Electron + 自研五区」或笼统「像 VS Code」——而是 **Theia 完整 IDE 壳 + lved 扩展 + 双版本 Wasm 预览运行时 + 内置 Figma Flow 本机服务**；部分导出逻辑以 **.jsc** 形式保护。

---

## 2. 实现原理

### 2.1 总体架构

与「专有 UI 文件 + 板上闭源解释器」不同，LVGL Pro 以 **明文 XML 工程** 为单一事实源，再走两条落地路径：

```text
┌──────────────────────────────────────────────────────────────────┐
│  LVGL Pro 工具链                                                   │
│  Editor（VS Code 式桌面 IDE） / Online Viewer / Figma / CLI        │
└────────────────────────────┬─────────────────────────────────────┘
                             │ 读写 XML 工程
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  工程模型（明文 XML + 资源）                                        │
│  project.xml / globals.xml / translations.xml                     │
│  screens/  components/  widgets/  fonts/  images/                 │
└───────────────┬──────────────────────────────┬───────────────────┘
                │                              │
                ▼                              ▼
     ┌─────────────────────┐        ┌─────────────────────────────┐
     │ 编译期：XML → C 导出 │        │ 运行期：目标机加载 XML       │
     │ *_gen.c / *_gen.h   │        │ 商业 XML Engine（解析/实例化）│
     │ 手写骨架文件不覆盖   │        │ （LVGL 9.5+ 已从开源核剥离） │
     └──────────┬──────────┘        └──────────────┬──────────────┘
                │                                  │
                └──────────────┬───────────────────┘
                               ▼
                    普通 LVGL 应用（自备 display/indev port）
```

一句话：

> **设计期编辑 XML；生成期产出可读 LVGL C（或在设备上用 XML Engine 动态装载）；运行期始终是 LVGL 对象树。**

官方强调：导出的是 **plain LVGL C**，不引入额外专有运行时依赖（走 C 导出路径时，`LV_USE_XML` 可为 0）。

### 2.2 IDE 宿主技术形态（安装包实测）

> **Eclipse Theia 1.69 + Electron 40** 承载「XML/Design + 真 LVGL Wasm 预览 + C 调试扩展 + Figma Flow 本机服务」；业务扩展包名为 **lved**（`theia-lved-core` / `@lved/shared-core`）。

相对「轻量 Electron 画布工具」（如部分厂商 Designer）：

- 自带终端、Git、搜索、**clangd / LLDB** 调试链路，接近完整嵌入式 IDE  
- 预览侧打包 **双 LVGL 小版本** 的 `lved-runtime.wasm`，并带 **lv_xml** 相关库（编辑器内预览装载 XML）  
- **code-export** 存在 **V8 字节码（.jsc）**，仿制时不要假设能直接抄模板明文  
- 体积大（安装约 0.5 GB 级）；有 Sentry 等遥测/崩溃目录  

预览热更模型与文档一致：XML 变更 → Runtime 清屏重建；工程侧常见 `preview-bin` / `preview-build` 目录（监视器已排除）。

### 2.3 工程文档模型：XML 而非单一二进制/JSON

推荐工程结构（官方约定，非强制但利于路径与生成可预测）：

```text
my_project/
├── project.xml          ← 工程名、LVGL 版本、多 target/分辨率等
├── globals.xml          ← 字体、图片、styles、consts、subjects…
├── translations.xml     ← 可选，多语言
├── fonts/               ← .ttf / .bin 等
├── images/              ← 图片资源
├── widgets/             ← 自定义 <widget>（XML + 可配 C）
├── components/          ← 可复用 <component>（纯 XML 组合）
└── screens/             ← <screen> 顶层页面
```

相对「单文件 `.bkprj` JSON 树」一类设计器：

- **Git 友好**：按文件拆分、diff 可读  
- **组件库自然**：一文件一组件/屏  
- **CI/脚本易处理**：校验与生成直接吃目录  

#### Widgets / Components / Screens 三分法（核心抽象）

| 类型 | 本质 | 预览特点 | 运行时 XML 加载 |
|------|------|----------|-----------------|
| **Widget** | 类似内置控件；可含复杂 C 逻辑与自定义 API | 改 C 后需 **重编译预览** | 一般否（自定义代码无法仅靠 XML 装载） |
| **Component** | 纯 XML 组合（由 Widget/其他 Component 构成），可声明 `api` | XML 改完即可即时预览 | 可以（若使用运行时 Engine） |
| **Screen** | 顶层视图，由 Widget/Component 组成 | 即时预览 | 可以（视觉结构） |

`globals.xml` 统一注册样式、常量、图、字体、**Subjects（数据绑定源）** 等，多份 globals 可合并进同一全局作用域。

### 2.4 双模式编辑：XML Mode + Design Mode

同一套工程文件，两种编辑面：

1. **XML Mode**  
   左侧写 XML（补全、高亮、校验），右侧真 LVGL 预览。适合定义可复用组件、样式、动画、绑定、测试等「工具箱」层。

2. **Design Mode**  
   拖拽组装 Screen，只暴露组件 `api` 声明过的属性。适合设计师/产品在开发者搭好组件库之后拼屏，降低误改内部实现的风险。

团队协作模型：

```text
开发者（XML）定义组件库与 API 边界
        │
        ▼
设计师/产品（Design）拼 Screen、调暴露属性
        │
        ▼
Figma Flow 导入 / Online Viewer 评审 / CLI 进流水线
```

### 2.5 代码生成原理（编译期路径）

Editor 与 CLI 均可把 XML 转为 C：

1. 解析工程内 Screen / Component / Widget / globals  
2. 生成 `*_gen.c` / `*_gen.h`（**每次导出覆盖**，禁止手改）  
3. 首次生成用户骨架文件（如 `project_name.c`），之后 **不覆盖**，放自定义初始化  
4. 入口典型为 `project_name_init(asset_path)`；屏为 `main_screen_create()` 一类工厂函数  
5. 用户自行 `lv_init` + display/indev，再 `lv_screen_load(...)` + `lv_timer_handler`

生成代码特征：

- 风格接近手写 LVGL API，平台无关、不含驱动  
- Component 的参数打进 `create(...)` 形参，而非一长串 setter  
- 资源路径可通过 init 的 `asset_path` 前缀解析文件型字体/图片  

用户扩展惯用手法：

- 在非 `_gen` 文件里补 style / subject / observer / timer  
- 需要设计器表达不了的能力时，对生成组件包一层 **wrapper create**

### 2.6 运行时 XML 加载原理（动态路径）

官方长期宣传「设备上直接解析 XML、免重编更新 UI」。实现上依赖 **XML 解析/装载引擎**：

- 历史：曾作为 LVGL 源码中的 XML 模块存在（配置如 `LV_USE_XML`）  
- **LVGL 9.5+**：XML 解析与加载已从开源核心剥离，继续以 **商业组件** 形态提供（论坛/Issue 中官方确认）  
- **LVGL 库本体仍 MIT**，可免费商用；变化的是「板上动态吃 XML」能力的授权边界  

因此对产品选型要分清：

| 落地方式 | 是否需要运行时 XML Engine | 典型场景 |
|----------|---------------------------|----------|
| 导出 C 编译进固件 | 否 | 量产固件固定 UI、最小运行时 |
| 板上加载 XML | 是（9.5+ 商业） | OTA 改 UI、动态皮肤、少刷机 |

### 2.7 预览、Inspector、Figma Flow 与自定义 Widget

预览工具条常见能力：Inspector、**连接 Figma**、Compile & export。

**Figma（安装包内 `lvgl.flow`）：**

- Editor 内扩展启动本机服务；Figma 社区插件对接；设计不出本机  
- 端口预设须与插件一致（默认 Alpha：**HTTP 9111 / WS 9112**）  
- 落盘为官方 XML 工程（tokens→`globals.xml`、组件/屏/资源/标注/原型导航等）  
- 服务依赖 Node（可用 IDE 自带 runtime）；含图像处理（sharp）与 XML 格式化  

自定义 Widget：写 C 后重编预览（`preview-bin`）；无自定义 C 时用 bundled `lved-runtime.wasm`。

### 2.8 数据绑定、动画、测试、多语言

均以 XML 一等公民进入工程，而非仅生成空回调：

- **Subjects + Observers**：UI 观察应用数据，预览内可试绑定，无需刷机  
- **Timeline 动画**：时间轴步骤、跨组件 include、事件触发播放  
- **UI Tests**：XML 描述测试；Editor/CLI 可跑（CLI 支持无头与截图类流程）  
- **Translations**：翻译表 + 预览切语言  

### 2.9 与板端 / SDK 的关系

工具侧重：**设计、预览、导出、协作、CI**。安装包内脚手架覆盖 **UI Only / VS Code+SDL / Linux 多后端 / Zephyr 多板**；不替代芯片烧录 IDE。上板：导出 C → 并入已移植 LVGL 的工程 → 调 init / screen load。

---

## 3. 主要功能

依据官网 [lvgl.io/pro](https://lvgl.io/pro)、GitHub README（Features / Workflow）、Pro 文档（Editor / Syntax / Figma / CLI / Integration / AI），以及本机 **2.0.1** 安装结构整理。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **工具套件** | Editor + Online Viewer + Figma（LVGL Flow）+ CLI | 四件套一体；v2.0 宣传为「最大版本」 |
| **运行环境** | Windows / macOS / Linux 桌面 Editor | Electron + **Theia** 完整 IDE 壳 |
| **工程形态** | 多文件 **明文 XML** 工程 | Git 友好；HTML 风格语法；属性名贴近 LVGL API |
| **XML 编辑** | 语法高亮、补全、校验 | Monaco；组件 / Widget / Screen 模块化定义 |
| **Design 模式** | 拖拽拼装；暴露受控属性 | 依赖开发者先写组件与 `api`；设计师可在受限面操作 |
| **真预览** | 像素级即时预览（真 LVGL） | 内置 **Wasm** 运行时（实测双版本 **9.4 / 9.5**）；改 XML 即时反馈 |
| **Inspector** | 检查间距、点击区域、尺寸位置 | 预览工具栏可开关；可直接在预览中调测 |
| **组件化** | Component + Widget；可复用 API | `$` 属性引用、`#` 常量；globals 注册图/字等 |
| **表达式** | 由常量、自定义属性、当前 Target 计算属性 | 减少硬编码 |
| **数据绑定** | Subjects / observers 等 | 逻辑与 UI 解耦的干净 API（公开叙事） |
| **动画** | Timeline 时间轴动画 | 可视化创建与播放 |
| **翻译 / i18n** | 多语言支持 | 内置翻译工作流 |
| **资源与内存** | 图/字资源管理；内存区域规划与用量估算 | Assets and memory management（README） |
| **多 Target** | 同一工程多分辨率 / 架构 | 预览与资源包可按 Target 变体 |
| **C 导出** | 导出优化、可移植的 LVGL C | 平台无关；`*_gen` 与用户 wrapper 分离；无需 XML 依赖即可上板 |
| **运行时 XML** | 板上装载 XML 不重编 | 9.5+ 开源核边界变化；动态装载常依赖商业 Engine（选型需核对当期授权） |
| **自定义 Widget** | C 扩展后重编预览 | 预览与板端行为一致 |
| **UI 测试** | 编写并运行 UI 测试 | Editor 内；CLI 可进 CI |
| **调试** | 在 Editor 内调试导出 C | 内置 clangd / CodeLLDB 等扩展 |
| **Figma 集成** | LVGL Flow：同步样式/布局/资源/绑定/导航 | 本机 Express+WS 桥写入 XML；元素/全屏同步持续演进 |
| **Online Viewer** | 浏览器打开 GitHub 工程分享 | [viewer.lvgl.io](https://viewer.lvgl.io)；无需本地环境；可预览甚至修改（公开表述） |
| **CLI / CI** | validate、generate C、bundle、run tests | 需 Product/Platform 等授权侧 CLI 能力；失败即阻断流水线 |
| **AI** | 官方 **MCP Server** | AI 助手读写/生成 XML 工作流 |
| **脚手架与示例** | UI Only / VS Code+SDL / Linux / Zephyr 等 | Empty / Template / Learn by Examples（百余示例覆盖动画、绑定、组件、测试、翻译等） |
| **授权分层** | Community / Evaluation / Product / Platform | 非商用与评估免费；商用按产品/平台授权、宣传无版税 |

官方 Features 所列（类 VS Code 环境、组件 XML、即时预览+Inspector、Design、表达式、动画/绑定/翻译、资源与内存、多 Target、Figma、AI MCP、C 导出与运行时装载、测试调试、在线分享）均已落入上表。

### 3.2 分模块要点

**（1）四件套协作**  
桌面 Editor 为中枢；Figma 导入设计；Online Viewer 无安装评审；CLI 把校验/生成/测试送进 CI。

**（2）声明式 + 双模编辑**  
以 XML 为权威源；XML Mode 写结构与 API，Design Mode 在暴露属性上可视化拼装。利于 Git、脚本与 AI。

**（3）真 LVGL 预览闭环**  
预览即真实渲染（Wasm）；Inspector 量间距/点区；自定义 C Widget 可重编进预览，减少「设计器与板端两套效果」。

**（4）专业能力**  
Subjects 绑定、Timeline、翻译、UI Test、多 Target、资源/内存规划——超出「只画静态界面」。

**（5）双路径落地**  
导出 C：生成文件进已有 LVGL 工程，调 `project_init` / screen create/load。  
运行时 XML：板上解析装载（授权与 Engine 边界以当期文档为准）。

**（6）设计与工程协作**  
Figma Flow 缩设计稿距离；Online Viewer 给非开发角色看 UI；MCP 服务 AI 改工程。

### 3.3 主要特点（归纳）

- **工具形态：** 跨平台 Theia+Electron 专业 IDE + 在线/ Figma / CLI 外围  
- **开发模型：** 官方 XML 声明式工程 → 真 LVGL 预览 → 导出 C 或（授权下）运行时装 XML  
- **隔离模型：** 生成 `*_gen` 与用户 wrapper；组件 `api` 约束 Design 面  
- **差异化：** 官方同源、Wasm 真预览、Figma/CI/Online、MCP、运行时 XML 路径  
- **闭环叙事：** 组件库 → 拼屏 → 测试/绑定/动画 →（可选）Figma/在线 → 导出或 CI → 上板  

---


## 4. 优点

| 维度 | 说明 |
|------|------|
| **官方同源** | 与 LVGL 维护方同一生态，概念/API/版本演进对齐成本低 |
| **真 LVGL 预览** | 预览即真实渲染管线，减少「设计器好看、板上不对」 |
| **双路径落地** | 可纯导出 C（无 XML 依赖）；也可（授权允许时）运行时装 XML |
| **工程可版本化** | 明文 XML 拆分文件，Git diff、Code Review、AI 协作友好 |
| **组件化 API 边界** | `api` 控制 Design 模式可改项，适合规模化组件库 |
| **可扩展预览** | 自定义 Widget 重编译进预览，设计与固件行为一致 |
| **工程化能力强** | 测试、CLI、多 target、在线分享、Figma，超出「只画界面」 |
| **跨桌面平台** | Win/macOS/Linux 均可装 Editor |
| **授权模型清晰（相对订阅按座）** | Community/Evaluation 免费；Product 按产品、无按座、无年费版税表述；Platform 面向多产品/企业 |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **学习曲线偏开发者** | XML 语法、Widget/Component 分工、Subject 绑定等门槛高于纯拖拽工具 |
| **商用需付费** | 进入正式商用开发需 Product/Platform；CLI 等专业能力不在 Community/Evaluation |
| **运行时 XML 商业化** | 9.5+ 开源核不再内置 XML loader；动态装 UI 依赖商业 Engine，选型需单独评估 |
| **XML 规范工具侧受保护** | XML Specification 限制第三方公开/商用「读该规范的编辑器/生成器」——仿制官方格式做竞品工具有法律/合规风险 |
| **Design 模式能力边界** | 设计面依赖开发者先写好组件与 `api`；不是「从零全拖拽、无需懂结构」的零代码产品 |
| **自定义 Widget 摩擦** | 改 C 要重编预览，迭代节奏慢于纯 XML Component |
| **导出源码通病** | `_gen` 不可手改；大项目生成文件多，需纪律维护骨架层与 wrapper |
| **生态仍在快速演进** | 2.x 功能面大，版本间行为/授权边界要以当期文档与发行说明为准 |
| **体积与环境** | **Theia 完整 IDE** + 双版本预览运行时，安装约 **0.5 GB** 级；高于轻量画布类工具 |
| **部分逻辑闭源保护** | 如 `code-export.jsc`（V8 字节码），不可当开源模板直接抄 |

---

## 6. 与同类方案对比（简表）

| 对比项 | LVGL Pro（官方） | BEKEN LVGL UI Designer | SquareLine Studio |
|--------|------------------|------------------------|-------------------|
| 工程源 | 明文 XML 多文件 | `.bkprj` JSON 等 | 专有工程 + 导出 |
| 编辑范式 | XML + Design 双模 | 偏可视化五区工作台 | 偏可视化 |
| 预览 | 真 LVGL **Wasm**（bundled 9.4/9.5）+ 可重编 | DOM 近似 + SDL 仿真 | 真 LVGL 向 |
| IDE 壳 | **Theia + Electron** | Electron 画布向 | 视发行 |
| 产出 | C 导出；可选运行时 XML | C / MicroPython | C / MicroPython |
| 运行时 XML | 有路径（现偏商业 Engine） | 通常无对等 | 通常无对等 |
| CI/协作 | CLI + Online Viewer + Figma | 偏本机；有 AI MCP | 视版本 |
| 桌面平台 | Win/macOS/Linux | 官方 Windows | 视发行 |
| 费用 | 非商用免费；商用授权 | 厂商工具免费宣传 | 订阅制为主 |
| 厂商绑定 | 弱（官方 LVGL） | 弱～中（生态重心自有芯片） | 弱 |

相对 Beken 工具：Pro 更偏 **声明式工程 + 官方协作/CI 套件**；Beken 更偏 **开箱拖拽 + 厂商仿真/模板/AI 改画布**。二者都走「生成/编译进 LVGL」主线，但工程模型与授权完全不同。

---

## 7. 适用与不适用

**较适合**

- 已选定 LVGL，希望工程可 Git 管理、可 CI、可组件库化  
- 团队有「开发搭组件 / 设计拼 Screen」分工  
- 需要官方预览一致性、测试与在线分享  
- 量产走 **导出 C**，接受商用授权成本  
- 希望用 AI/脚本直接处理 XML 源  

**不太适合**

- 希望完全免费商用、且零学习曲线纯拖拽（可优先评估厂商免费设计器或手写）  
- 强依赖 **板上动态加载 XML** 又不接受 9.5+ 商业 Engine  
- 打算基于官方 XML 规范做对外发布的第三方 UI 编辑器/生成器（规范限制明确）  
- 不使用 LVGL、或需要专有串口屏解释格式生态  

---

## 8. 结论

LVGL Pro 官方 UI 工具的实现本质是：

> **Theia+Electron IDE + 受规范保护的 LVGL XML 工程 → 内置双版本 `lved-runtime.wasm`（含 XML 装载）真预览 →（部分保护的）C 导出 / 或商业板上 XML Engine；Figma 经本机 Flow 服务写入 XML。**

特点上，它把嵌入式 UI 拉向 **声明式 + 组件 API + 完整 IDE/调试 + Figma/CI**。

**主要功能面**覆盖：四件套、XML/Design 双模、Wasm 真预览与 Inspector、组件化与表达式、Subjects/Timeline/翻译、资源与多 Target、C 导出与运行时 XML、UI 测试与调试、Figma Flow、Online Viewer、CLI/CI、MCP AI，以及脚手架与分层授权等。

代价是学习成本、商用授权、安装体积，以及 XML 规范对第三方工具的限制。仿制若要功能对齐，应预期 **Wasm 预览 + 本机 Figma 桥 + 重 IDE 或可裁剪壳** 的工程量，且 **不要** 复用官方 XML / 解包业务 .jsc。

---

## 9. 参考资料

1. 本地：`lvgl_pro/lvglpro信息.txt`；`LVGL_Pro_Editor-2.0.1-setup.exe`  
2. 本机安装：`D:\Program Files\LVGL_Pro_Editor`（2.0.1 实测）  
3. 产品页：https://lvgl.io/pro  
4. 仓库 README：https://github.com/lvgl/lvgl_editor  
5. Editor / Figma / 导出 C / XML License / CLI / Online Viewer / AI 文档（lvgl.io/docs/pro/…）  
6. 产品页功能叙述：https://lvgl.io/pro ；仓库 README Features  
7. 社区讨论：XML engine 与 LVGL 9.5 授权边界  
8. 姊妹文档：`LVGL_Pro官方UI工具_仿制方案.md`、`LVGL_Pro官方UI工具_分析与仿制方案.md`  
9. 竞品逆向与重构设计：`LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md`  

---

*文档性质：基于公开资料与本机安装包目录/清单的技术分析，非官方白皮书；不对 asar 业务字节码做逆向。具体能力以当期版本为准。*
