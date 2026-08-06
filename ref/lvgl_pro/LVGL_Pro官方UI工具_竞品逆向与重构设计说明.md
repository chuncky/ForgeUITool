# LVGL Pro 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** LVGL 官方 **LVGL Pro**（核心 **LVGL Pro Editor**；本地线索 **2.0.1**；预览侧 LVGL **9.4 / 9.5**）  
> **输入材料：** `lvgl_pro/lvglpro信息.txt`、本机安装 `D:\Program Files\LVGL_Pro_Editor`、既有分析/仿制/综合文档；https://lvgl.io/pro 、GitHub README、docs.pro  
> **关联文档：** `LVGL_Pro官方UI工具分析文档.md`、`LVGL_Pro官方UI工具_仿制方案.md`、`LVGL_Pro官方UI工具_分析与仿制方案.md`  
> **体例参考：** `quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`、`beken/BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`、`artinchip/ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`  
> **重构产品暂名：** **ForgePro Studio**（可替换）；CLI 暂名 **`fp-codegen` / `fp-preview` / `fp-cli`**；工程格式暂名 **ForgePro Project（自有 JSON）**

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 LVGL Pro 所代表的 **声明式多文件工程 + Theia IDE + 真 LVGL Wasm 预览 + C 导出 /（授权下）运行时 XML + Figma/Online/CLI** 范式做结构化拆解，并设计一套 **功能兼容、工程格式自有、量产链路基于开源 LVGL** 的替代工具链。

竞品与 Persim（`.prc` + 专有宿主）不同：板上主路径仍是开源 **LVGL**（C 导出无额外专有 GUI 解释器）。  
与 SquareLine / Beken / UIBuilder 同属「工具链围绕 LVGL」；差异是 **官方同源 + XML 规范保护 + Wasm 真预览 + 四件套（Editor/Viewer/Figma/CLI）+ 组件 api / Subjects / Test 等专业能力**，以及 **XML Specification 对第三方编辑器/生成器的合规边界**。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清 Theia/lved 栈、XML 工程模型、Wasm 预览、导出/`*_gen` 边界、Figma Flow、功能面与授权 |
| **功能兼容** | 覆盖主路径：声明式工程 → 双模编辑 → 真预览 → 导出 C →（可选）CLI/Figma/Online → `*_init` 上板 |
| **格式自有** | 自有 Schema；**默认不**读写官方 Pro XML；Figma 落点只写自有 JSON |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 依赖 LVGL（MIT）及开源工具链；不搬运 `code-export.jsc`、官方 Flow 扩展、`lved-runtime.wasm` 闭源件 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 声明式+Design、真预览+Inspector、导出/协作工作流接近 | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见分析文档 §3 / 仿制方案 §0.4） | ✅ 目标 |
| **L3 产物形似** | 导出习惯接近 `*_gen` + user wrapper + `project_init` | ✅ 可选形似，**非**官方导出逐文件兼容 |
| **L4 工程兼容** | 直接打开官方 Pro XML 工程 | ❌ 默认不做（规范/合规红线） |
| **L5 工具链兼容** | 复用官方 `.jsc` / Flow / `lved-runtime` 闭源包 | ❌ 禁止 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 Pro XML 兼容器。若必须 L4 或官方商业支持 → **采购 LVGL Pro**。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先 Schema/CodeGen/真预览，后重 IDE** | 禁止首期堆完整 Theia |
| **单一权威模型** | 自有 JSON Schema 服务编辑器、校验、CodeGen、Figma、CLI、（可选）MCP |
| **generated / user 隔离** | `*_gen` 可覆盖；user wrapper 不覆盖 |
| **验收以真 LVGL 为准** | Design 画布可近似；Preview = Wasm 或 SDL 真 LVGL |
| **组件 api 边界** | Design 模式只暴露声明过的属性（对齐竞品协作模型） |
| **合规优先** | 禁止宣传「兼容 Pro XML」；禁止解包业务 `.jsc`；Figma 禁止输出官方 XML |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | 安装目录、`ecosystems/`、`preview-bin`、Flow 扩展端口、工程 XML 目录约定 | 读目录/清单/明文 XML/文档 |
| 行为逆向 | XML→预览热更、导出 C、Figma 本机桥、Online Viewer、CLI | 官网/docs/README |
| 功能逆向 | 四件套、Subjects/Timeline/i18n/Test、多 Target、MCP | 公开能力面 + 分析文档 §3 |
| 不做 | 反汇编 `.jsc`、破解授权、复制 `lved-runtime.wasm` 作产品依赖 | — |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | LVGL Pro（核心 LVGL Pro Editor） |
| 形态 | **跨平台 Electron + Eclipse Theia** 专业 IDE + 外围三件套 |
| 版本线索 | 本地 Editor **2.0.1**；预览 **LVGL 9.4.0 / 9.5.0** |
| 定位 | 官方嵌入式 UI 专业工具：声明式 + 真预览 + 导出 C / 运行时 XML |
| 商业 | Community / Evaluation 免费；商用 **Product / Platform**（宣传无版税） |
| 与 LVGL | 同一生态维护方；C 导出跑开源 LVGL；运行时 XML 现偏商业 Engine |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L5 外围    Online Viewer │ Figma Flow │ CLI │ MCP（AI）        │
├─────────────────────────────────────────────────────────────┤
│ L4 工具层  Theia + Electron + lved 扩展 + Monaco + 调试扩展   │
│   XML Mode / Design Mode / Inspector / 导出 / 测试            │
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  多文件官方 XML（project/globals/screens/…）        │
│   （权威设计数据；规范受保护）                                  │
├─────────────────────────────────────────────────────────────┤
│ L2 产物层  *_gen.c/h + user wrapper  或  运行时 XML 包        │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  开源 LVGL + port（C 路径）│ 商业 XML Engine（可选） │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **C 导出路径的 L1 可自建**（开源 LVGL）——与 Persim 不同。  
2. 护城河在 **官方同源心智 + XML 规范护城河 + Wasm 真预览质量 + 四件套工程化**。  
3. 只仿 Design 画布而不做声明式 Schema + 真预览 + CodeGen，无法形成兼容级产品。  
4. **L4 默认禁止**：XML Specification 限制第三方公开/商用「读该规范的编辑器/生成器」。  
5. 导出逻辑有 **`.jsc` 保护**；预览依赖打包的 **`lved-runtime.wasm`**——仿制须自研，勿当开源依赖。  
6. 官方壳是 **重 Theia**；功能对齐不等于壳必须等价，首期宜轻量。

