# Persim Studio 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** RT-Thread Persim Studio / Aura Studio（本地线索 3.3.0）及配套 PersimUI / Persimmon 轻应用范式  
> **输入材料：** `rt-thread/xf-persim-studio`、`persim-studio-3.3.0.vsix`、`xf-persim-apps`、`vehicle-persim-dash`；既有分析/仿制文档；湃心 OS / 柿饼 UI 公开介绍  
> **关联文档：** `Persim_Studio分析文档.md`、`Persim_Studio_仿制方案.md`、`Persim_Studio_分析与仿制方案.md`  
> **重构产品暂名：** **LiteApp Studio**（可替换）；运行时暂名 **LiteApp Runtime**；应用包暂名 **`.uipkg`**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 Persim Studio 所代表的 **VS Code 可视化设计 + XML/JS 轻应用 + 应用包安装 + 模拟器/板端宿主** 范式进行结构化拆解，并据此设计一套 **功能兼容、格式与运行时自有** 的替代工具链。

竞品与 SquareLine / BEKEN（导出 LVGL C）不同：核心是 **动态应用包 + JS 解释执行**，更接近 FlyThings / 湃心「轻应用」叙事。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清 Studio 分层、数据流、打包/仿真/宿主边界与功能面 |
| **功能兼容** | 覆盖竞品主路径：工程 → 设计 → JS → 打包 → 仿真 → 下载 → 板上跑 |
| **格式自有** | 布局方言、包格式、API 命名空间自研；**默认不**做官方 `.prc` / `rtgui` 二进制兼容 |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 依赖开源可授权组件（如 JerryScript、LVGL 或自研 GUI）；不搬运竞品闭源二进制 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 工作流、面板布局、操作习惯接近 Studio | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见 §3 / 分析文档 §3） | ✅ 目标 |
| **L3 API 形似** | JS 生命周期形似 `App`/`Page`，便于迁移心智 | ✅ 可选形似，**非**官方 API 全集兼容 |
| **L4 工程兼容** | 直接打开官方 Persim 工程 / 读写 `rtgui` XML | ❌ 默认不做 |
| **L5 包/运行时兼容** | 官方 `.prc` 可在自研宿主跑，或自研包可在官方 PersimUI 跑 | ❌ 默认不做（需官方授权且成本极高） |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 **官方生态二进制兼容器**。若必须 L4/L5 → 采购/授权 PersimUI，不走本文重构主线。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先运行时后设计器** | 先打通 Schema → Runtime → pack → sim，再做 VS Code 设计器 |
| **单一权威模型** | 布局 Schema 同时服务设计器、loader、校验器 |
| **包与固件解耦** | UI 以 `uipkg` 迭代；宿主固件相对稳定 |
| **注册表扩展** | 控件用 JSON 注册表扩展，避免硬编码 |
| **合规优先** | 禁止反编译/重发竞品 VSIX、simulator、prcbuild、闭源 Persimmon |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | 插件 monorepo、`persim-sdk`、板端 `persimui_init` | 读源码/目录，不逆向闭源 exe |
| 行为逆向 | 打包流水线、仿真启动参数、工程目录约定 | 对照 README / 示例工程 |
| 功能逆向 | 命令面、设计器分区、CHANGELOG、湃心工具清单 | 公开能力面 |
| 不做 | 反汇编 `simulator.exe` / `app_pkg_tool`、破解字节码保护、复制品牌资源 | — |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | Persim Studio / Aura studio；包名 `persim-studio` |
| 形态 | **VS Code Extension（VSIX）**，Windows |
| 版本线索 | 本地 **3.3.0**；SDK 例 `persimwear-2` |
| 定位 | 柿饼/湃心生态的 UI 设计与 JS 轻应用 IDE |
| 商业/授权 | 运行时与部分组件偏商业授权；JS Persimmon 等有传播限制声明 |
| 公开叙事 | 拖拽 + JS、模拟器免硬件、多 App/升级、GPU、类 Android 触控 |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L5 工具层  Persim Studio（VS Code）                          │
│   packages/main     工程/打包/仿真/下载/升级/SDK              │
│   packages/web-designer  Vue3 可视化设计器（Custom Editor） │
│   packages/project-manage / utils                           │
├─────────────────────────────────────────────────────────────┤
│ L4 SDK 层  persim-sdk/platforms/persimwear-*                 │
│   @types、widgets JSON、launcher rootfs、simulator.exe、tools │
├─────────────────────────────────────────────────────────────┤
│ L3 应用层  Persim App（用户工程）                             │
│   XML 布局 + JS 逻辑 + res → 打包 app.prc / app.dial         │
├─────────────────────────────────────────────────────────────┤
│ L2 运行时  Persimmon(C++ GUI) + JerryScript + Loader(XML/PLD)│
│   Launcher、SystemPath、图/字缓存、可选 RGA/GPU               │
├─────────────────────────────────────────────────────────────┤
│ L1 系统层  RT-Thread / Linux + 显示触摸 FS + ubus 等服务      │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：** Studio（L5）可替换；真正护城河在 **L2 运行时 + L4 SDK 工具链**。只仿设计器而无 Runtime/pack，无法形成兼容级产品。

