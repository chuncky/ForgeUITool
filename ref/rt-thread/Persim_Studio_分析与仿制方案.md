# Persim Studio（Aura Studio）：分析与仿制方案

> 综合 `Persim_Studio分析文档.md`、`Persim_Studio_仿制方案.md`、本地 `xf-persim-studio` / `persim-studio-3.3.0.vsix` / `xf-persim-apps` / `vehicle-persim-dash`，以及公开资料（睿赛德柿饼 UI、湃心 OS / Persim Studio 产品页、社区教程、JerryScript on RT-Thread 等）。  
> 对象：**Persim Studio / Aura Studio**（面向 PersimUI / Persimmon「柿饼」的可视化设计与 JS 轻应用工具）。  
> 结构：**上篇分析**（定位 / 原理 / 特点 / 优劣）+ **下篇仿制**（合规 / 目标 / 分期 / 工作拆分）。  
> **仿制约定：** 能力对齐、**格式自有**；不搬运闭源二进制与官方 `.prc` / `rtgui` 方言。  
> 竞品逆向 + 兼容重构设计说明：[`Persim_Studio_竞品逆向与重构设计说明.md`](./Persim_Studio_竞品逆向与重构设计说明.md)。

命名说明：对外常称 **Aura studio**；插件包名 / VSIX 为 **persim-studio**；图形栈为 **Persimmon（柿饼）**；业务层常称 **PersimUI / Persim App**。早期工具亦称 Persimmon UI Builder / PersimUI Builder。

---

# 上篇：工具分析

## 1. 产品定位

Persim Studio 是 RT-Thread / 睿赛德生态的 **嵌入式 UI 可视化设计与 JS 应用开发环境**。它不是「拖拽后导出 LVGL C」一类工具，而是典型的 **小程序 / 动态应用包** 模型：

- PC 上用 **VS Code 插件**做可视化 XML 布局 + 手写 JS 业务  
- 打包成 **`app.prc`**（或表盘 `app.dial`）  
- 由板端 **Persimmon + JerryScript** 运行时加载执行  

公开宣传（柿饼 UI / 湃心 OS）强调：类 Android 触控与动效、设计器所见即所得仿真、USB 下载、JS 轻应用与多 App 升级、嵌入式 GPU、基于 RT-Thread 内核。定位更接近 **FlyThings / 智能屏小程序**，而非 SquareLine、BEKEN、ArtInChip 的 **CodeGen → 静态链接固件** 路线。

| 项 | 内容 |
|----|------|
| 本地安装包 | `rt-thread/persim-studio-3.3.0.vsix` |
| 插件源码 | `xf-persim-studio`（**3.3.0**，publisher RT-Thread） |
| 内置 SDK | `persim-sdk/platforms/persimwear-2`（Vehicle PersimUI V2.0.0，apiLevel 2） |
| 示例 App | `xf-persim-apps`（`a-cockpit`、`xfzk` 等） |
| 板端参考 | `vehicle-persim-dash` |
| 设计器环境 | **Windows + VS Code**（engines ≥ 1.50；文档建议 > 1.52） |
| 板端 OS | **RT-Thread** + Persimmon / JerryScript |
| 产品页线索 | https://www.rt-thread.com/persimos/ |

一句话：

> **VS Code 设计器编辑 XML+JS → 打包 `.prc` → 模拟器或板端 PersimUI 宿主加载；UI 与固件可解耦。**

---

## 2. 实现原理

### 2.1 一句话与易混点

> **设计期编辑 XML+JS；打包期产出可安装应用包；运行期 Persimmon 画控件 + JerryScript 跑逻辑；仿真与板端共用同一套包模型。**

易混点：

- **不是**把 Vue 画布编译成 C；权威数据是工程目录里的 XML/JS。  
- **不是** LVGL 源码导出；板上有 **专有 GUI 运行时**（Persimmon），再装包。  
- 设计器画布是 **Web 近似**；真效果靠 **simulator / 真机**。

### 2.2 总体架构

```text
┌─────────────────────────────────────────────────────────────────┐
│  Persim Studio（VS Code Extension / VSIX）                       │
│  main：工程 / 打包 / 仿真 / 下载 / SDK                             │
│  web-designer：Vue3 Custom Editor（*.xml）                       │
│  persim-sdk：@types、控件 JSON、launcher、simulator.exe、工具链   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 读写工程源码
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Persim App：pages/*.xml + *.js、app.js/json、res/、.settings/   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ prcbuild；可选 Jerry snapshot、GPU 图压
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  dist/.../app.prc（或 app.dial）                                  │
└───────────────┬─────────────────────────────┬───────────────────┘
                ▼                             ▼
     PC：simulator.exe + rootfs        板端：PersimUI 宿主
     SDL2 同构加载                      XML/PLD + JerryScript
```

