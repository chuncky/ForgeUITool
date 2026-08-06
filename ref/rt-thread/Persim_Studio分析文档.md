# RT-Thread Persim Studio（Aura Studio）分析文档

> 基于本地资料整理：`rt-thread/xf-persim-studio`（源码与 SDK）、安装包 `persim-studio-3.3.0.vsix`、示例工程 `xf-persim-apps`、板端运行时 `vehicle-persim-dash`，以及介绍材料 `a-cockpit总体介绍.pptx`。  
> 分析对象：**Persim Studio / Aura Studio**（RT-Thread 面向 PersimUI / Persimmon 的嵌入式 UI 设计与开发工具）。  
> 说明：文档与产品对外常称 **Aura studio**，插件包名 / VSIX 为 **persim-studio**，运行时图形栈为 **Persimmon（柿饼）**，业务层常称 **PersimUI / Persim App**。  
> 综合稿（分析+仿制，推荐阅读）：[`Persim_Studio_分析与仿制方案.md`](./Persim_Studio_分析与仿制方案.md)。  
> 分册仿制方案：[`Persim_Studio_仿制方案.md`](./Persim_Studio_仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`Persim_Studio_竞品逆向与重构设计说明.md`](./Persim_Studio_竞品逆向与重构设计说明.md)。

---

## 1. 产品定位

Persim Studio 是 RT-Thread 推出的 **嵌入式 UI 可视化设计与 JS 应用开发环境**。它不是「拖拽后导出 LVGL C 源码」一类工具，而是典型的 **小程序 / 动态应用包** 模型：

- PC 上用 VS Code 插件做可视化 XML 布局 + 手写 JS 业务  
- 打包成 `app.prc`（或表盘 `app.dial`）  
- 由板端 **Persimmon + JerryScript** 运行时加载执行  

定位更接近 **中科世为 FlyThings / 厂商「智能屏小程序」**，而不是 SquareLine、BEKEN LVGL UI Designer、ArtInChip UIBuilder 那种 **CodeGen → 静态链接进固件** 路线。

官方自述要点（`xf-persim-studio/README.md`）：

- 依赖 **VS Code** 的插件形态，复用代码编辑、补全、插件生态  
- 丰富控件与属性，拖拽设计 UI  
- 内置 SDK，可直接做业务开发、模拟仿真与真机下载  
- 现阶段 **仅支持 Windows**，VS Code 版本需 **> 1.52.0**（`package.json` 声明 `engines.vscode >= 1.50.0`）

| 项 | 内容 |
|----|------|
| 本地安装包 | `rt-thread/persim-studio-3.3.0.vsix` |
| 插件源码 | `rt-thread/xf-persim-studio`（version **3.3.0**，publisher RT-Thread） |
| 内置 SDK 示例 | `persim-sdk/platforms/persimwear-2`（Vehicle PersimUI V2.0.0，apiLevel 2） |
| 示例 App | `xf-persim-apps`（如 `1024x600/a-cockpit`、`xfzk`） |
| 板端参考工程 | `vehicle-persim-dash`（仪表盘 + PersimUI 宿主） |
| 运行环境（设计器） | **Windows + VS Code** |
| 板端 OS | **RT-Thread** + Persimmon / JerryScript |

---

## 2. 实现原理

### 2.1 总体架构

```text
┌─────────────────────────────────────────────────────────────────┐
│  Persim Studio（VS Code Extension / VSIX）                       │
│  packages/main：工程、打包、仿真、下载、SDK 管理                   │
│  packages/web-designer：Vue3 可视化设计器（Custom Editor）       │
│  persim-sdk：API 类型、控件描述、launcher rootfs、simulator.exe  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 编辑/读写工程源码
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Persim App 工程（明文源码）                                      │
│  src/pages/**/*.xml   UI 布局（rtgui 控件树）                     │
│  src/pages/**/*.js    页面逻辑（Page/App 生命周期）               │
│  src/app.js / app.json 入口与元数据                               │
│  src/res/             图片、字体、多语言 values 等                 │
│  .settings/           projectConfig.json 等工具配置               │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 打包（prcbuild / app_pkg_tool）
                                │ 可选：JS→Jerry snapshot 字节码
                                │ 可选：图片按 GPU 转 ezip/etc2…
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  产物：dist/output/.../app.prc（或 app.dial）                     │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
     PC 仿真（SDK 内 simulator.exe）    板端 PersimUI 宿主
     SDL2 窗口 + 模拟 rootfs            RT-Thread + Persimmon
     加载 .prc / launcher               JerryScript 解释/执行字节码
                                        XML 或 PLD 加载控件树
```