### 2.3 数据流逆向

```text
设计器改 XML/属性
    → 工程目录（权威源）
    → package.ts：备份/混淆/jerry_snapshot/图片锻造/prcbuild
    → app.prc
    → simulation.ts：写入 rootfs → 拉起 simulator.exe
    → 板端：persimui_init → Launcher 装载同构包
```

与 Beken 对比：竞品 **不生成 LVGL C**；验收物是 **包 + 宿主**，不是 `ui_init.c`。

### 2.4 模块逆向（Studio 侧）

| 竞品模块（本地） | 职责 | 重构对应 |
|------------------|------|----------|
| `extension.ts` / contributes | 激活、命令、Custom Editor、视图 | `liteapp-extension` |
| `web-designer` | Vue 画布/属性/树 | `liteapp-designer` |
| `projectManager` / `ProjectConfig` | 工程与 `.settings` | `ProjectService` |
| `packages/package.ts` | 打包流水线 | `ui-pack` CLI |
| `simulation/simulation.ts` | 启停模拟器、rootfs | `ui-sim` + SimOrchestrator |
| `download` | 真机推送 | `DeviceBridge` |
| `multiPixel` / `coverImg` | 多分辨率、图压 | `ResPipeline` |
| `upgradeApi` / `versionUpdate` | 工程迁移 | `ProjectMigrator` |
| `persim-sdk/tools/*` | prcbuild、snapshot、convertImg、udb | 自研等价工具，**不复制 exe** |

### 2.5 宿主逆向（板端）

`vehicle-persim-dash` 显示典型启动序：

1. OS / 总线初始化（如 ubus）  
2. 显示 port（如 DRM）  
3. `SystemPath` 挂载 fonts/images/modules/apps…  
4. 注册 Image/Font loader、可选 PaintEngine  
5. 注册 XML/PLD Widget loader  
6. `Launcher::launch` 进入 JS 应用框架  

重构宿主应保持 **同序、换实现**。

### 2.6 功能面逆向摘要

主路径功能：工程管理、页面/面板/挂件、可视化设计（约 19 控件）、JS 补全与事件 stub、资源/字体/i18n 预览、多分辨率、打包（脚本/字节码/GPU）、仿真启停、真机下载、自定义控件与 SDK、性能分析（2.0+）。  
详见分析文档 **§3 主要功能**。

### 2.7 竞品优劣（对重构的启示）

| 启示 | 行动 |
|------|------|
| 包模型是核心价值 | 重构必须做 pack + host，不能只做画布 |
| 画布仅为近似 | 仿真验收强制化 |
| SDK 内嵌模拟器降低门槛 | 自研 `ui-sim` 随 SDK 分发 |
| 生态锁定强 | 自有格式避免被官方协议绑架 |
| 宿主集成重 | 提供最小 BSP Demo 与移植指南 |

### 2.8 竞品与替代赛道

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| JS 轻应用 + 包升级 | **本文（Persim 范式）** |
| LVGL 导出 C | Beken / UIBuilder 类设计说明，非本文 |
| 官方 Persim 量产兼容 | 买官方，不重构 L4/L5 兼容层 |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| Studio 插件或等价桌面壳 | 官方 `.prc` 编解码兼容 |
| 自有布局 Schema + JS API | 官方 `pm.*` / ubus 协议 1:1 |
| `ui-pack` / `ui-sim` / 板端 Host | 搬运 Persimmon 闭源库 |
| 控件注册表与最小控件集 | 湃心应用商城 / FOTA 全套（可二期概念对齐） |
| 文档与最小 Demo | 品牌与营销素材复用 |