### 2.3 数据流逆向

```text
XML / Design 改工程文件
    → Wasm Runtime 清屏重建（真 LVGL 预览 + Inspector）
    →（可选）Figma Flow：本机 HTTP/WS → 写 globals.xml / screens/…
    → Compile & Export → *_gen + 保留 user wrapper
    →（可选）推 GitHub → Online Viewer
    →（可选）CLI：validate / generate / test → CI
    → 板端：lv_init → display/indev → project_init → screen_create/load
         或（授权下）板上 XML Engine 装载
```

与 Beken：同属导出 LVGL 源码；Pro 预览是 **编辑器内 Wasm 即时真渲染**，Beken 多为 **生成后 SDL 编译运行**。  
与 SquareLine：同属专业导出工具；Pro 强调 **声明式 XML + 官方规范 + 运行时 XML 路径**。

### 2.4 工程文件逆向

| 文件/目录 | 职责 | 重构对应 |
|-----------|------|----------|
| `project.xml` | 工程名、LVGL 版本、多 Target 等 | `project.json` |
| `globals.xml` | 字体、图片、styles、consts、subjects… | `globals.json` |
| `translations.xml` | 多语言 | `i18n/*.json` |
| `screens/` | 顶层 Screen | `screens/*.json` |
| `components/` | 可复用 Component + `api` | `components/*.json` |
| `widgets/` | 自定义 Widget（XML+可配 C） | `widgets/` + 用户 C |
| `fonts/` / `images/` | 资源 | `assets/` |
| `preview-bin` / `preview-build` | 预览构建产物 | 本地缓存（gitignore） |

三分法：**Widget**（可含 C，改后重编预览）/ **Component**（纯声明式组合）/ **Screen**（顶层页）。重构须在自有 Schema 中保留等价抽象。

### 2.5 导出与落地逆向

| 路径 | 职责 | 重构对应 |
|------|------|----------|
| C 导出 | `*_gen` + user 骨架；`project_name_init(asset_path)` | `generated/` + `user/` |
| 运行时 XML | 板上解析装载、可不重编 UI | V2 可选自有包格式 loader（**非**官方 XML Engine） |
| UI Test | Editor/CLI 跑测试 | `fp-cli test` |
| 自定义 Widget | C 进预览与板端 | 用户 C + 重编 preview |