一句话：

> **设计期编辑 XML+JS；打包期产出可安装的 `.prc` 应用包；运行期由 Persimmon 图形栈 + JerryScript 解释执行，仿真与板端共用同一套应用包模型。**

这与 BEKEN/SquareLine「生成 C 再编译进固件」本质不同：**上板不依赖把 UI 编译进 C 工程，而依赖宿主已集成 PersimUI 运行时，再安装/加载应用包。**

### 2.2 IDE 宿主技术形态

`xf-persim-studio` 与 `docs/development.md` 可确认：

| 层次 | 技术 |
|------|------|
| 插件壳 | VS Code Extension（`main` → `dist/extension.js`） |
| 设计器前端 | **Vue3 + Vite + Element Plus + TypeScript**（`packages/web-designer`） |
| 插件后端 | Node/TS（工程管理、打包流水线、仿真进程、下载） |
| 工程构建 | pnpm workspace + turbo + tsup + `@vscode/vsce` |
| 自定义编辑器 | `PersimStudio.designer`，匹配 `*.xml`，打开即进可视化设计器 |

安装方式：VS Code「从 VSIX 安装」→ `persim-studio-X.X.X.vsix`。  
安装后活动栏出现 PersimStudio / Aura studio 入口，可打开/创建工程、设置、SDK 管理。

内置 `persim-sdk` 关键大致包括：

```text
persim-sdk/
├── platforms/persimwear-2/
│   ├── API/@types          # JS 智能提示
│   ├── fonts / lib / launcher
│   ├── widgets/inner|user  # 设计器控件配置 JSON
│   ├── pmLint
│   ├── simulation/simulator/simulator.exe  # PC 模拟器（SDL2 等）
│   └── package.json        # apiLevel、displayName
└── tools/
    ├── prcbuild/           # app_pkg_tool.exe、xml2bin.exe
    ├── jerry_snapshot/     # JS→字节码
    ├── convertImg/         # 图片按 GPU 转换
    ├── multiPixel/         # 多分辨率
    └── udb/                # 真机下载相关
```

### 2.3 工程文档模型：XML + JS（非 LVGL / 非单一 JSON 工程文件）

应用工程权威数据是 **目录树明文源码**，不是单一 `.bkprj` 式工程文件。

**页面 XML**（示例 `xfzk/.../main.xml`）为 Persimmon/rtgui 控件树：

```xml
<rtgui>
  <class>Page</class>
  <widget name="main" class="Page">
    <property name="rect">0, 0, 1024, 600</property>
    <widgets>
      <widget name="msg_text" class="MultiTextBox">
        <property name="text">文本提示</property>
        ...
      </widget>
    </widgets>
  </widget>
</rtgui>
```

**页面 JS** 使用 Persim 小程序风格 API：`Page({ onLoad, onShow, ... })`、`this.setData(...)`、`pm.showFloatPage(...)` 等；示例中通过 `require("ubus")` 订阅车机/仪表数据。

**应用入口** `app.js`：`App({ page: "...", onLaunch, ... })`。  
**元数据** `app.json`：id、name、version、apiLevel、icon 等。

设计器配置在 `.settings/projectConfig.json`（分辨率、SDKName、仿真路径、打包/下载设置等）。示例 `a-cockpit` 使用 `SDKName: persimwear-2`，分辨率 1024×600。

控件 schema 可由运行时侧 **layout-desc YAML** 生成设计器 JSON（`layout-compiler`）；Studio 侧也支持在 SDK `widgets/` 下用 JSON 扩展自定义控件。

### 2.4 打包与产物原理

打包流水线（`packages/main/packages/package.ts` 等）核心步骤：