### 2.3 技术栈（本地可核对）

| 层次 | 技术 |
|------|------|
| 插件壳 | VS Code Extension → `dist/extension.js` |
| 设计器 | **Vue3 + Vite + Element Plus + TS** |
| 插件后端 | Node/TS（pack、simulation、download） |
| 构建 | pnpm + turbo + tsup + `@vscode/vsce` |
| 布局源 | **rtgui XML** 控件树 |
| 逻辑 | **JS**（`App` / `Page` 生命周期，小程序风格） |
| 引擎 | **JerryScript**；可选 snapshot 字节码 |
| GUI | **Persimmon**（C++，signal/slot，DC 绘图） |
| 仿真 | 预编译 **simulator.exe**（SDL2 等），非本机编 C |
| 打包 | `app_pkg_tool.exe`；可选 `xml2bin`→`.pld` |

`persim-sdk` 要点：`platforms/persimwear-*`（API、fonts、lib、widgets、simulation）+ `tools/`（prcbuild、jerry_snapshot、convertImg、multiPixel、udb）。

### 2.4 工程模型

权威数据是 **目录树明文源码**（非单一 `.bkprj`）。

- **XML**：`<rtgui>` / `<widget class="Page|Label|…">` + `<property>`  
- **JS**：`Page({ onLoad, onShow… })`、`setData`、`pm.*`；车机示例常用 `ubus`  
- **app.js / app.json**：入口页、id、apiLevel、icon  
- **.settings/projectConfig.json**：分辨率、SDKName、仿真/打包/下载  

控件描述：运行时 `layout-desc` YAML → 设计器 JSON；SDK `widgets/` 可扩自定义控件。

### 2.5 打包