上板（C 路径）：加入生成文件 → `#include "<project>.h"` → `lv_init` + port → `<project>_init("")` → `lv_screen_load(xxx_create())` → `lv_timer_handler`。

### 2.6 安装栈逆向（2.0.1）

| 层级 | 技术 |
|------|------|
| 壳 | Electron 40 + Theia 1.69 |
| 业务 | `theia-lved-core` / `@lved/shared-core`（lved） |
| 导出 | `code-export.js` + **`code-export.jsc`** |
| 预览 | `lved-runtime.wasm` ×（9.4、9.5）+ lv_xml 相关库 |
| Figma | `lvgl.flow`：Express + WS；端口预设 9111/9112 等 |
| 调试 | clangd、CodeLLDB、Git 等 Open VSX 扩展 |
| 脚手架 | ui-only / vscode / linux / zephyr + 大量 examples |

### 2.7 功能面逆向摘要

四件套 · XML/Design · Wasm 预览+Inspector · Component/Widget/Screen · 表达式 · Subjects · Timeline · i18n · 资源/内存 · 多 Target · C 导出 · 运行时 XML · UI Test · 调试 · Figma · Online · CLI · MCP · 脚手架 · 授权分层。  
详见分析文档 §3。

### 2.8 竞品优劣对重构的启示

| 启示 | 行动 |
|------|------|
| 真 LVGL 预览是体验锚点 | Preview 必须真渲染；优先 Wasm，MVP 可用 SDL |
| 声明式+Git/CI/AI 是差异化 | 自有 JSON 仍须明文、可校验、可 MCP |
| XML 规范是合规雷区 | **永不**做 L4；文档明示不兼容 |
| Theia 体积巨大 | 首期轻量壳；外形像 Pro 放后期 |
| Figma 本机桥模型可复用 | 自研插件+本地服务，**只写自有 JSON** |
| `.jsc` 不可抄 | 自研 CodeGen（Handlebars/自有 AST） |
| 运行时 XML 商业化 | 量产主推 C 导出；动态装载作可选自研 |
| 可与 ForgeLine/ForgeUI 共享内核 | Schema/CodeGen/Preview 复用；差异在声明式/Figma/Online |

### 2.9 赛道选择

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| Pro 级功能面 + 自控可发 + 含 Figma/CI | **本文（ForgePro）** |
| 官方 XML + 官方支持 | **直接买 Pro**，非本文 |
| 轻量免费拖拽 + 编译仿真 | Beken / ForgeUI |
| Qt 厂商垂直 + SDK 复制 | ArtInChip / ForgeBuilder |
| 跨平台订阅 Play 习惯 | SquareLine / ForgeLine |
| JS 轻应用包 | Persim，非本文 |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| 轻量桌面设计器（Electron/Tauri + Monaco + Design） | 官方 Pro XML 读写兼容 |
| 自有 JSON Schema + CodeGen C | 官方导出逐字节兼容 |
| 真 LVGL 预览（SDL→Wasm）+ Inspector | 搬 `lved-runtime.wasm` / `.jsc` |
| generated/user 隔离、CLI | 官方 Flow 扩展与 token 体系 |
| 自研 Figma 插件→自有 JSON | 输出 Pro XML；冒用 LVGL Pro 品牌 |
| Online Viewer（自有工程） | 复刻 viewer.lvgl.io 域名/品牌 |
| Subjects/Timeline/i18n/UI Test/MCP（分期） | 商业 XML Engine 克隆 |

### 3.2 目标架构