### 3.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  LiteApp Studio（VS Code Extension 推荐）                     │
│  Extension Host：Project / Pack / Sim / Download / SDK Mgmt  │
│  Webview Designer：Vue3 画布 + 属性 + 树 + 控件库              │
└──────────────────────────────┬───────────────────────────────┘
                               │ 读写工程（自有 Schema）
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  App Project                                                  │
│  src/pages/**/layout.json + page.js                           │
│  src/app.js + app.json + res/ + .settings/                    │
└──────────────────────────────┬───────────────────────────────┘
                               │ ui-pack
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  app.uipkg = manifest + layouts + scripts(+bytecode) + assets │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     ui-sim（SDL / 可选 Wasm）          LiteApp Host（板端）
     + simulation rootfs                Display/Input/FS + JS VM
                                        + LayoutLoader + AppLauncher
```

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 | **VS Code Extension**（首选） | 与竞品体验兼容；复用编辑器/Git/终端 |
| 设计器 UI | **Vue3 + TS + Vite + Element Plus** | 对齐竞品 web-designer 技术路线，团队前端友好 |
| 插件后端 | Node/TS | 调 CLI、管工程、起仿真进程 |
| 布局存储 | **JSON Schema（首选）**；可选自有 XML | 易校验/AI/MCP；避免抄 `rtgui` |
| JS 引擎 | **JerryScript**（或 QuickJS） | 嵌入式验证多；RTT 有开源移植可参考 |
| GUI | **方案 R1：LVGL + JS Bridge（推荐起步）**；**R2：自研轻量 Widget** | R1 降运行时成本；R2 更接近柿饼「自有 GUI」但贵 |
| 打包 | 自研 `ui-pack`（zip/自定义容器 + manifest） | 格式自有、可审计 |
| 仿真 | C/C++ `ui-sim` + SDL2 | 与板端共用 Runtime 核心 |
| 构建 | CMake（Runtime/sim）；pnpm+vsce（插件） | — |

### 3.4 逻辑视图（模块）

| 模块 | 职责 |
|------|------|
| **Schema** | 布局/工程/控件注册表 JSON Schema 与校验 |
| **ProjectService** | 创建/打开/保存/迁移、`projectConfig` |
| **Designer** | 画布渲染（DOM 近似）、拖拽、属性、树、对齐 |
| **WidgetRegistry** | 控件元数据；设计器与 Runtime 同源 |
| **ScriptWorkbench** | `@types`、事件 stub 插入、基础 lint |
| **PackPipeline** | 资源处理、可选字节码、打 uipkg |
| **SimOrchestrator** | rootfs 准备、启停 `ui-sim`、日志面板 |
| **DeviceBridge** | 推送 uipkg（串口/USB/ADB 可插拔后端） |
| **Runtime Core** | 控件树、layout loader、JS Binding、事件循环 |
| **Host Port** | 显示/触摸/tick/FS；Launcher；可选 IPC（类 ubus） |
| **SDK Manager** | 多 `apiLevel` 平台目录（对齐 persimwear-N 思路） |

---

## 4. 数据与接口设计

### 4.1 工程目录（体验兼容、格式自有）

```text
MyApp/
  .settings/projectConfig.json
  @types/                 # LiteApp JS API
  jsconfig.json
  src/
    app.js
    app.json              # id, name, version, apiLevel, entryPage, icon
    pages/<name>/
      <name>.layout.json  # 自有布局（禁止 rtgui 方言）
      <name>.js
    res/images|fonts|values/
  dist/
    output/original/app.uipkg
    simulation/rootfs/