1. 执行可选「打包前脚本」  
2. 复制/处理源码；若开启 **转字节码**，先 uglify，再调用 `jerry_snapshot`  
3. **图片锻造**：按透明度、质量、GPU 型号转为 png / ezip / etc2 等  
4. 调用 `app_pkg_tool.exe`（prcbuild）生成 `app.prc` 或 `app.dial`  
5. 执行可选「打包后脚本」  
6. 输出到 `dist/output/original/`（多分辨率时还有对应分辨率子目录）

命令行也可独立打包（`xf-persim-apps/tools/prc-pkg`）：

```text
app_pkg_tool.exe -i <资源目录> -o <输出目录> [-l language]
```

另有 `xml2bin.exe`：**布局 XML → `.pld` 二进制**，供运行时 PLD loader 使用（开发可用 XML，发布可转 PLD）。

发布建议（官方 README）：开发模式 **不转字节码** 便于看行号；上线前勾选转字节码以压缩/保护。

### 2.5 PC 仿真 / 预览原理

**不是**像 Beken 那样「生成 C → 本机 gcc 编译 LVGL」。  
仿真是运行 SDK 内预编译的 **`simulator.exe`**（依赖 SDL2、FreeType、libpng 等 DLL）：

1. （默认）先打包得到 `app.prc`  
2. 准备/更新工程下 `dist/simulation/rootfs`（从 SDK launcher 等拷贝系统文件）  
3. 将 `app.prc` / `app.json` 放入模拟文件系统（如 launcher 或 download 路径）  
4. VS Code Terminal 以 `simulator.exe` 为 shell，cwd 指向 rootfs 日志目录启动  
5. 模拟器加载与板端同构的 Persim 应用环境，窗口中查看效果  

`projectConfig.simulation` 典型字段：

- `path`：调试应用包路径（如 `./dist/output/original/app.prc`）  
- `fileSystemPath`：根文件系统（如 `./dist/simulation/rootfs`）  
- `simulatorPackage`：启动前是否先打包  

多分辨率时需把仿真路径改到对应分辨率产物。  
文档明确：**最终效果以真机为准**；仿真只做初步验证。

### 2.6 板端运行原理（集成到「SDK / 系统」）

板端不是「include 生成的 C UI」，而是 **系统固件已内置 PersimUI 宿主**，再安装/运行 `.prc`。

参考 `vehicle-persim-dash`：

```c
// main.c
rtt_init();
ubus_init();
drm_init(...);      // 显示
persimui_init();    // 启动 PersimUI
```

`persimui_init()`（`persimui.cpp`）完成：

1. 配置 `SystemPath`（fonts / images / modules / apps / data 等）  
2. 注册图片加载器（PNG、HDC）、字体（TTF）、可选 RGA 绘制引擎  
3. 注册 **`UiXmlLoaderRegisterPersimmon` / `UiPldLoaderRegisterPersimmon`**（及扩展控件 loader）  
4. `framework_init()`、`js_ubus_init()`  
5. `Launcher::launch(...)` 拉起 JS Persimmon 启动器，加载系统/用户应用  

依赖栈（`jspm/README.md`）：

- RT-Thread 3.0+  
- gui_engine / Persimmon（C++ 控件、窗口、signal/slot、手势动画；底层 DC）  
- **JerryScript**（JS 引擎）  
- ezXML 等  

因此「集成到 SDK」的含义是：

| 层 | 职责 |
|----|------|
| 芯片/BSP SDK | 显示、触摸、存储、系统服务（如 ubus） |
| PersimUI 固件组件 | Persimmon + JerryScript + Launcher + 路径与缓存策略 |
| Persim App | Studio 产出的 `.prc`，热更新/安装到 apps 目录即可迭代 UI |

示例仓库用法（`xf-persim-apps/README.md`）：Studio 打开工程 → 开发 → Package project（或 `prc-pkg`）→ **打包结果集成到板卡运行**。

业务与系统解耦常见路径：**ubus** 订阅/发布（车速、油量、ADAS、按键等），JS 侧刷新控件。

### 2.7 设计器画布 vs 真机一致性

