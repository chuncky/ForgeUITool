# Persim Studio（Aura Studio）仿制方案

> 依据：`Persim_Studio分析文档.md`、本地 `xf-persim-studio` / `persim-studio-3.3.0.vsix` / `xf-persim-apps` / `vehicle-persim-dash`，以及公开资料（睿赛德柿饼 UI 介绍、湃心 OS / Persim Studio 产品页、社区教程与 JerryScript 移植说明等）。  
> 对象：**Persim Studio / Aura Studio** 所代表的「可视化设计 + JS 轻应用 + 包安装 + 模拟器」范式。  
> **仿的是能力与架构，不是品牌、闭源二进制或官方包格式。**  
> 与分析合并的综合稿（推荐）：[`Persim_Studio_分析与仿制方案.md`](./Persim_Studio_分析与仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`Persim_Studio_竞品逆向与重构设计说明.md`](./Persim_Studio_竞品逆向与重构设计说明.md)。

---

## 0. 路线与合规（先锁死）

### 0.1 原厂范式一句话

公开资料与本地仓库一致：

> **设计器拖拽布局（XML）+ JavaScript 写逻辑 → 打包成应用包 → 模拟器/真机由 Persimmon + JS 引擎加载；UI 与固件可解耦，支持多 App / 升级。**

湃心 OS 等产品页强调：JS 小程序开发模式、应用下载升级、模拟器、Persim Studio 拖拽、嵌入式 GPU、RT-Thread 内核。早期亦称 Persimmon UI Builder / PersimUI Builder。

这与 Beken / SquareLine「导出 LVGL C 编进固件」**不是同一赛道**。

### 0.2 双锁定（仿制约定）

| 维度 | 约定 |
|------|------|
| **能力** | 对齐 Studio 公开能力面：工程、可视化布局、JS 业务、打包、仿真、下载/安装、可扩展控件/SDK |
| **格式** | **自有** 布局方言 + **自有** 应用包格式；**不**兼容官方 Persim `rtgui` XML / `.prc` / `.pld` 作为对外承诺 |
| **运行时** | 自研或开源可授权栈；**不**搬运官方 `simulator.exe`、`app_pkg_tool`、Persimmon 闭源库、VSIX 内二进制 |
| **品牌** | 自有产品名；勿冒充 Aura / Persim / 柿饼官方 |

若必须官方 Persim XML + `.prc` + 官方支持与量产宿主 → **采购 / 授权 RT-Thread PersimUI 方案**，本文不适用。

### 0.3 禁止事项

- 反编译 / 重打包官方 VSIX、`simulator.exe`、`jerry_snapshot.exe`、`prcbuild` 等闭源工具用于商业发行  
- 复用官方 `rtgui` 控件树方言与 `.prc` 包布局作为「兼容层」对外宣传（易触授权与格式锁定）  
- 传播或再分发本地仓库中标注禁止传播的 JS Persimmon 等源码  

### 0.4 原厂主要功能清单（对标用）

依据 Studio README、插件命令、CHANGELOG 与湃心/柿饼公开介绍。仿制时按能力对齐，**格式与二进制自有**。

| 类别 | 原厂主要功能 | 仿制建议落点 |
|------|--------------|--------------|
| 工程管理 | 创建/打开、设置、升级迁移、SDK 管理 | MVP：创建打开+设置；V1：SDK 多版本 |
| 工程类型 | 应用、挂件/表盘 | MVP：应用；V2：挂件 |
| 页面资产 | 页面、自定义面板、挂件 | MVP：页面；V1：面板 |
| 可视化设计 | ~19 控件拖拽、属性/样式/事件、控件树、对齐多选 | MVP：8～12 控件+五区 |
| 编辑增强 | 跨页复制、事件双击生成 JS stub、F7 跳转 | V1 |
| 自定义扩展 | 自定义控件；widgets JSON | V1 注册表 |
| JS 开发 | `@types` 补全；App/Page 逻辑 | MVP 最小 API；V1 补全 |
| 资源字体 | PNG、透明/质量、字库 | MVP 基础图/字；V1 质量配置 |
| 国际化 | 设计器语言预览 | V1 基础 |
| 多分辨率 | 预览、转资源、分包仿真 | V2 |
| 打包 | 一键 pack、脚本钩子、字节码、GPU 图压 | MVP：pack；V1：字节码；GPU 按需 |
| 仿真 | 启停重启 simulator + rootfs | MVP：`ui-sim` |
| 真机下载 | USB/串口推包 | V1 |
| 性能分析 | Studio 2.0+；方案侧 fps/CPU 工具 | V1 雏形 / 按需 |
| 自定义 SDK | `persimwear-*` 可扩展 | V1 |