```text
┌──────────────┐   本机桥    ┌──────────────────────────────────────┐
│ Figma 插件   │ ─────────► │ ForgePro Studio（声明式+Design）        │
│ 读设计/标注  │  写自有JSON │ Inspector / 资源 / 多 Target / 连 Figma│
└──────────────┘            └──────────────────┬───────────────────┘
                                               │ 自有工程
        ┌──────────────┐                       ▼
        │ Online 预览  │◄── Git/上传 ── project.json + screens/ + …
        └──────────────┘         │
                                 ├─► fp-codegen → generated/* + user/*
                                 ├─► fp-preview（真 LVGL Wasm/SDL）
                                 └─► fp-cli（validate/generate/test）
```

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 | **Electron/Tauri + 自研工作台**（首期） | 对齐能力；避免首期 Theia 体积与工期 |
| 可选后期壳 | Theia / Code-OSS 二次分发 | 仅当产品明确要求「外形极像 Pro」 |
| 声明式编辑 | Monaco + JSON Schema | 对齐 XML Mode 体验 |
| Design | DOM/Canvas 拼装 + 仅暴露 api 属性 | 对齐 Design Mode 协作边界 |
| CodeGen | Handlebars/自有 AST + CLI | 可测试；不依赖 `.jsc` |
| 预览 | MVP：**SDL+LVGL**；V1：**自研 Wasm runtime** 吃自有 JSON | 对齐真预览；勿绑官方 wasm |
| Figma | 社区插件 + 本地 HTTP/WS 服务 | 对齐 Flow 本机桥模型 |
| LVGL 版本 | 工程字段锁定（建议先 **9.x 单一 minor**） | 与预览/导出一致 |
| 工程格式 | 自有 JSON 多文件 | **禁止** Pro XML 同构 |

### 3.4 逻辑模块

| 模块 | 职责 |
|------|------|
| **Schema** | project/globals/screen/component/widget/i18n Schema 与校验 |
| **ProjectService** | 新建/打开/多 Target、脚手架模板 |
| **DeclEditor** | Monaco 声明式编辑 + 诊断 |
| **DesignEditor** | 拖拽拼 Screen；只改 `api` 暴露属性 |
| **ComponentService** | Component/Widget 注册与 api 边界 |
| **BindingService** | Subjects / observers（V1） |
| **AnimService** | Timeline（V1） |
| **I18nService** | 翻译表（V1） |
| **AssetService** | 图/字；可选内存估算（V1～V2） |
| **CodeGen** | JSON→generated + user 骨架 |
| **PreviewOrchestrator** | 真 LVGL 预览热更；Inspector |
| **FigmaBridge** | 本机服务 + 插件协议；只写自有 JSON |
| **OnlineViewer** | Web 读自有工程（V1～V2） |
| **TestRunner** | UI Test（V1～V2） |
| **McpServer** | AI 读写自有工程（V2） |
| **Cli** | `validate \| generate \| preview-build \| test` |

---

## 4. 数据与接口设计

### 4.1 工程目录

```text
MyUi/
  project.json
  globals.json
  i18n/
    strings.json
  screens/
    home.json
  components/
    primary_btn.json
  widgets/                    # 可选：自定义控件元数据
  assets/images|fonts/
  user/                       # 手写（不清）
    my_ui.c
    my_ui.h
  generated/                  # fp-codegen 输出（可清）
    my_ui_gen.c
    my_ui_gen.h
```

`project.json` 建议字段：`name`、`lvglVersion`、`targets[]`（resolution/arch）、`defaultScreen`、`export`、`naming`。

### 4.2 组件节点（示意）

```json
{
  "schemaVersion": 1,
  "type": "component",
  "id": "primary_btn",
  "api": [
    { "name": "label", "type": "string", "default": "OK" },
    { "name": "on_click", "type": "event" }
  ],
  "root": {
    "type": "button",
    "style": { "main": { "default": { "bg_color": "#2563EB", "radius": 8 } } },
    "children": [
      {
        "type": "label",
        "props": { "text": "$label" }
      }
    ]
  }
}
```

Screen 引用 Component，并在 Design 模式只改 `api` 入参。  
**禁止**对外使用官方 Pro XML 标签/属性集作为产品格式。

### 4.3 CodeGen 接口

```text
fp-cli validate <projectDir>
fp-codegen generate <projectDir> [--clean-generated]
fp-preview       <projectDir>   # 真 LVGL 预览宿主
fp-cli test      <projectDir>
```

生成规则：

- 覆盖 `generated/**`  
- 若 `user/my_ui.c` 不存在则创建可扩展骨架；**已存在则不改**  
- 入口形如 `my_ui_init(const char *asset_path)`（名称可配置）  
- 文档说明与 Pro `project_init` / screen_create 的心智对应（L3 形似）  

### 4.4 运行时集成接口（板端 · C 路径）

```c
#include "my_ui.h"

lv_init();
/* display + indev */
my_ui_init("");
lv_screen_load(home_screen_create());
while (1) { lv_timer_handler(); }
```

### 4.5 Preview 编排

1. 校验工程  
2. 将自有 JSON 装入 Preview Runtime（SDL 或 Wasm）  
3. 变更 → 清屏重建（对齐竞品热更体感）  
4. Inspector：选中、量间距、调 frame（写回 JSON）  
5. 自定义 Widget：触发 preview-bin 重编（V1）  