- **设计器**：Web（Vue）按控件配置渲染近似预览，改属性写回 XML。  
- **真效果**：仿真器 / 板端由 **同一套 Persimmon 运行时** 解析 XML/PLD + 执行 JS。  

所见即所得主要靠「打包后跑模拟器」，而不是画布等于最终像素引擎。

---

## 3. 主要功能

依据官方 README（Aura studio）、插件命令面、CHANGELOG，以及湃心 OS / 柿饼 UI 公开介绍整理。Studio 本体是 **开发工具功能集**；动效、多 App 商城、OTA 等更多属于 **PersimUI / 湃心运行时与方案**，下文用「Studio / 配套方案」区分。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **工程管理** | 创建/打开工程、最近工程、工程设置、工程升级/迁移、SDK 管理 | 活动栏 PersimStudio；可选 Minimum SDK、分辨率、圆/方屏、APP ID |
| **工程类型** | 应用（application）、挂件/表盘（widget / dial） | 创建向导与打包产物 `app.prc` / `app.dial` 对应 |
| **页面资产** | 新建页面、自定义面板、挂件 | 页面=xml+js；面板≈仅 xml 可改尺寸；挂件写入 `app.json` |
| **可视化设计** | XML Custom Editor：控件库、画布、属性/样式/事件、控件树、对齐与多选 | 文档称常用约 **19** 个内置控件；可切回纯 XML 文本编辑 |
| **编辑增强** | 多选/框选、对齐与等距、跨页复制、画布内改文本、撤销、F7 跳 JS | 事件名双击可生成 JS 函数骨架 |
| **自定义扩展** | 自定义（容器）控件；SDK `widgets` JSON 扩控件 | CHANGELOG：鱼眼/蜂窝列表等；可配自定义属性与事件 |
| **JS 开发** | `@types` + `jsconfig` 智能提示；小程序风 `App`/`Page` 逻辑 | 公开叙事：界面与业务分离；补全覆盖部分 API |
| **资源与字体** | 图片选择（PNG）、图片透明度/质量配置、字库管理 | 2.x 起按 GPU 自动选图格式，开发者少关心像素格式细节 |
| **国际化** | 设计器内语言预览与资源刷新 | 文案/图片切换预览；完整 i18n 见柿饼文档 |
| **多分辨率** | 静态预览、按分辨率生成资源、多分辨率打包与仿真路径 | 同一套工程适配多屏；仿真需指向对应产物路径 |
| **项目打包** | 一键打包、打包前后脚本、可选转字节码、GPU 型号与图压格式 | 产出 `dist/…/app.prc`；亦可命令行 `app_pkg_tool`；可选 XML→PLD |
| **模拟仿真** | 启动/停止/重启模拟器；rootfs + 打包后运行 | SDK 内 `simulator.exe`（SDL）；默认可先打包再跑 |
| **真机下载** | USB / 串口等推送打包结果做真机调试 | 设置里配调试模式；湃心工具链另有 udb 等（方案侧） |
| **性能分析** | 2.0 起 Studio 侧性能分析能力 | 湃心方案另有 fps/CPU 负载等配套工具（方案侧） |
| **自定义 SDK** | 增减 `persimwear-*` 平台目录、系统字体、自定义控件、模拟器资源 | 改 `projectConfig.SDKName` 切换；创建工程可选 SDK |

### 3.2 分模块要点

**（1）工程与向导**  
打开/创建 Persim 工程；配置项目名、路径、APP ID、Minimum SDK、分辨率与屏幕形态。生成标准目录：`.settings/`、`src/pages|res`、`app.js`/`app.json`、`@types`、`jsconfig.json`、`dist/`。

**（2）UI 设计器（核心）**  
打开页面 `*.xml` 进入设计器：拖拽约 19 类常用控件；改位置/大小/层级；编辑属性、样式、事件；控件树调整父子；快捷条对齐；国际化语言预览；字库与多分辨率信息展示。可与文本 XML 模式切换。

**（3）逻辑与资源**  
JS 写业务；事件绑定函数名并一键生成 stub；图片 PNG 导入与批量质量/透明配置；字体增删（系统字体不可删）。

**（4）构建发布闭环**  
打包（脚本钩子、字节码、GPU 图压）→ PC 仿真验证 → 下载到设备。多分辨率可分别打包与仿真。