闭环主路径（原厂）：**设计 XML → 写 JS → 打包 `.prc` → 仿真 → 下载 → 宿主运行**。

---

## 1. 仿制目标

### 1.1 目标表述

> **VS Code（或轻量桌面壳）+ 可视化布局编辑器 ↔ 自有布局文档 + JS 业务 ↔ 自有打包器 → 自研/开源运行时模拟器与板端宿主加载运行。**

MVP 必须打通：**拖完两页 → 写少量 JS → 一键打包 → PC 窗体能点选运行 → 板端最小宿主能装包跑起来。**

### 1.2 能力对齐表（对标 Studio，落点自有）

| Studio / 柿饼公开能力 | 仿制对齐方式 | 不要 |
|----------------------|--------------|------|
| 工程管理（创建/打开/设置/SDK） | 自研工程向导与配置 | 官方工程魔数/品牌 |
| VS Code 插件 + Custom Editor | 自研 Extension；`*.xml`/`*.json` 自定义编辑器 | 抄官方 extension id / 品牌资源 |
| 拖拽控件改属性写回布局（~19 控件） | Vue 设计器 ↔ 自有 Schema；MVP 8～12 控件 | 读写官方 Persim XML 方言 |
| 页面 / 面板 / 挂件 | 自有工程类型与模板 | 兼容官方挂件协议 |
| `Page`/`App` JS + 智能提示 | 自定 JS API（可形似小程序）+ `@types` | 兼容官方 `pm.*` / 官方 module 全集 |
| 事件双击生成 stub / 跨页复制等 | V1 编辑增强 | — |
| 打包 `app.prc` + 脚本钩子 | 自有 `.uipkg` / zip+清单 | 兼容官方 `.prc` |
| XML→PLD | 可选自有二进制布局 | 官方 `xml2bin` / `.pld` |
| JS→字节码 | 可选 Jerry snapshot（开源工具链）或明文+混淆 | 官方 `jerry_snapshot.exe` 原样分发 |
| PC 模拟器启停重启 | 自研 host + SDL（或 Wasm） | 官方 `simulator.exe` |
| 真机下载 | 串口/USB/ADB 自研推送 | 绑定官方 ADP 协议闭源实现 |
| 多分辨率 / GPU 图压 / 图质量配置 | 自有转换管线；GPU 按需 | 抄官方 ezip 等私有格式而无授权 |
| 国际化预览、字库管理 | V1 | — |
| 自定义控件 JSON / 自定义 SDK | 控件注册表 + loader + SDK 目录 | — |
| 性能分析 | V1 日志级雏形 | 抄官方性能工具闭源实现 |

### 1.3 两条产品路线（必选其一）

| 路线 | 含义 | 适用 |
|------|------|------|
| **A. 范式仿制（推荐默认）** | 自有布局 + 自有包 + **开源可组合运行时**（如 JerryScript + 自研/LVGL 控件桥，或轻量自研 GUI） | 要自控 IP、可对外卖工具/方案 |
| **B. 工具层仿制** | 只做设计器/打包 UX；板端继续用 **已授权的 PersimUI 宿主** | 已是 RTT Persim 客户，只想换 IDE 体验 |

下文默认写 **路线 A**。路线 B 跳过「自研宿主」，但打包产物仍须符合授权方格式（通常仍应买官方工具链，仿制价值有限）。

**若团队真实目标是 LVGL 静态固件：** 不要仿 Persim，请走 Beken/SquareLine 类方案。

---