```

### 4.2 布局模型（示意）

```json
{
  "schemaVersion": 1,
  "type": "Page",
  "id": "main",
  "frame": { "x": 0, "y": 0, "w": 1024, "h": 600 },
  "style": { "background": "#000000" },
  "children": [
    {
      "type": "Button",
      "id": "btn_go",
      "frame": { "x": 40, "y": 40, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "events": { "click": "onNextClick" }
    }
  ]
}
```

控件节点字段建议：`type`、`id`、`frame`、`props`、`style`、`events`、`children`。  
与竞品 XML 的对应仅为 **概念映射表**（内部文档），**不提供**自动双向转换（避免 L4 兼容承诺）。

### 4.3 应用包 `app.uipkg`

```text
app.uipkg
  manifest.json     # id, version, apiLevel, entry, files[], checksum
  app.js | app.jbf
  pages/...
  res/...
```

`manifest.apiLevel` 必须与 Host/SDK 协商；不匹配则拒绝加载并给出明确错误。

### 4.4 JS API 形似层（L3 可选）

最小 MVP API：

| API | 作用 |
|-----|------|
| `App({ page, onLaunch, … })` | 应用入口 |
| `Page({ onLoad, onShow, onHide, … })` | 页面生命周期 |
| `this.setData(path, value)` / `setText` | 改控件展示 |
| `navigateTo` / `replacePage` | 切页 |
| `onClick` 回调 | 事件 |

C 侧通过 Binding 注册模块（如 `sensor`、`ipc`），**命名空间自有**（如 `lite.*`），文档提供与竞品心智的对照表，而非符号兼容。

### 4.5 Studio ↔ CLI 接口

```text
liteapp validate <project>
liteapp pack    <project> [-o out.uipkg] [--bytecode]
liteapp sim     <project> [--rootfs path] [--pkg path]
liteapp install <uipkg> --transport usb|uart|adb
```

插件只编排 CLI，保证无 GUI 亦可 CI 打包。

### 4.6 Host 初始化接口（概念）

```c
int liteapp_host_init(const liteapp_host_config_t *cfg);
/* cfg: root paths, display ops, input ops, tick, fs */
int liteapp_install_pkg(const char *pkg_path);
int liteapp_launch(const char *app_id); /* NULL = default */
void liteapp_poll(void); /* or internal thread */
```

对齐竞品「设路径 → 注册 loader → launch」顺序。

---

## 5. 模块详细设计（要点）

### 5.1 Designer

- **输入/输出：** 读写 `*.layout.json`；选中态与属性面板双向绑定  
- **渲染：** DOM/绝对定位近似（体验兼容竞品）；**不以画布为验收**  
- **交互：** 拖入、几何编辑、多选对齐、树拖拽改层级、撤销栈  
- **事件：** 填写 handler 名；命令「生成 stub」写入对应 `page.js`  

### 5.2 PackPipeline

阶段：`pre-script` → `collect` → `optional minify/bytecode` → `image pipeline` → `write uipkg` → `post-script`。  
失败需可诊断日志（对标竞品终端输出体验）。

### 5.3 Runtime Core

- LayoutLoader：JSON → Widget 树  
- Widget 实现：R1 映射到 `lv_obj_*`；R2 自绘  
- JS VM：加载 app/page；把原生对象 wrap 给脚本  
- 定时器/动画：由 Host tick 驱动  

### 5.4 SimOrchestrator

1. 可选先 `pack`  
2. 同步 SDK 模板 rootfs  
3. 安装 uipkg 到 rootfs 约定路径  
4. spawn `ui-sim`，cwd/args 指向 rootfs  
5. stdout/stderr 进 VS Code Terminal  

### 5.5 DeviceBridge

抽象 `Transport`：`listDevices` / `push(file, remotePath)` / `rebootApp`。  
首版实现一种（USB 文件拷贝或串口 XMODEM/自定义帧即可）。

### 5.6 WidgetRegistry

```json
{
  "id": "button",
  "label": { "zh-CN": "按钮", "en": "Button" },
  "isContainer": false,
  "props": [
    { "name": "text", "class": "attr", "type": { "class": "text" }, "value": "Button" },
    { "name": "click", "class": "event", "type": { "class": "text" } }
  ]
}
```

设计器枚举注册表；Runtime 按 `id` 创建实例。缺实现的控件在 pack 期告警。

---

## 6. 运行时方案选择（R1 / R2）

| | R1 LVGL Bridge（推荐） | R2 自研 GUI |
|--|------------------------|-------------|
| 成本 | 中 | 高 |
| 观感 | LVGL 风格，可通过主题贴近 | 更易做「类 Android」自有风格 |
| 风险 | Binding 与控件映射工作量 | 软渲染/GPU 全自建 |
| 适用 | 要尽快功能兼容上市 | 要强品牌差异化 GUI |

**设计说明默认交付按 R1 编写接口；R2 可替换 Paint/Widget 后端而不改 uipkg 与 JS API。**

---

## 7. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0 逆向固化** | 本文 + 功能对照表 + 合规清单 | 3～5 天 | 评审通过 |
| **P1 Schema+Hello** | 布局 Schema、双页示例、校验器 | 1～2 周 | 示例工程可校验 |
| **P2 Runtime** | Loader + 8～12 控件 + JS 最小 API | 1～2 月 | PC 代码可跑 Hello |
| **P3 Pack+Sim** | `ui-pack` / `ui-sim` + rootfs | 3～5 周 | 包在仿真可点选 |
| **P4 Studio MVP** | Extension + Designer 五区 | 2～3 月 | 拖完即可 pack+sim |
| **P5 Host** | 板端 port + 装包启动 | 1～2 月 | 同包板上运行 |
| **P6 V1** | 自定义控件、下载、字节码、多 SDK、i18n | 1.5～2.5 月 | V1 验收 |
| **P7 V2** | 多分辨率、挂件、IPC、动效 | 按需 | 产品化项 |

原则：**P1→P2→P3→P4**；禁止先做视觉壳。

人力建议：Runtime 1～2、工具链 1、前端 1～2、板级 1。  
MVP（至 P5）约 **6～10 人月**；V1 约 **12～18 人月**。

---

## 8. 兼容迁移策略（可选增值）

若客户有少量官方 Persim 工程需迁到 LiteApp：

| 策略 | 说明 |
|------|------|
| **人工对照迁移** | 提供控件/属性映射表；设计师重拖或半自动脚本 |
| **单向导入实验** | 只读解析官方 XML 子集 → 写自有 JSON（内部工具，不承诺兼容） |
| **禁止** | 宣传「100% 兼容 Persim 工程/prc」 |

JS 业务迁移：提供 API 对照表；ubus 类能力改为自有 `ipc` 模块。

---

## 9. 质量、安全与合规

### 9.1 验收（功能兼容）

1. 设计器不手写 JSON 可完成双页：背景/图/字/按钮  
2. JS 切页并改文案  
3. 一键 pack + sim 正确  
4. 板端 Host 安装同包可运行  
5. 工程与包格式检测 **不是** 官方 Persim/prc 魔数  
6. 控件注册表扩展后设计器与 Runtime 同时识别  

### 9.2 合规清单

- [ ] 无竞品 VSIX/exe/dll 进入发行包  
- [ ] 无官方 Persimmon 闭源源码再分发  
- [ ] 自有品牌与扩展 id  
- [ ] 第三方许可证（JerryScript/LVGL/Vue…）台账齐全  
- [ ] 法务确认未承诺 L4/L5 兼容  

### 9.3 主要风险

| 风险 | 对策 |
|------|------|
| 低估 Runtime | 选 R1；P2 做硬门禁 |
| 画布观感争议 | 合同/验收以 sim/板端为准 |
| 被要求兼容 `.prc` | 引导采购官方或签单独授权项目 |
| JS 性能 | 文档写清 MCU 下限；重逻辑下沉 Native |

---

## 10. 目录与交付物建议

```text
liteapp/
  docs/                 # 本设计说明、移植指南、API 手册
  schema/               # JSON Schema
  runtime/              # Core + LVGL bridge / widgets
  host/                 # 板端 port 模板
  tools/ui-pack/
  tools/ui-sim/
  studio/               # VS Code extension monorepo
  sdk/platforms/liteapp-1/   # @types, widgets, rootfs 模板
  examples/hello/
```

交付物：可安装 VSIX（或 vsix+SDK zip）、Runtime 源码、Host 移植包、Hello 示例、设计说明（本文）、测试用例。

---

## 11. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | VS Code 设计器 + XML/JS 轻应用 + `.prc` + Persimmon/JerryScript 宿主 |
| 逆向重点 | L2 运行时与 L3 包模型，而非仅 L5 UI 皮肤 |
| 兼容策略 | **L1+L2 功能兼容**；格式/运行时自有；拒绝默认 L4/L5 |
| 重构抓手 | Schema → Runtime → pack → sim → Studio → Host |
| 成功标准 | 同一自有 `uipkg` 在仿真与板端可点选运行，并可迭代安装 |

---

## 12. 参考资料

1. `Persim_Studio分析文档.md`、`Persim_Studio_仿制方案.md`、`Persim_Studio_分析与仿制方案.md`  
2. `xf-persim-studio`（`packages/main`：`package.ts`、`simulation.ts` 等）、`persim-sdk`  
3. `persim-studio-3.3.0.vsix`、`xf-persim-apps`、`vehicle-persim-dash`（`persimui.cpp`）  
4. 湃心 OS：https://www.rt-thread.com/persimos/ ；Turnkey 工具清单页  
5. 柿饼 UI / PersimUI Builder 公开介绍；JerryScript on RT-Thread  
6. 体例参考：仓库根目录 `仿制UIBuilder软件设计说明文档.md`  

---

*本文为设计说明，不构成对 RT-Thread / 睿赛德产品的授权或兼容承诺；量产许可以法务结论为准。*