### 4.6 FigmaBridge 编排

```text
Figma 插件选区
  → 本机 HTTP/WS（自有端口约定，勿抄官方端口当兼容协议）
  → 映射为 screens/components/globals/assets（自有 JSON）
  → Preview 真 LVGL 验收
```

强制：插件输出 **不得** 为 Pro XML；可用标注指定控件类型与 `load_screen` 导航。

---

## 5. 模块详细设计（要点）

### 5.1 DeclEditor / DesignEditor

- Decl：Monaco + Schema 诊断；文件树按 screens/components 组织  
- Design：实例化 Component；属性面板仅列 `api`  
- 撤销：工程快照栈  
- 开发者搭库 / 设计拼屏 的角色边界写进文档与权限（可选）  

### 5.2 Preview + Inspector

- Runtime API：`loadProject(dir)` / `reload()` / `select(id)`  
- Inspector 读 layout 度量并写回 frame/style（受限）  
- 视觉回归：可选截图对比（接 Test）  

### 5.3 CodeGen

- 遍历 screens/components → C 创建函数与样式  
- Subjects → 生成绑定骨架（V1）  
- Timeline → LVGL anim 或定时器代码（V1）  
- 缺映射控件 generate 期报错  

### 5.4 Binding / Anim / I18n / Test（分期）

按仿制方案 §0.4：MVP 可不做完整 Subjects；V1 起各开一条主路径验收。

### 5.5 FigmaBridge / Online / MCP

- Figma：§4.6  
- Online：静态/轻服务托管自有工程包 + Wasm 预览（V1～V2）  
- MCP：工具面「读/改工程 JSON、触发 validate/generate」（V2）；**不**接官方 XML MCP  

### 5.6 WidgetRegistry

```json
{
  "id": "button",
  "lvgl": { "create": "lv_button_create", "major": [9] },
  "apiDefaults": [],
  "styleParts": ["main"],
  "isContainer": true
}
```

声明式节点 `type` 与 CodeGen/Preview 共读。

---

## 6. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0** | 本文评审 + 合规清单 + LVGL minor 锁定 + 壳选型 | 2～3 天 | 决策通过；`compliance.md` |
| **P1** | Schema + Hello 双屏示例 | 3～5 天 | validate 通过 |
| **P2** | fp-codegen（C + user 隔离） | 1～2 周 | CLI 可生成可编译 |
| **P3** | fp-preview（SDL 真 LVGL） | 1～2 周 | 双屏切页可点；Inspector 雏形 |
| **P4** | Studio：Decl+Design MVP | 6～10 周 | 拖完/改 JSON 即可预览+生成 |
| **P5** | 上板文档 + 最小模板 | 1～2 周 | 板端或第二仿真跑通 |
| **P6** | V1：Wasm 预览、CLI、Component api、Figma MVP 导入 | 2～3 月 | Frame→JSON→预览正确 |
| **P7** | V2：Subjects/Timeline/Test/Online/MCP、可选动态装载 | 按需 | 各至少一条主路径 |

原则：**P1→P2→P3→P4→P5**，再 Figma/Online。禁止先堆 Theia 与全量专业能力。

人力：嵌入式 1～2、前端 1～2、Figma/Web 1、中间层 1。  
MVP（至 P5）约 **5～8 人月**；到 V1+Figma 约 **12～18 人月**；接近 Pro 公开套件密度约 **22～30 人月**。  
若已有 ForgeLine/ForgeUI CodeGen/预览：**P2/P3 可缩短**，工期转向声明式 Schema、Wasm、Figma。

---

## 7. 兼容迁移策略（可选）

| 策略 | 说明 |
|------|------|
| **人工重建** | 提供概念对照表（Screen/Component/api ↔ 自有模型） |
| **单向实验导入** | 内部脚本只读官方示例 XML 子集→自有 JSON（**不承诺、不宣传、不进产品**） |
| **禁止** | 「兼容 LVGL Pro 工程 / 官方 XML」作为售卖点 |

产物心智迁移：文档说明 `*_gen`↔`generated`、user wrapper↔`user/`、`project_init`↔`my_ui_init`（L3 形似）。

---

## 8. 质量、安全与合规

### 8.1 验收（功能兼容）