## 2. 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  Studio（VS Code Extension 推荐；或 Electron/Tauri）           │
│  工程管理 / 打包 / 仿真 / 下载 / SDK 管理                       │
│  web-designer：Vue3 画布 + 属性 + 控件树                       │
└──────────────────────────────┬───────────────────────────────┘
                               │ 读写自有工程
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  App 工程                                                     │
│  src/pages/**/page.json|xml   布局（自有方言）                 │
│  src/pages/**/page.js         逻辑                             │
│  src/app.js + app.json        入口与元数据                     │
│  src/res/ + .settings/        资源与工具配置                   │
└──────────────────────────────┬───────────────────────────────┘
                               │ pack CLI
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  产物：app.uipkg（清单 + 布局 + JS/字节码 + 资源）              │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     PC：host + SDL/Wasm                 板端：RTOS/Linux 宿主
     同构加载 uipkg                      显示/输入 port + JS VM
                                         + 布局 loader + 包管理
```

与原厂对应关系（仅概念对齐）：

| 原厂 | 仿制 |
|------|------|
| Persim Studio | 自研 Studio |
| `rtgui` XML | 自有 layout Schema |
| JerryScript + jspm API | JerryScript（或 QuickJS）+ 自有 Binding |
| Persimmon 控件 | 自研 Widget 或 LVGL 映射层 |
| `app.prc` | `app.uipkg` |
| `simulator.exe` | 自研 `ui-sim` |

---

## 3. 分期计划

### 3.1 MVP（可演示闭环）

- 自有工程模板（application）  
- 8～12 个基础控件（Page/Panel/Label/Button/Image/Slider…）  
- 设计器五区：库 / 画布 / 树 / 属性 / 工具条（打包·仿真）  
- `pack` → `app.uipkg`  
- PC 模拟器跑包：切页 + 按钮改 Label  
- 板端最小宿主文档 + 示例（同包可装）  
- **不做：** 多分辨率、GPU 私有图压、表盘商城、完整 ubus、官方兼容  

### 3.2 V1（可用产品）

- 自定义面板 / 简单自定义控件注册表  
- 事件属性双击生成 JS 骨架；`@types` 补全  
- 可选 JS 压缩 / Jerry snapshot  
- 资源管理与基础 i18n  
- 串口或 USB 推包  
- SDK 多版本目录（apiLevel）  
- 性能分析雏形（帧时/内存日志）  

### 3.3 V2（对齐穿戴/车机产品面）

- 多分辨率转换与打包  
- 表盘/挂件工程类型  
- 动效时间轴 / 复杂列表类控件  
- 系统服务桥（类 ubus：IPC topic）  
- Online 示例库 / MCP 辅助改布局（可选）  

**永不做：** 官方 Persim 格式兼容承诺；搬运闭源模拟器。

---

## 4. 工作拆分（按顺序）

| 序号 | 工作包 | 周期参考 | 交付 |
|------|--------|----------|------|
| **0** | 合规 + 能力对照清单 + 选定路线 A/B | 2～3 天 | 决策纪要；禁止清单 |
| **1** | 自有 Layout Schema + App 元数据 + Hello 工程 | 1～2 周 | JSON Schema / XSD；示例双页 |
| **2** | 运行时内核（控件树 + 布局 loader + JS Binding） | 1～2 月 | 可在 PC 用代码创建 UI 并跑 JS |
| **3** | 打包器 `ui-pack` | 1～2 周 | 目录 → `app.uipkg`；可选 snapshot |
| **4** | PC 模拟器 `ui-sim` | 2～4 周 | SDL 窗口加载 uipkg；日志终端 |
| **5** | Studio 设计器 | 2～3 月 | 拖完即可 pack+sim（见 §6） |
| **6** | 板端宿主最小端口 | 1～2 月 | 显示/触摸/tick/FS + 装包启动 |
| **7** | V1 增强 | 1.5～2.5 月 | 控件扩展、下载、SDK 多版本 |
| **8** | V2 产品化 | 按需 | 多分辨率、挂件、IPC、动效 |

**原则：0→1→2→3→4，再 5。** 先有「包 + 运行时」，再做花哨设计器（与 Beken 仿制「先 CodeGen 后设计器」同理；此处 CodeGen 换成 **pack + host**）。

人员建议：嵌入式运行时 1～2、工具链/打包 1、前端设计器 1～2、板级移植 1。  
到 MVP 约 **6～10 人月**；到 V1 约 **12～18 人月**；接近湃心级产品面另计 GPU/商城/多芯片，可达 **20+ 人月**。

---

## 5. 自有工程与包格式（建议）

### 5.1 工程目录（刻意接近 Studio，降低学习成本，但文件方言不同）

```text
MyApp/
  .settings/projectConfig.json
  @types/                 # JS API 声明
  jsconfig.json
  src/
    app.js
    app.json
    pages/
      main/
        main.layout.json  # 或 main.xml（自有标签，勿抄 rtgui 语义）
        main.js
    res/
      images/ fonts/ values/
  dist/
    output/original/app.uipkg
    simulation/rootfs/