1. 可选打包前脚本  
2. 源码处理；可选 uglify + **jerry_snapshot**  
3. 图片按透明度/质量/**GPU**（png / ezip / etc2…）转换  
4. `app_pkg_tool` → `app.prc` / `app.dial`  
5. 可选打包后脚本 → `dist/output/original/`（多分辨率有子目录）  

开发建议不转字节码（保行号）；发布再转。另可 XML→PLD 供二进制 loader。

### 2.6 PC 仿真

与 Beken「生成 C + gcc」不同：直接跑 SDK 内 **simulator.exe**。

默认：打包 → 准备 `dist/simulation/rootfs` → 放入 `app.prc` → Terminal 启模拟器。  
配置：`simulation.path` / `fileSystemPath` / `simulatorPackage`。  
**最终以真机为准。**

### 2.7 板端集成

固件先内置 PersimUI 宿主，再装 `.prc`（不是 include 生成 C）。

参考 `vehicle-persim-dash`：`rtt_init` → `ubus_init` → 显示（如 DRM）→ `persimui_init`（路径、图/字体、XML/PLD loader、framework、Launcher）。

| 层 | 职责 |
|----|------|
| BSP / 芯片 SDK | 显示、触摸、存储、系统服务 |
| PersimUI 固件 | Persimmon + JerryScript + Launcher |
| Persim App | Studio 产出的包，可迭代安装 |

业务解耦常见路径：**ubus** 推车速/油量等，JS 刷新控件。

---

## 3. 主要功能

依据官方 README（Aura studio）、插件命令面、CHANGELOG，以及湃心 OS / 柿饼 UI 公开介绍。Studio 是 **开发工具功能集**；动效、应用商城、OTA 等更多属 **PersimUI / 湃心方案**，表中已区分。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **工程管理** | 创建/打开工程、最近工程、设置、升级/迁移、SDK 管理 | Minimum SDK、分辨率、圆/方屏、APP ID |
| **工程类型** | 应用、挂件/表盘 | 产物 `app.prc` / `app.dial` |
| **页面资产** | 新建页面、自定义面板、挂件 | 页面 xml+js；面板偏纯 xml；挂件登记到 `app.json` |
| **可视化设计** | 控件库/画布/属性样式事件/控件树/对齐多选；约 19 常用控件 | XML Custom Editor；可切文本 XML |
| **编辑增强** | 多选对齐、跨页复制、画布改字、撤销、F7→JS、事件双击生成 stub | — |
| **自定义扩展** | 自定义容器控件；SDK widgets JSON | 含鱼眼/蜂窝等扩展控件叙事 |
| **JS 开发** | `@types` 补全；`App`/`Page` 业务逻辑 | 界面与逻辑分离（公开小程序叙事） |
| **资源字体** | PNG 图、透明/质量配置、字库管理 | 2.x 起按 GPU 自动选图格式 |
| **国际化** | 设计器语言预览与资源刷新 | 完整 i18n 见柿饼文档 |
| **多分辨率** | 预览、生成资源、多分辨率打包/仿真 | 仿真需改产物路径 |
| **打包** | 一键打包、前后脚本、可选字节码、GPU 图压 | 亦可 `app_pkg_tool`；可选 XML→PLD |
| **仿真** | 启停/重启模拟器 | `simulator.exe` + rootfs；默认可先打包 |
| **真机下载** | USB/串口等推包调试 | 设置配模式；方案侧另有 udb 等 |
| **性能分析** | Studio 2.0+ 性能分析 | 方案侧另有 fps/CPU 工具 |
| **自定义 SDK** | `persimwear-*` 平台目录可扩展 | 字体/控件/模拟器资源可裁剪 |

### 3.2 闭环主路径

```text
创建工程 → 拖拽 XML 布局 → 写 JS →（可选多分辨率/图压配置）
  → 打包 app.prc → PC 仿真 → 真机下载 → 板端 PersimUI 宿主运行
```

### 3.3 特点摘要

- VS Code 插件工作流；XML+JS+`.prc`；仿真与板端同构  
- 多分辨率、GPU 图压、挂件/表盘、可扩展控件与自定义 SDK  
- 运行时侧：Persimmon 动效/控件、JerryScript、ubus；示例 `a-cockpit` / `xfzk` / `vehicle-persim-dash`  

---

## 4. 优劣与对比

### 4.1 优点

应用/固件解耦；VS Code 生态；XML+JS 分工清晰；仿真同构；车机/穿戴产品化能力全；控件与 SDK 可扩展；可选字节码保护。

### 4.2 缺点

强绑 Persimmon/RTT；运行时授权/闭源倾向；仅 Windows 设计器；学习曲线含宿主/ubus/rootfs；画布≠真渲染；JS 性能边界；首次宿主集成重；命名体系杂（Aura/Persim/柿饼）。

### 4.3 对比简表

| 对比项 | Persim Studio | BEKEN / SquareLine | FlyThings |
|--------|---------------|--------------------|-----------|
| 图形库 | Persimmon | LVGL | EasyUI |
| 产出 | `.prc` 应用包 | C/MP 源码 | UI 包 + so |
| 运行 | 宿主解释执行 | 编译进固件 | 宿主 + 解释 |
| 锁定 | 强 | 弱（LVGL） | 强 |

**选型：** 已定 RTT+PersimUI → Studio；要跨芯片 LVGL 静态固件 → Beken 等；要热更新应用包 → Persim / FlyThings 类。

### 4.4 适用

适合：PersimUI 产品、包迭代、接受 JS+XML、要多分辨率/挂件等。  
不适合：只要 LVGL C、无宿主预算、要 macOS/Linux 设计器、极低端 MCU。

### 4.5 分析结论

站在 **柿饼生态** 上的 **设计器 + 轻应用工具链**；功能面覆盖工程→设计→打包→仿真→下载；强项是 VS Code、包解耦、仿真同构；弱项是生态锁定与宿主成本。与本仓库 Beken/LVGL Pro **不同赛道**。

---

# 下篇：仿制方案

## 5. 合规与目标（先锁死）

### 5.1 双锁定

| 维度 | 约定 |
|------|------|
| **能力** | 对齐公开能力面：工程、可视化布局、JS、打包、仿真、下载、可扩展控件/SDK |
| **格式** | **自有** 布局方言 + **自有** 包格式；**不**承诺兼容官方 `rtgui` XML / `.prc` / `.pld` |
| **运行时** | 自研或开源可授权栈；**不**搬 `simulator.exe`、`app_pkg_tool`、Persimmon 闭源、VSIX 二进制 |
| **品牌** | 自有名称；勿冒充官方 |

必须官方格式与量产支持 → **采购/授权 PersimUI**，勿走本文兼容路线。

禁止：反编译重发包内闭源工具；把官方方言/`.prc` 当对外兼容层；再分发标注禁止传播的 JS Persimmon 源码。

### 5.2 仿制目标

> **自研 Studio ↔ 自有布局 + JS ↔ 自有打包器 → 自研模拟器与板端宿主加载运行。**

MVP：**拖两页 → 写少量 JS → pack → PC 可点选 → 板端最小宿主可装同包。**

### 5.3 能力对齐（落点自有）

对标上篇 **§3 主要功能**；MVP 优先：工程、设计器、JS 最小 API、pack、sim、板端装包。其余按 V1/V2。

| 原厂能力 | 仿制 | 不要 |
|----------|------|------|
| 工程管理 / SDK 管理 | 自研向导与配置；V1 多 SDK | 官方品牌/魔数 |
| VS Code Custom Editor + ~19 控件 | 自研 Extension；MVP 8～12 控件 | 官方 id；官方 Persim XML |
| 页面/面板/挂件 | 自有模板；挂件 V2 | 官方挂件协议兼容 |
| App/Page JS + 补全 + 事件 stub | 自定 API + `@types`；stub 放 V1 | 官方 `pm.*` 全集 |
| `app.prc` + 脚本/字节码/GPU 图压 | `app.uipkg`；字节码 V1；GPU 按需 | 兼容 `.prc`；无授权私有图格式 |
| simulator 启停重启 | 自研 `ui-sim` | 官方 exe |
| 真机下载 / 多分辨率 / i18n / 字库 / 自定义控件与 SDK / 性能分析 | 见分期：下载·i18n·控件·SDK→V1；多分辨率→V2 | 闭源协议与工具原样搬迁 |

### 5.4 路线选择

| 路线 | 含义 | 适用 |
|------|------|------|
| **A. 范式仿制（默认）** | 自有格式 + JerryScript +（LVGL 桥或自研 GUI） | 要自控 IP、可对外交付 |
| **B. 工具层仿制** | 只做 IDE UX，宿主仍用已授权 PersimUI | 已是官方客户；价值有限 |

目标若是 **LVGL 出 C** → **不要仿 Persim**，走 Beken/SquareLine 类。

---

## 6. 目标架构与分期

### 6.1 目标架构

```text
Studio（VS Code / Electron）
    → 自有工程（layout.json|xml + js + app 元数据）
    → ui-pack → app.uipkg
         ├─ ui-sim（SDL）
         └─ 板端 Host（显示/输入 + JS VM + loader + 包管理）
```

概念映射：Studio→自研 Studio；rtgui→自有 Schema；Persimmon→自研/LVGL 桥；prc→uipkg；simulator→ui-sim。

### 6.2 分期

**MVP：** 8～12 控件；五区设计器；pack+sim；板端最小宿主；不做多分辨率/私有图压/商城/官方兼容。  

**V1：** 自定义控件、事件 stub、`@types`、可选字节码、i18n 基础、推包、多 apiLevel SDK。  

**V2：** 多分辨率、挂件、动效、类 ubus IPC、可选 MCP/示例库。  

**永不做：** 官方格式兼容承诺；搬闭源模拟器。

### 6.3 工作拆分

| 序号 | 工作包 | 周期 | 交付 |
|------|--------|------|------|
| 0 | 合规 + 选路线 A/B | 2～3 天 | 决策与禁止清单 |
| 1 | Schema + Hello 工程 | 1～2 周 | 可校验示例双页 |
| 2 | 运行时（树+loader+JS Binding） | 1～2 月 | PC 可代码驱动 UI+JS |
| 3 | `ui-pack` | 1～2 周 | 目录→uipkg |
| 4 | `ui-sim` | 2～4 周 | SDL 加载包 |
| 5 | Studio 设计器 | 2～3 月 | 拖完即可 pack+sim |
| 6 | 板端 Host 端口 | 1～2 月 | 装包启动 |
| 7～8 | V1 / V2 | 按需 | 见分期 |

**顺序：0→1→2→3→4，再 5。** 先包与运行时，后设计器（相对 Beken「先 CodeGen」，此处是 **pack + host**）。

人力：运行时 1～2、工具链 1、前端 1～2、板级 1。  
MVP **6～10 人月**；V1 **12～18 人月**；湃心级产品面（GPU/商城/多芯片）**20+ 人月**。

---

## 7. 工程格式、运行时与设计器

### 7.1 工程与包（建议）

目录形态可接近 Studio（降学习成本），**方言必须不同**：

```text
MyApp/
  .settings/projectConfig.json
  @types/  jsconfig.json
  src/app.js  app.json
  src/pages/main/main.layout.json  main.js
  src/res/...
  dist/output/original/app.uipkg
  dist/simulation/rootfs/
```

布局优先 **JSON**（易校验/AI）；若用 XML，自有根节点与属性，勿抄 `rtgui`。  
`app.uipkg`：`manifest.json` + js/字节码 + pages + res。禁止以解析官方 `.prc` 为对外目标。

### 7.2 运行时（路线 A）

| 层 | 推荐 |
|----|------|
| JS | JerryScript（RTT 有开源移植）或 QuickJS |
| GUI | **A1 LVGL+JS 桥**（成本低）或 **A2 自研 Widget**（更像柿饼、更贵） |
| 布局 | 自有 loader，与设计器共用 Schema |
| 包 | `/apps/<id>/` + Launcher |

MVP Binding 最小集：`setText` / `onClick` / `navigate`。公开课程亦强调 JS↔C；Native 模块是长期项。  
宿主顺序对齐原厂概念：路径 → 图/字体 → loader → launch；实现全自有。  
仿真：`ui-pack` → rootfs → `ui-sim`；Studio 子进程拉起，不复制官方 exe。

### 7.3 设计器（工作包 5）

- **壳：** VS Code Extension（推荐）或 Electron/Tauri  
- **栈：** Vue3 + Vite + Element Plus + TS；Node 调 pack/sim  
- **模块：** 工程、控件库（widgets JSON）、画布 DOM 近似、树/属性/事件、JS stub、打包仿真、V1 下载  
- **顺序：** 读写工程 → 只读渲染 → 拖+属性 → 树/撤销 → pack/sim → 事件/资源  
- **注册表：** id/label/isContainer/props；设计器与运行时同源，避免「设计器有、板上无」

### 7.4 板端文档交付

Host 移植指南；JS Native 模块指南；最小 Demo BSP；apiLevel↔SDK 目录策略。  
验收：同一 uipkg 在 sim 与板端交互/数据流一致（允许像素差）。

---

## 8. 验收、风险与选型

### 8.1 验收

**MVP：** 设计器拖出双页基础 UI；JS 切页改文案；pack+sim；板端同包可跑；格式非官方 Persim/prc。  
**V1：** 自定义控件、可选字节码、至少一种推送、多 SDK 版本。  
**V2：** 多分辨率或挂件或 IPC 仪表页至少一项过关。

### 8.2 风险

| 风险 | 对策 |
|------|------|
| 低估运行时 | 工期重心 Host+Binding；可先 LVGL 桥 |
| 画布≠真机 | 强制 sim/板端验收 |
| JS 性能 | 重逻辑下沉 C；写明 MCU 下限 |
| 要求兼容柿饼 | 拒绝；应买原厂 |
| 与 LVGL 路线混淆 | 立项写清「应用包」还是「生成 C」 |

### 8.3 选型

| 诉求 | 建议 |
|------|------|
| 官方 PersimUI 量产 | 用官方 Studio |
| 自有 JS 轻应用 + 包升级 | **下篇路线 A** |
| LVGL 可视化出 C | **仿 Beken，不仿 Persim** |
| 只要 IDE 皮 | 无运行时则无闭环 |

---

## 9. 总结论

| 维度 | 结论 |
|------|------|
| 原厂本质 | VS Code + XML/JS 轻应用 + `.prc` + Persimmon/JerryScript |
| 主要功能 | 工程管理、可视化设计、JS 业务、资源/多分辨率、打包、仿真、下载、自定义 SDK/控件 |
| 公开叙事 | 快速出 UI、仿真、多 App 升级、GPU、穿戴/车机 Turnkey |
| 仿制抓手 | **自有 Schema → 运行时+pack → sim → Studio → 板端 Host** |
| 合规 | 能力对齐、格式自有；不搬闭源与官方包格式 |
| 成功标准 | 同一自有应用包在仿真与板端可点选运行并可迭代安装 |

---

## 10. 参考资料

**本地**

1. `Persim_Studio分析文档.md`、`Persim_Studio_仿制方案.md`（本文为其综合稿）  
2. `persim-studio-3.3.0.vsix`、`xf-persim-studio`、`persim-sdk`  
3. `xf-persim-apps`、`vehicle-persim-dash`、`a-cockpit总体介绍.pptx`  

**网上**

4. 湃心 OS：https://www.rt-thread.com/persimos/  
5. 柿饼 UI / PersimUI Builder 公开介绍与社区教程（仿真、USB、JS↔C、SDK 适配）  
6. JerryScript on RT-Thread：https://github.com/RT-Thread-packages/jerryscript  

---

*综合稿以本地 3.3.0 / persimwear-2 与公开产品叙述为准；量产授权、商标与许可以法务结论为准。*