**（5）扩展与生态（Studio + 方案）**  
自定义控件/SDK；挂件与表盘工程；配套运行时支持动效、多媒体、应用安装升级等（湃心/柿饼公开能力，不完全等同于插件菜单项）。

### 3.3 主要特点（归纳）

- **工具形态：** VS Code 插件，复用编辑/Git/终端生态  
- **开发模型：** XML 布局 + JS 逻辑 + `.prc` 应用包，仿真与板端同构  
- **产品向能力：** 多分辨率、GPU 图压、挂件/表盘、可扩展控件与自定义 SDK  
- **运行时侧（非纯 Studio）：** Persimmon 控件与动效、JerryScript、ubus 等系统桥；示例见 `a-cockpit` / `xfzk` / `vehicle-persim-dash`  

---

## 4. 优点

| 维度 | 说明 |
|------|------|
| **应用与固件解耦** | UI 以 `.prc` 迭代，不必每次改 UI 都全量重编固件（宿主已就绪时） |
| **VS Code 生态** | 调试、Git、补全、扩展可直接复用，比独立闭源 IDE 更贴前端/脚本开发习惯 |
| **XML+JS 分工清晰** | 布局可视化、逻辑用 JS；事件绑定到函数名，业务可读性较好 |
| **仿真与板端同构** | 同一套应用包 + 同类运行时，比「画布 DOM 近似」更接近真机行为 |
| **面向产品级 HMI** | 仪表、多页应用、ubus、表盘/挂件、多分辨率、GPU 图压，适合车载/穿戴等 RTT 方案 |
| **可扩展控件与 SDK** | SDK 目录可定制；widgets JSON / layout-desc 可扩展设计器控件 |
| **发布保护手段** | 可选字节码 snapshot，降低明文 JS 直接暴露风险 |
| **文档与示例齐全** | Studio README 覆盖创建、设计、打包、仿真、下载、自定义 SDK；本地有完整 apps + 板端仓库 |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **强绑定 Persimmon / RTT 生态** | 不是标准 LVGL 源码导出；换到纯 LVGL 或其他 GUI 栈基本不可直接复用 |
| **运行时授权与闭源倾向** | JS Persimmon 等组件文档声明禁止随意传播源码；商业使用需按 RT-Thread 授权体系评估 |
| **仅 Windows 设计器** | 插件官方仅支持 Windows；团队跨平台协作受限 |
| **学习曲线偏「产品框架」** | 需同时理解 Persim App 模型、ubus、打包配置、rootfs、宿主集成，比「只会 LVGL API」门槛高 |
| **设计器预览 ≠ 最终渲染** | 画布是 Web 近似；必须以模拟器/真机验收 |
| **JS 性能与内存边界** | 嵌入式 JerryScript 对复杂逻辑、大对象、高频刷新有天然上限，重动画/大数据要克制 |
| **宿主集成成本高** | 首次上板需完整 PersimUI 栈（显示、路径、Launcher、包管理）；不是「丢几个 .c 进工程」 |
| **工具链体积与二进制依赖** | SDK 含 simulator、多种转换工具；版本升级需同步 SDK/模拟器 |
| **命名体系多** | Aura / Persim Studio / PersimUI / Persimmon / 柿饼并存，资料检索与新人认知有成本 |

---

## 6. 与同类方案对比（简表）

| 对比项 | Persim Studio | BEKEN LVGL UI Designer | SquareLine | ArtInChip UIBuilder | FlyThings IDE |
|--------|---------------|------------------------|------------|---------------------|---------------|
| 图形库 | Persimmon（自研/厂商栈） | LVGL | LVGL | LVGL | EasyUI（厂商） |
| 设计器形态 | VS Code 插件 | Electron 独立 App | 独立 App | Qt 独立 App | 独立 IDE |
| 工程源 | XML + JS | JSON `.bkprj` | 专有工程 | XML/工程文件 | 专有工程 |
| 产出 | `.prc` / `.dial` 应用包 | C / MicroPython 源码 | C/MP 源码 | C 源码 + SDK 拷贝 | UI 包 + so |
| 运行模型 | 宿主解释/执行应用包 | 编译进固件 | 同左 | 同左 | 宿主 + 解释 |
| PC 仿真 | 预编译 simulator.exe | 生成 C + 本机编译 | 有 | SDL 仿真 | 预览/下载为主 |
| 平台锁定 | 强（PersimUI/RTT） | 弱（LVGL 可移植） | 弱 | 偏芯片 SDK | 强 |
| 适合场景 | RTT 车机/穿戴等 Persim 方案 | 通用 LVGL HMI | 通用 LVGL | ArtInChip 方案 | 智能串口屏 |