```

布局建议优先 **JSON**（易 Schema 校验、易做 MCP/AI）；若坚持 XML，使用自有根节点与属性名，避免 `rtgui` / 官方 class 名表照搬。

### 5.2 `app.uipkg`（示例）

```text
app.uipkg          # zip 或自有容器
  manifest.json    # id, version, apiLevel, entry, files[]
  app.js | app.jbf # 明文或字节码
  pages/...
  res/...
```

板端与模拟器只认该格式。**禁止**把官方 `.prc` 解析逻辑做成对外兼容目标。

---

## 6. 运行时怎么仿（路线 A 核心）

### 6.1 推荐组合

| 层 | 推荐 | 说明 |
|----|------|------|
| OS | RT-Thread / Linux | 与目标市场一致即可 |
| JS | **JerryScript**（开源，RTT 已有移植）或 QuickJS | 对齐「嵌入式 JS」叙事 |
| GUI | **方案 A1：LVGL + JS 桥**；**方案 A2：轻量自研 Widget+软渲染** | A1 生态更熟；A2 更像柿饼「自有 GUI」但成本高 |
| 布局 | 自有 loader：JSON/XML → 控件树 | 设计器与运行时共用 Schema |
| 包管理 | 安装到 `/apps/<id>/`，Launcher 启默认 App | 对齐「轻应用」 |

公开课程亦强调：Builder + JS、SDK 驱动适配、**JS 与 C 交互**。仿制时 Binding 层（C 模块导出给 JS）是长期工作，MVP 只需 `setText` / `onClick` / `navigate` 等最小集。

### 6.2 与原厂宿主对照（仅理解用）

原厂 `persimui_init`：设路径 → 注册图/字体 → XML/PLD loader → Launcher。  
仿制 `ui_host_init`：同样顺序，但 loader/API/包格式全部自有。

### 6.3 仿真

```text
ui-pack → 写入 simulation/rootfs/apps/...
→ ui-sim（SDL）加载 rootfs → 执行 app 入口 → 事件循环
```

Studio 用 Terminal/子进程拉起 `ui-sim`，日志进输出面板（对齐原厂体验，不复制其 exe）。

---

## 7. 设计器怎么做（工作包 5）

### 7.1 壳选型

| 路径 | 说明 |
|------|------|
| **VS Code Extension（推荐）** | 与原厂一致：复用编辑器、Git、终端；Custom Editor 嵌 Vue |
| Electron / Tauri 独立 App | 不依赖 VS Code 版本；需自建文件树与终端体验 |

技术栈可对齐原厂开源结构（合法自研）：**Vue3 + Vite + Element Plus + TS**；插件侧 **Node 调 pack/sim**。

### 7.2 模块要点

| 模块 | 做什么 |
|------|--------|
| 工程 | 新建/打开；写 `projectConfig`；生成模板页 |
| 控件库 | 读 SDK `widgets/*.json` 注册表拖入 |
| 画布 | DOM/绝对定位近似；改几何写回 layout |
| 树 / 属性 / 事件 | 写回 layout；事件填函数名 |
| JS | 普通文本编辑器 + `@types`；双击事件插入 stub |
| 打包 / 仿真 | spawn `ui-pack` / `ui-sim` |
| 下载 | V1：推送 uipkg 到设备路径 |

内部顺序：读写工程 → 只读渲染 layout → 拖拽+属性 → 树/撤销 → 接 pack/sim → 事件/资源。

### 7.3 控件注册表（对齐 Studio「JSON 扩控件」）

每个控件：`id`、`label`、`isContainer`、`props[]`（attr/style/event + 类型 text/color/image/enum…）。  
运行时 loader 与设计器共用同一份注册表生成代码，避免「设计器有、板上无」。

---

## 8. SDK 与板端集成文档（工作包 6）

交付物建议：

1. **Host 移植指南**：显示、输入、tick、文件系统、内存预算  
2. **JS Native 模块指南**：如何把 C 传感器/CAN/ubus 暴露给 JS  
3. **最小 Demo BSP**：一键装 `Hello.uipkg`  
4. **版本策略**：`apiLevel` 与 Studio SDK 目录对应（对齐 `persimwear-N` 思路）  

验收：同一 `app.uipkg` 在 `ui-sim` 与板端行为一致（允许像素级差异，交互与数据流一致）。

---

## 9. 验收标准

### MVP

1. 不手写 layout，设计器拖出背景 + 图 + 字 + 两按钮两页  
2. JS 内按钮切页并改 Label 文案  
3. 一键 pack + PC 仿真正确  
4. 板端最小宿主安装同包可运行  
5. 布局方言与包格式 **不是** 官方 Persim / `.prc`  

### V1

自定义控件注册生效；可选字节码包可跑；至少一种真机推送路径打通；多 apiLevel SDK 可切换。

### V2

至少一项产品化能力过关：多分辨率 **或** 挂件 **或** 系统 IPC 数据驱动仪表页。

---

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| 低估运行时成本 | 工期重心在 Host+Binding，不在画布皮肤；可先 LVGL 桥降 GUI 成本 |
| 画布 ≠ 真渲染 | **强制**仿真/板端验收，禁止只看设计器截图 |
| JS 性能/内存 | 限制帧逻辑；重绘制放 C；文档写清 MCU 下限 |
| 格式被要求「兼容柿饼」 | 拒绝；兼容即授权与长期包袱；商业上应买原厂 |
| 法律/授权 | 法务审依赖许可证；不搬客户目录里的闭源 Persimmon |
| 与 LVGL 工具路线混淆 | 立项时写清：要「应用包」还是「生成 C」；后者改做 Beken 类 |

---

## 11. 选型建议

| 诉求 | 建议 |
|------|------|
| 已买 / 必用官方 PersimUI 量产 | **用官方 Studio**；或路线 B 仅做周边脚本 |
| 要自有「JS 轻应用 + 包升级」产品 | **本文路线 A** |
| 只要 LVGL 可视化出 C | **不要仿 Persim**；仿 Beken / SquareLine |
| 只要 IDE 皮肤像 VS Code 插件 | 可只做设计器，但无运行时则无产品闭环 |

---

## 12. 总结论

| 维度 | 结论 |
|------|------|
| 原厂本质 | VS Code 设计器 + XML/JS 轻应用 + `.prc` + Persimmon/JerryScript 宿主 |
| 仿制抓手 | **自有 Schema → 运行时+打包 → 模拟器 → Studio → 板端 Host** |
| 合规 | 能力对齐、格式自有；不搬闭源工具与官方包格式 |
| 成功标准 | 同一自有应用包在仿真与板端可点选运行，并可迭代安装 |

公开宣传里柿饼 / 湃心强调的「快速出界面、类 Android 触控、模拟器免硬件、多 App 升级」，仿制时应用 **工程闭环** 兑现，而不是复刻品牌与二进制。对标功能清单见 **§0.4**。

---

## 13. 参考资料

**本地**

1. `rt-thread/Persim_Studio分析文档.md`  
2. `rt-thread/xf-persim-studio`（README、development.md、pack/simulation 源码、persim-sdk）  
3. `rt-thread/persim-studio-3.3.0.vsix`  
4. `rt-thread/xf-persim-apps`、`vehicle-persim-dash`  

**网上（公开介绍，非实现说明书）**

5. 睿赛德「柿饼 UI 简介」等公众号/转载：Persimmon UI + Builder + JS 运行时、仿真与 USB 下载叙事  
6. RT-Thread 湃心 OS 产品页：https://www.rt-thread.com/persimos/（JS 轻应用、模拟器、Persim Studio、GPU、多 App）  
7. 社区教程 / 课程：PersimUI Builder、JS 语法、SDK 驱动适配、JS↔C 交互（与非网等）  
8. JerryScript on RT-Thread：https://github.com/RT-Thread-packages/jerryscript  

---

*本方案为技术规划文档；量产授权、商标与第三方许可以法务结论为准。*