1. 声明式或 Design 完成双页（含一可复用 Component + api）  
2. 真 LVGL 预览切页正确；Inspector 可用  
3. generate 后 user 不丢；可进最小 LVGL 工程  
4. 工程格式检测 **不是** 官方 Pro XML  
5. V1：CLI validate/generate；Figma 选定 Frame 导入自有 JSON 且预览正确  
6. V2：绑定或动画或 Test 或 Online 至少一条主路径通过  

### 8.2 合规清单

- [ ] 发行包无官方 `.jsc` / `lved-runtime.wasm` / Flow 扩展原样依赖  
- [ ] 无 LVGL Pro / viewer.lvgl.io 品牌冒充  
- [ ] 未承诺 L4 Pro XML 兼容；Figma 不输出官方 XML  
- [ ] 已阅读并遵守 XML Specification / 商业授权相关公开条款之约束理解（法务确认）  
- [ ] LVGL 及第三方许可证台账齐全  
- [ ] 法务确认商业模式与商标策略  

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 做成 Pro XML 兼容器 | Schema 门禁；CI 检测官方标签特征 |
| Figma 语义复杂 | 分阶段；强制标注；视觉回归 |
| Theia 级工期 | 首期轻量壳；外形像 Pro 单独立项 |
| 预览≠设计稿 | 导入/编辑后强制真 LVGL 验收 |
| 范围膨胀 | 分期不变：先可上板，再 Figma，再高级能力 |
| 与 ForgeLine 产品重叠 | 共享内核；包装突出声明式/Figma/Online/CI |
| 运行时动态 UI 期望 | 明确主推 C 导出；动态装载可选自研 |

---

## 9. 目录与交付物建议

```text
forgepro/
  docs/                 # 本设计说明、合规、上板指南、对照表
  schema/
  codegen/              # fp-codegen
  preview-host/         # SDL +（V1）Wasm
  designer/             # Electron/Tauri 应用
  figma-plugin/
  figma-bridge/         # 本机 HTTP/WS
  online-viewer/
  cli/                  # fp-cli
  mcp/                  # V2
  templates/
  examples/hello/
```

交付物：可安装设计器、CLI、预览宿主、Hello 示例、Figma 插件（V1）、Online（V2）、上板文档、测试用例、本设计说明、合规备忘。

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | Theia+Electron + 官方 XML + Wasm 真预览 + C 导出/运行时 XML + Figma/Online/CLI |
| 逆向重点 | L3 工程模型与 L4 体验/四件套；L1 用开源 LVGL；规范与 `.jsc` 是合规/技术红线 |
| 兼容策略 | **L1+L2 功能兼容**；格式自有；**拒绝默认 L4/L5** |
| 重构抓手 | **Schema → CodeGen(generated/user) → 真预览 → Decl/Design → CLI → Figma → Online** |
| 与 ForgeUI/ForgeLine 差异 | 更强调声明式组件 api、Wasm、Figma 本机桥、Online/CI；壳首期刻意轻于 Theia |
| 成功标准 | 同套生成代码在预览与板端可点选；user 可迭代；无 Pro XML 依赖；Figma 落点为自有 JSON |

LVGL Pro 公开卖点是 **声明式 + 像素级真预览 + 导出/协作/CI 专业套件**。ForgePro 应用工程闭环兑现这些能力，并用自有格式规避 XML 规范雷区，而不是兼容器或安装包克隆。若团队必须官方 XML 与官方支持，应直接采购 Pro，而不是走本文重构主线。

---

## 11. 参考资料

1. `lvgl_pro/lvglpro信息.txt`  
2. `lvgl_pro/LVGL_Pro官方UI工具分析文档.md`（§1.1 实测、§2 原理、§3 主要功能）  
3. `lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`（§0.4 功能对标）  
4. `lvgl_pro/LVGL_Pro官方UI工具_分析与仿制方案.md`  
5. 本机安装：`D:\Program Files\LVGL_Pro_Editor`（2.0.1）  
6. https://lvgl.io/pro ；https://lvgl.io/docs/pro/  
7. https://github.com/lvgl/lvgl_editor （及 lvgl_pro README Features）  
8. https://lvgl.io/docs/pro/syntax/xml-license ；Figma / CLI / Online Viewer / AI 文档  
9. 体例参考：`quareline/…`、`beken/…`、`artinchip/…` 竞品逆向与重构设计说明  

---

*本文为设计说明，不构成对 LVGL / LVGL Pro 的授权或工程兼容承诺；商标、XML 规范与商业许可以官方为准。*