选型要点：

- 已选定 **RT-Thread + PersimUI** → Persim Studio 是匹配工具。  
- 目标是 **跨芯片 LVGL 静态固件** → 应看 Beken / SquareLine / UIBuilder，而不是 Persim。  
- 需要 **UI 热更新、应用包安装** → Persim / FlyThings 一类更合适。

---

## 7. 适用与不适用

**较适合**

- 已采用或计划采用 **Persimmon / PersimUI** 的 RT-Thread 产品（仪表、座舱、穿戴等）  
- 希望 UI 以应用包形式迭代，与系统服务（ubus 等）解耦  
- 团队熟悉或可接受 **JS 脚本 + XML 布局** 开发方式  
- 需要多分辨率、GPU 图压、表盘/挂件等产品化能力  

**不太适合**

- 只要标准 **LVGL C 源码**、希望最大跨平台移植  
- 无 PersimUI 宿主、也不打算引入 JerryScript/Persimmon 的裸机/轻量工程  
- 需要 macOS/Linux 原生设计器  
- 极端资源受限、无法承担 JS 引擎与 C++ GUI 栈的 MCU 场景  

---

## 8. 结论

Persim Studio（Aura Studio）的实现本质是：

> **VS Code 插件（Vue 设计器）编辑 Persim App 的 XML 布局与 JS 逻辑 → 工具链打包为 `.prc`（可选字节码与 GPU 图压）→ SDK 内 SDL 模拟器或板端 Persimmon+JerryScript 宿主加载运行。**

**主要功能面**覆盖：工程管理、可视化设计（含约 19 常用控件）、页面/面板/挂件、JS 补全与事件骨架、资源/字体/国际化预览、多分辨率、打包（脚本/字节码/GPU 图压）、仿真启停、真机下载、自定义控件与 SDK、以及 2.0 性能分析等。

它站在 **RT-Thread 柿饼（Persimmon）生态** 上，走的是 **动态应用包 + 解释执行** 路线；强项是 VS Code 工作流、应用/固件解耦、仿真与板端同构、车机类示例完整；弱项是生态锁定、Windows 限定、首次宿主集成成本，以及与主流 LVGL 工具链不可互通。

若对标本仓库其它 UI 工具：**与 Beken/ArtInChip/LVGL Pro 不是同一赛道**；更应与 **FlyThings 式「专有运行时 + 包/资源上板」** 对照理解。

---

## 9. 参考资料

1. 安装包：`rt-thread/persim-studio-3.3.0.vsix`  
2. 插件与文档：`rt-thread/xf-persim-studio/README.md`、`docs/development.md`、`CHANGELOG.md`、`package.json`  
3. 内置 SDK：`xf-persim-studio/persim-sdk/platforms/persimwear-2`、`persim-sdk/tools/*`  
4. 示例应用：`rt-thread/xf-persim-apps`（含 `README.md`、`1024x600/a-cockpit`、`xfzk`）  
5. 板端宿主：`rt-thread/vehicle-persim-dash`（`main.c`、`persimui.cpp`、`persim-packages/persimmon`）  
6. 运行时说明：`persimmon/README.md`、`persimmon/jspm/README.md`、`layout-desc/README.md`、`tools/layout-compiler`、`xml2bin`  
7. 打包工具说明：`xf-persim-apps/tools/prc-pkg/README.md`  
8. 产品介绍：`rt-thread/a-cockpit总体介绍.pptx`  

---

*文档基于本地仓库与安装包静态分析，未替代 RT-Thread 官方授权与最新在线手册；版本以本地 3.3.0 / persimwear-2 为准。*
