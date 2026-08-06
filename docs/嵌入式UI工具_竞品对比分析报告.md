# 嵌入式 UI 工具竞品对比分析报告

> **文档类型：** 竞品对比分析（评估依据）  
> **对比对象：** ArtInChip UIBuilder、BEKEN LVGL UI Designer、LVGL Pro、SquareLine Studio、Persim Studio、FlyThings IDE、**EEZ Studio**  
> **输入材料：** `artinchip/`、`beken/`、`lvgl_pro/`、`quareline/`、`rt-thread/`、`中科世为/`、`EEZ Studio/` 既有分析 / 仿制 / 竞品逆向与重构设计文档；官网与公开对比（lvgl.io/pro、squareline.io、envox.eu、developer.flythings.cn、aicdoc、博通集成公开资料、社区对比等）  
> **用途：** 为自研「拖拽式 UI PC 工具」做范式选型、功能优先级、实现路径与风险边界评估  
> **日期：** 2026-07-28（含 EEZ Studio 增补；**2026-08-01** 增补 Beken 属性面板对标说明 §4.2.1；**2026-08-03** 增补样式背景图资源选择对标缺口 §4.2.1；**同日** 增补画布工作台对标 §4.2.2，且定为 MVP/P0）  

---

## 1. 结论摘要

七款工具可归为 **两大范式**：

| 范式 | 代表产品 | 板上本质 | 自研含义 |
|------|----------|----------|----------|
| **A. LVGL 源码导出** | SquareLine、Beken、UIBuilder、LVGL Pro、**EEZ Studio** | 开源 LVGL + 生成的 C（± MicroPython / ± Flow 运行时）；Pro 另可选运行时 XML | 做设计器 + Schema + CodeGen + 预览即可闭环；**不**做专有 GUI 宿主 |
| **B. 宿主 + 应用包** | Persim、FlyThings | 闭源/厂商 GUI 宿主加载 `.prc` 或 `so`+UI | 必须自研 Runtime/Loader；工程量与锁定风险显著更高 |

对「方便 UI 开发、拖拽即可生成可编译 UI」这一专项目标：

- **默认推荐走范式 A（LVGL 导出）**：与开源图形库对齐、跨芯片、易私有化、验收清晰（生成代码 + SDL/板端可跑）。  
- **仅当产品明确要「UI 热更新 / 智能串口屏主机 / 应用与固件解耦」时，再评估范式 B**（Persim 式 JS 包或 FlyThings 式 C++ so）。  
- **不要默认追求官方工程格式兼容（L4）或闭源二进制兼容（L5）**；各家自研重构设计均锁定 **L1+L2 功能兼容、格式自有**。  
- **EEZ** 在范式 A 中是 **开源参考实现 + Wasm 真预览 + Flow 上限样本**；要现成工具可直接用官方（遵守 GPL）；要自有产品许可则走 ForgeFlow 式重构，**勿 GPL 换皮闭源**。

**对自研工具的直接启示（一句话）：**

> 先定范式与交付物（`ui_init` 式源码 vs 应用包），再定预览策略（编辑器内 Play/Wasm vs 生成后编译），再定工程格式（明文 JSON 优先）与用户代码隔离区；芯片绑定、Figma/CI/AI/Flow 可作为增量，而非 MVP 前提。

---

## 2. 对比范围与方法

### 2.1 对象与版本线索

| 产品 | 厂商 | 本地/文档版本线索 | 重构暂名（既有设计） |
|------|------|-------------------|----------------------|
| AiUIBuilder / UIBuilder | ArtInChip 匠芯创 | 2.0.2 | ForgeBuilder |
| BEKEN LVGL UI Designer | 博通集成 Beken | 2.0.3 | ForgeUI |
| LVGL Pro Editor | LVGL Kft（官方） | 2.0.1 | ForgePro |
| SquareLine Studio | SquareLine（第三方） | 1.6.1 | ForgeLine |
| Persim / Aura Studio | RT-Thread 睿赛德 | VSIX 3.3.0 | LiteApp |
| FlyThings IDE（+ Lite） | 中科世为 | 公开文档 / SampleUI | ForgeHMI |
| **EEZ Studio** | **Envox** | **studio-master 0.28.0** | **ForgeFlow** |

### 2.2 方法

1. **结构与行为逆向结论**来自各目录分析文档与 `*竞品逆向与重构设计说明.md`（安装包实测、工程格式、生成物、仿真链路；**EEZ 另可读开源 `studio-master` 全链路**）。  
2. **功能面**对齐各分析文档「主要功能」章节。  
3. **公开定位**交叉官网与社区（如 LVGL Pro 四件套、SquareLine 厂商中立、Beken 免费叙事、**EEZ 开源+Flow+Wasm**、FlyThings 智能屏闭环）。  
4. **不做**闭源二进制反汇编级结论；商业价格以公开档位叙事为准，具体报价以厂商合同为准。

### 2.3 「兼容」评估标尺（统一）

| 层级 | 含义 | 自研默认 |
|------|------|----------|
| L1 体验兼容 | 工作台 / 工作流接近竞品 | ✅ 可追 |
| L2 功能兼容 | 主功能清单对齐 | ✅ 可追 |
| L3 API/产出形似 | 目录与钩子命名形似 | ⚪ 可选 |
| L4 工程兼容 | 直接打开官方工程文件 | ❌ 默认不做 |
| L5 运行时兼容 | 复用官方闭源宿主/导出器（对 EEZ：官方 `lvgl_runtime_v*` / eez-flow 二进制） | ❌ 禁止 |

---

## 3. 范式与定位总览

### 3.1 一句话定位

| 产品 | 一句话 |
|------|--------|
| **UIBuilder** | 匠芯创绑定的 Qt 设计器：XML 工程 → LVGL C → SDL 仿真 → 一键进 Luban-Lite SDK |
| **Beken Designer** | 免费 Electron 设计器：明文 JSON → Handlebars 生成 C/MP → 本机编译仿真；2.x 带 MCP AI |
| **LVGL Pro** | 官方专业套件：声明式 XML + Wasm 真预览 + Figma/Online/CLI/测试；商用分层 |
| **SquareLine** | 业界认知度最高的第三方 LVGL 可视化 IDE：拖拽 + 编辑器内 Play + 跨厂商 C/MP 导出 |
| **Persim Studio** | VS Code 插件：XML+JS → `.prc` 包 → Persimmon+JerryScript 宿主；偏车机/穿戴应用包 |
| **FlyThings** | Eclipse 六区 IDE：`.ftu` → 增量 C++ Logic → `libzkgui.so` → EasyUI 宿主；智能串口屏 / HMI 量产闭环 |
| **EEZ Studio** | **开源 Electron IDE：`.eez-project` → Wasm 真 LVGL（± Flow）→ Build 出 C；另挂 Dashboard/SCPI 仪器共壳** |

### 3.2 范式谱系

```text
                    ┌─────────────────────────────────────┐
                    │         嵌入式可视化 UI 工具          │
                    └─────────────────┬───────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
   A. 源码导出进固件                                      B. 宿主加载应用包
   (开源 LVGL 为主)                                       (厂商 GUI 运行时)
            │                                                   │
   ┌────┬───┼───┬────┬────┐                          ┌──────────┴──────────┐
   ▼    ▼   ▼   ▼    ▼    ▼                          ▼                     ▼
Square Beken UIBld LVGL  EEZ                      Persim              FlyThings
Line         Pro   Studio                          .prc+JS              .so+.ftu+C++
Play  编译  芯片  Wasm  Wasm+Flow
中立  仿真  SDK  +套件 开源/仪器
```

### 3.3 选型第一问（决定后续一切）

| 问题 | 选 A | 选 B |
|------|------|------|
| UI 是否必须随固件编译发布？ | 是 → A | 否，要装包/OTA UI → B |
| 图形库是否必须 LVGL？ | 是 → A | 可接受厂商 GUI → B |
| 团队语言偏好 | C /（可选）MP /（EEZ）Flow→C | JS（Persim）或 C++ Activity（FlyThings） |
| 是否要芯片/屏厂授权闭环 | 弱绑定即可 | 强绑定常见 |
| 是否接受 GPL 工具链 / 要改工具源码？ | 要 → 优先考虑 **EEZ 官方或开源参考** | — |

---

## 4. 主要功能对比

### 4.1 能力矩阵（● 强 / ◐ 有 / ○ 弱或无）

| 能力维度 | UIBuilder | Beken | LVGL Pro | SquareLine | EEZ | Persim | FlyThings |
|----------|:---------:|:-----:|:--------:|:----------:|:---:|:------:|:---------:|
| 可视化拖拽设计 | ● | ● | ● | ● | ● | ● | ● |
| 多屏 / 页面管理 | ● | ● | ● | ● | ● | ● | ● |
| 样式 Part/State（或等价） | ● | ● | ● | ● | ● | ◐ | ●（多态色图表） |
| 图形化事件 / 动作 | ● | ● | ● | ● | ● | ● | ●（Logic 钩子） |
| 流程图低代码（Flow） | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| 时间轴 / 动画编辑 | ◐ | ● | ● | ● | ● | ○ | ◐ |
| 字体裁剪 / 图转 | ● | ● | ● | ● | ● | ● | ◐ |
| 多语言 | ● | ● | ● | ◐ | ●（XLIFF） | ● | ◐ |
| 自定义组件 | ● | ● | ● | ●（许可限额） | ● | ●（SDK 扩展） | ● |
| C 源码导出 | ● | ● | ● | ● | ● | ○ | ○（非 LVGL C） |
| MicroPython 导出 | ○ | ● | ○ | ● | ○（偏 C；BB3 另有） | ○ | ○ |
| JS 应用逻辑 | ○ | ○ | ○ | ○ | ◐（Dashboard/快捷方式） | ● | ○ |
| 用户代码隔离区 | ● `custom/` | ● `custom/` | ● user | ● `ui_events` | ● actions/user | ● page.js | ● logic 增量 |
| 编辑器内即时预览 | ○ | ○ | ● Wasm | ● Play | ● Wasm | ◐ sim | ◐ 预览 |
| 生成后本机编译仿真 | ● SDL | ● SDL | ◐ | ◐ | ◐（另有 Full Sim） | ● simulator | Lite 线有 |
| 可视化调试器（变量/断点） | ○ | ○ | ◐ | ○ | ● Flow | ○ | ○ |
| 一键进芯片 SDK | ● | ◐ | ○ | ◐ 模板 | ◐ 模板叙事 | ● SDK/下载 | ● ADB/TF/img |
| 板级部署闭环 | ◐ | ○ | ○ | ○ | ○ | ● | ● |
| Figma 桥 | ○ | ○ | ● | ○ | ○ | ○ | ○ |
| Online 协作预览 | ○ | ○ | ● | ○ | ○ | ○ | ○ |
| CLI / CI / UI 测试 | ○ | ○ | ● | ○ | ◐ 无头 Build | ○ | ○ |
| AI / MCP | ○ | ● | ● | ○ | ○ | ○ | ○ |
| SCPI/仪器遥控 | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| 跨 Win/macOS/Linux 设计器 | ○ Win | ○ Win | ● | ● | ● | ○ Win+VSCode | ○ Win |
| 开源可审计工具本体 | ○ | ○ | ○ | ○ | ● GPL | ○ | ○ |
| 免费商用叙事 | 随芯片方案 | ● | Community 有限 | Personal 有限 | ●（无订阅墙） | 生态授权 | 授权/SOC |

### 4.2 功能面分组说明

**设计与工程（七家共有骨架）**  
工程创建 → 画布拖拽 → 属性 / 大纲 → 资源 → 事件 → 产出。差异主要在：**控件深度、样式模型、组件复用、是否另挂 Flow/仪器**。

#### 4.2.1 Beken 属性面板 — 自研对标参考（ForgeUI）

Beken LVGL UI Designer 2.0.3 右侧 **属性 | 事件** 面板为本产品 **L1 体验对齐** 的主要参照（非格式兼容）：

| 维度 | Beken | ForgeUI 采纳 |
|------|-------|--------------|
| 面板分组 | 位置信息 → 属性 → 行为配置 → 样式 | 同序；MVP 缺行为/完整样式 |
| 控件规格 | 38 种 + AI `component-specs/` | V1 目标 38 种；MVP 子集（FR-014） |
| 样式模型 | Part × State × 子组（背景/字体/边框…） | FR-017～018；颜色 `#RRGGBBAA` |
| 背景图资源 | 样式背景图可从资源列表/文件夹选择 | **须** `bg_image` + `AssetsDialog`（FR-016c）；禁止仅手填 |
| 图片 props | `src` 等从资源选择 | `DynamicPropForm` imageSrc 已对齐 |
| 复杂数据 | `extraData` 内嵌编辑器（列表/表格/图表） | FR-016b；禁止用 `children` 模拟 |
| 页面根 | 「屏幕信息」（宽/高，无锚点格） | FR-016a |
| 截图与手册 | `docs/beken界面/属性面板/` | `docs/工具详细说明手册/控件属性面板使用说明.md` |

**结论：** 属性面板深度与 Part/State 是 Beken 相对 SquareLine 的差异化强项之一；自研 V1 应补齐至用户手册 §5.0 规格，MVP 保证几何 + 常用 `props` + `main.default` 样式即可闭环。样式 `bg_image` 资源选择见属性面板详设 §6.4 / FR-016c。

#### 4.2.2 画布工作台 — 自研对标（ForgeUI，**MVP/P0**）

> **截图：** `docs/竞品截图/bk的设计器.png`、`docs/竞品截图/uibuilder的设计器.png`。  
> **需求落点：** 设计需求 V2.18 §3.7.5、FR-021a～d、FR-010g。

| 能力 | Beken | UIBuilder | ForgeUI 采纳 |
|------|-------|-----------|--------------|
| 上/左标尺 + 屏区高亮 | ✓ | ✓ | **P0**（FR-021a） |
| 设备框 = 工程分辨率 + 深色舞台 | ✓ | ✓ | **P0**（FR-021c） |
| 舞台网格 | ✓ | ✓ | **P0**（默认开） |
| 缩放 % +「视图」 | ✓ | ✓（图标为主） | **P0**（FR-021b） |
| 指针坐标 | — | ✓ | **P0**（FR-021d；默认开） |
| 底栏多 Tab | 日志在画布下 | 日志/资源/配置/事件 | **P0**：日志/资源/配置（FR-010g）；**事件不迁出右栏** |

**结论：** 画布 chrome 是设计器「像不像专业工具」的第一印象；不得标为 V1 抛光项。壳层仍以 Beken 右栏 **属性\|事件** 为 L1。

**预览（体验分水岭）**

| 模式 | 产品 | 优点 | 代价 |
|------|------|------|------|
| 编辑器内 Play | SquareLine | 反馈快、设计迭代短 | 闭源预览引擎；≠ 真机 |
| Wasm 真 LVGL | **LVGL Pro、EEZ** | 像素级接近最终库；EEZ 还可挂 Flow 调试 | 学成本；自研 Wasm 维护重；Pro 商用 |
| 生成 → 编译 → SDL | Beken、UIBuilder | 预览链路与上板同源（同为 LVGL C） | 等待编译；工具体积大 |
| 打包 → 模拟器宿主 | Persim、FlyThings Lite | 接近板上加载模型 | 依赖闭源 sim/宿主 |

> EEZ 的 `lvgl_runtime_v*.js` 是 **Envox 用 Emscripten 自编**（LVGL 源码 + 自家桥接），**不是** LVGL 官方现成包。

**业务接入**

- **A 类（含 EEZ 纯 LVGL）：** 生成区 + 用户区；再导出不覆盖业务。  
- **EEZ + Flow：** 板上常需 **eez-flow**，不再是「最小纯 ui_*.c」。  
- **Persim：** JS 生命周期 + 事件骨架。  
- **FlyThings：** 增量 Logic 钩子，永不覆盖已填 Logic。

**部署**

- **A 类多数止于「导出 / 拷贝进 SDK」**（含 EEZ）。  
- **Persim / FlyThings** 把装包、下载、ADB/TF/`update.img` 纳入产品叙事。

---

## 5. 实现方案对比

### 5.1 IDE 与技术栈

| 产品 | 设计器壳 | 工程权威格式 | 生成 / 打包 | 仿真 / 预览 |
|------|----------|--------------|-------------|-------------|
| UIBuilder | **Qt5** + `AicUI.dll` | `.aicpro` + XML snapshot | 闭源生成器 → `ui_builder/` | MinGW+CMake+SDL+双 LVGL |
| Beken | **Electron + Vue3** | 明文 `.bkprj` JSON | **Handlebars** 模板 | w64devkit/CMake+SDL |
| LVGL Pro | **Electron + Theia** | 多文件官方 **XML** | 保护导出（`.jsc`） | **`lved-runtime.wasm`** |
| SquareLine | 闭源跨平台桌面 | `.spj/.sll/.slp` JSON 系 | 闭源导出器 | 编辑器内 Play |
| **EEZ** | **Electron + React + MobX** | **`.eez-project` JSON** | **LVGLBuild + 模板占位符** | **自研 `lvgl_runtime_v*` Wasm**；可选 Docker Full Sim |
| Persim | **VS Code 扩展** + Vue 设计器 | XML + JS + projectConfig | `prcbuild` 等 SDK 工具 | `simulator.exe` |
| FlyThings | **Eclipse CDT** + 插件 | `.ftu`（ZKSW+zlib+JSON） | 增量 C++ Logic | 预览 + 板上 EasyUI |

### 5.2 运行时模型

| 产品 | 板上运行时 | 典型入口 |
|------|------------|----------|
| UIBuilder / Beken / SquareLine | 用户固件内 **LVGL** | `ui_init()` / `beken_ui_init()` 等 |
| LVGL Pro | LVGL C **或**（商用）XML Engine | `project_init` / screen_create |
| **EEZ（纯 LVGL）** | **LVGL** | `ui_init` / `loadScreen` |
| **EEZ（+ Flow）** | **LVGL + eez-flow** | 同上 + Flow 资源/运行时 |
| Persim | **Persimmon + JerryScript** | 宿主装载 `.prc` |
| FlyThings | **EasyUI/ZKGUI + libzkgui.so** | 宿主 dlopen 应用 so，inflate `.ftu` |

### 5.3 实现复杂度粗估（自研对标）

| 层级 | 内容 | A 类 MVP | A 类对标 EEZ 体验 | B 类 MVP |
|------|------|----------|-------------------|----------|
| L0 | Schema + 校验 | 必须 | 必须 | 必须 |
| L1 | CodeGen 或 Pack | CodeGen | CodeGen | Pack + Inflater |
| L2 | 真预览 | SDL 建议早期 | +自研 Wasm（可选） | 必须 |
| L3 | 可视化设计器 | 可后置 | 可后置 | 可后置 |
| L4 | Flow / Figma / CI / 部署 | 按场景 | Flow 为加分项 | 部署往往是卖点 |

**既有重构文档的共识建设顺序：**

- **A（含 ForgeFlow）：** Schema → CodeGen → 真预览（先 SDL）→ Designer →（可选）自研 Wasm / 逻辑图 → 板级文档  
- **B：** Schema → Runtime/Inflater → pack/build → sim → Designer → 板端 loader  

---

## 6. 优缺点对比

### 6.1 分产品

| 产品 | 主要优点 | 主要缺点 |
|------|----------|----------|
| **UIBuilder** | 标准 LVGL C；双版本；`custom`/weak 边界清晰；一键进 SDK；模板与 aicp/视频等芯片能力 | 仅 Windows；安装体积大；强绑 ArtInChip；画布≠最终 LVGL；无 Figma/CLI/MCP |
| **Beken** | **免费**叙事强；明文 JSON；C+MP；MCP AI；存档历史；**38 控件属性面板 + Part/State/Flex** 贴近 LVGL | 仅 Windows；非烧录 IDE；Electron 体积；升级/路径摩擦；上板需自集成 |
| **LVGL Pro** | 官方同源；Wasm 真预览；Git 友好 XML；Figma/Online/CLI/测试/MCP 工程化最强 | 学习曲线；商用授权；Theia 重量；XML 规范限制第三方编辑器；Design 依赖组件 api |
| **SquareLine** | 厂商中立；生态教程极多；Play 快；跨 OS；事件边界清晰；板级模板 | 订阅成本；Personal 限额；闭源 IDE；控件非全量；LVGL 大版本跟工具走 |
| **EEZ** | **开源可审计**；无订阅；Wasm 真预览 + Flow 调试；双 LVGL 大版本；跨 OS；XLIFF；可选仪器增值 | **GPL-3.0** 边界；学习曲线陡；产品面过宽（仪器/多类型噪声）；Electron 重；Flow 引入 eez-flow；生成约定偏自有 |
| **Persim** | 应用包 OTA；VS Code 工作流；sim≈设备模型；多分辨率/表盘/GPU 图压等产品化 | 强锁 Persim/RTT；闭源宿主；仅 Win 设计器；画布≠最终；JS 能力边界 |
| **FlyThings** | 组态快 + C++ 开放；串口屏主机叙事；ADB/TF/`update.img` 量产闭环；Lite 极低资源叙事 | 闭源框架；`.ftu` 二进制不利 Git；调试偏 Log；旧 Linux 叙事；强厂商锁 |

### 6.2 横向「护城河」

| 护城河类型 | 谁更强 | 自研是否要追 |
|------------|--------|--------------|
| 品牌与教程生态 | SquareLine、LVGL 官方 | 追体验，不追品牌冒用 |
| 官方规范与合规壁垒 | LVGL Pro（XML Spec） | **避开**官方 XML 兼容；用自有 Schema |
| **开源可改工具本体** | **EEZ（GPL）** | **参考实现**；自研产品建议宽松许可自写，勿换皮闭源 |
| 免费 + AI 入口 | Beken（免费+MCP）；EEZ（免费开源） | AI/开源叙事可作差异化 |
| Wasm 真预览 + Flow 调试 | EEZ、LVGL Pro（预览） | 预览可追；Flow 按需 |
| 芯片 SDK 最短路径 | UIBuilder、（部分）Beken | 仅当自有芯片方案需要 |
| 应用包 / 热更新 | Persim、FlyThings | 仅当产品需求明确 |
| 量产烧录 / 串口屏主机 | FlyThings | 硬件方案配套时再做 |
| 测控仪器共壳 | **EEZ** | UI 专项默认不追 |

---

## 7. 商业与生态对比（评估用）

| 维度 | UIBuilder | Beken | LVGL Pro | SquareLine | EEZ | Persim | FlyThings |
|------|-----------|-------|----------|------------|-----|--------|-----------|
| 收费叙事 | 随芯片/方案 | 宣传免费 | Community / Product / Platform | Personal / Business / Enterprise | **免费开源**；可选付费 Support | 生态与 SDK | IDE+OS+SOC 授权 |
| 工具许可 | 闭源发行 | 闭源发行 | 官方分层 | 闭源订阅 | **GPL-3.0**（生成物另有说明） | 生态授权 | 授权/SOC |
| 设计器 OS | Win | Win | Win/macOS/Linux | Win/macOS/Linux | **Win/macOS/Linux** | Win+VS Code | Win |
| 芯片锁定 | 强 | 弱 | 弱 | 弱 | **弱**（LVGL 路径） | 强（RTT/Persim） | 强（智能屏/SOC） |
| 典型用户 | 匠芯创方案商 | 成本敏感 LVGL 团队 | 要官方工程化的团队 | 通用嵌入式 LVGL | 要开源/Flow/测控+GUI 的团队 | 车机/穿戴 Persim | 工业 HMI / 串口屏 |
| 与「只做 UI 工具」距离 | 中（偏 SDK） | 近 | 近（偏套件） | 近 | **中**（挂仪器/多类型） | 远（偏生态） | 远（偏整机） |

公开社区亦常将 **EEZ** 与 SquareLine / PicoPixel 并列作 LVGL 编辑器选项；本报告已将其纳入深度对比对象。

---

## 8. 对自研 UI 工具的评估依据

### 8.1 建议的产品定位选择树

```text
是否必须 LVGL / 跨芯片静态固件？
 ├─ 是 → 范式 A
 │     ├─ 要官方级 CI/Figma/声明式？ → 对标 LVGL Pro（格式必须自有）
 │     ├─ 要免费+JSON+快速落地？ → 对标 Beken（ForgeUI）
 │     ├─ 要行业默认心智+Play？ → 对标 SquareLine（ForgeLine）
 │     ├─ 要开源参考 / Wasm 真预览 / Flow？ → 对标 EEZ（ForgeFlow；或直接用官方 EEZ）
 │     └─ 已绑定自有 SoC SDK？ → 对标 UIBuilder（ForgeBuilder）
 └─ 否 → 范式 B
       ├─ 要 JS 轻应用 + 装包？ → 对标 Persim（LiteApp）
       └─ 要 C++ Logic + 智能屏部署？ → 对标 FlyThings（ForgeHMI）
```

结合专项表述（「拖拽即可生成可编译 UI」），**默认落点仍为范式 A 的 Beken/SquareLine 能力交集**；EEZ 用于：

1. **开源实现对照**（CodeGen/Wasm/工程模型可读）  
2. **预览体验上限**（对标 Wasm，MVP 仍建议先 SDL）  
3. **需要现成工具且接受 GPL 时直接采用官方**，而不是从零仿到 Flow+仪器  

默认 MVP 能力集不变：

1. 明文工程（JSON）  
2. 拖拽设计 + 事件  
3. 生成标准 LVGL C（用户区隔离）  
4. PC 可运行验证（优先「生成后 SDL」；有余力再做编辑器内真预览/Wasm）  
5. 文档化接入自有/第三方 SDK  

### 8.2 MVP 功能优先级（评估打分用）

| 优先级 | 功能 | 对标来源 | MVP？ |
|--------|------|----------|-------|
| P0 | 工程 / 多页 / 拖拽 / 属性（几何 + 常用 props）/ 基础控件集 | 七家共有 | 是 |
| P0 | **画布工作台**（标尺/设备框网格/缩放视图/指针坐标/底栏辅助 Tab） | Beken / UIBuilder 截图 | **是**（FR-021a～d、FR-010g） |
| P1 | 全量控件属性（38 种 + extraData）+ Part/State 样式 + 命名主题 | Beken / UIBuilder / Pro / EEZ | 建议 |
| P0 | 明文 Schema + 校验 | Beken / EEZ / 自研共识 | 是 |
| P0 | C CodeGen + 用户区不覆盖 | Beken / UIBuilder / SquareLine / EEZ | 是 |
| P0 | PC 仿真可点选 | Beken / UIBuilder / **EEZ·Pro Wasm** | 是（实现优先 SDL） |
| P1 | 事件动作（切页/改属性/调函数） | SquareLine / Beken / EEZ | 建议 |
| P1 | 字体裁剪、图片资源管线 | LVGL 系工具（含 EEZ） | 建议 |
| P2 | 自研 Wasm 真预览 | EEZ / Pro | 体验升级 |
| P2 | MicroPython | Beken / SquareLine | 按客户 |
| P2 | 多语言 / XLIFF | Beken / UIBuilder / Pro / EEZ | 按产品 |
| P2 | 时间轴动画 | Beken / Pro / SquareLine / EEZ | 可后 |
| P2 | MCP/AI | Beken / Pro | 差异化 |
| P2 | 逻辑可视化（事件图→C） | EEZ Flow（能力对标，格式自有） | 可选 |
| P3 | Figma / Online / CLI 测试 | 几乎仅 Pro | 后期 |
| P3 | 应用包宿主 / 串口屏 so | Persim / FlyThings | 仅范式 B |
| P3 | SCPI 仪器台 | EEZ Instrument | UI 专项不做 |
| — | 官方 `.spj/.bkprj/.aicpro/.ftu/.eez-project`/Pro XML 兼容 | — | **不做** |

### 8.3 实现方案推荐（自研）

| 模块 | 推荐 | 理由 |
|------|------|------|
| 工程格式 | **自有明文 JSON（多文件亦可）** | Git 友好；避开 L4；Beken/SquareLine/EEZ 均验证明文工程 |
| 设计器壳 | Electron+Vue **或** React **或** Qt **或** VS Code 扩展 | Beken/EEZ/UIBuilder/Persim 均可；团队栈优先 |
| CodeGen | 模板引擎（Handlebars/同类）+ 黄金测试 | Beken 路径可复制；EEZ 模板占位符可参考 |
| 预览 MVP | **生成 → CMake → SDL + 本机 LVGL** | 与上板同源；比自研 Play/Wasm 成本低 |
| 预览 V2 | **自研** Wasm 真 LVGL（对标 EEZ/Pro） | 勿盗用官方 `lvgl_runtime_v*` / `lved-runtime` |
| 运行时 | **开源 LVGL**（范式 A）；默认不绑 eez-flow | 授权与生态风险最低 |
| 用户代码 | `generated/` + `custom/`（或 `ui_events`） | 行业已形成心智 |
| 合规红线 | 不读官方 Pro XML 作兼容卖点；不复用 EasyUI/Persimmon/AicUI；**不 GPL 换皮闭源、不闭源搬 EEZ Wasm**；不冒用商标 | 见各重构设计说明 |

### 8.4 风险与反模式

| 风险 | 说明 | 规避 |
|------|------|------|
| 范式混用 | 同时承诺「导出 LVGL C」与「兼容 FlyThings so」 | 路线图拆分产品线 |
| 先做花哨 IDE | 无 Schema/CodeGen 导致不可验收 | 先跑通 Hello 生成与仿真 |
| 追求 L4/L5 | 法律与工程双高成本 | 功能兼容即可 |
| 画布用 Web 冒充最终像素 | Beken/Persim 已暴露「设计器≠板上」 | MVP 即以 LVGL 仿真为准 |
| 把画布 chrome 当远期抛光 | Beken/UIBuilder 标尺/缩放/网格为基本盘 | 需求 V2.18：FR-021a～d、FR-010g 全 P0 |
| 绑定单一芯片过早 | UIBuilder 路径难迁移 | 核心生成器芯片无关；SDK 拷贝做插件 |
| 低估宿主工程 | Persim/FlyThings 像「半个 OS」 | 非明确需求不做 B |
| **把 EEZ 全家桶当 MVP** | Flow+仪器+多类型拖垮专项 | 只仿 LVGL UI 主路径；或直接用官方 EEZ |
| **GPL 换皮当自研闭源** | 合规与商标双风险 | 自写核心 + 宽松许可，或合规开源分发 |

### 8.5 与既有 Forge* / LiteApp 设计的关系

| 自研代号 | 对标 | 何时启用 |
|----------|------|----------|
| ForgeLine | SquareLine | 要跨 OS + Play 心智 |
| ForgeUI | Beken | 要免费 JSON + 快落地 + AI |
| ForgeBuilder | UIBuilder | 要自有 SoC 一键 SDK |
| ForgePro | LVGL Pro | 要声明式 + Wasm + CI/Figma |
| **ForgeFlow** | **EEZ Studio** | **要开源级参考 / Wasm 真预览 / 可选逻辑图；与 ForgeUI 共享内核** |
| LiteApp | Persim | 要 JS 应用包 |
| ForgeHMI | FlyThings | 要 C++/so 智能屏部署 |

**务实策略：** 以 **一套 Schema + CodeGen + SDL 内核** 打底（ForgeUI/ForgeLine/**ForgeFlow** 可共享），再用插件扩展「SDK 拷贝 / Play / 自研 Wasm / MCP / 逻辑图」；Persim/FlyThings 级产品单独立项；**需要完整 EEZ 时优先采用官方而非从零重造仪器台**。

---

## 9. 综合评分（评估用，非排名营销）

评分维度：功能完整度、实现可复制性、跨平台、生态开放、商用友好、与「拖拽→可编译 UI」专项贴合度。分数为相对分（1–5），基于本仓库材料主观综合。

| 产品 | 功能 | 可复制性* | 跨平台 | 生态开放 | 商用友好 | 专项贴合 | 合计 |
|------|:----:|:---------:|:------:|:--------:|:--------:|:--------:|:----:|
| **EEZ** | 5 | 4 | 5 | 5 | 4 | 4 | **27** |
| SquareLine | 5 | 3 | 5 | 5 | 3 | 5 | **26** |
| Beken | 4 | 5 | 2 | 4 | 5 | 5 | **25** |
| LVGL Pro | 5 | 2 | 5 | 4 | 3 | 4 | **23** |
| UIBuilder | 4 | 3 | 2 | 3 | 3 | 4 | **19** |
| Persim | 4 | 2 | 2 | 2 | 2 | 2 | **14** |
| FlyThings | 4 | 2 | 2 | 2 | 2 | 2 | **14** |

\*可复制性：明文格式、生成链路可观察、无强合规禁区时更高。Pro XML / 闭源宿主会拉低；**EEZ 源码全开但 GPL 约束「改壳再闭源分发」**，故给 4 而非 5（对照 Beken「从零自研、许可自定」路径的 5）。

**解读：**

- **专项 MVP 最可执行参考：Beken（实现）+ SquareLine（体验目标）。**  
- **开源对照与 Wasm/Flow 上限参考：EEZ**（要现成且接受 GPL → 直接用官方；要自有产品 → ForgeFlow，先 SDL）。  
- **工程化上限参考：LVGL Pro**（能力天花板，格式勿兼容）。  
- **芯片方案附属参考：UIBuilder。**  
- **应用包/智能屏另册：Persim、FlyThings。**

---

## 10. 总结论

1. **赛道先于功能：** 先选「LVGL 源码导出」还是「宿主应用包」，再谈控件清单与 IDE 壳。  
2. **七家主功能高度同构在「设计器骨架」**；真正拉开差距的是 **预览模型、商业/开源模式、平台锁定、部署深度、工程化（CI/Figma/AI）、以及 EEZ 的 Flow/仪器广度**。  
3. **自研默认：L1+L2，自有 JSON，开源 LVGL，生成区/用户区隔离，SDL（或后续自研 Wasm）验收；拒绝 L4/L5。**  
4. **MVP 最小闭环：** 工程 Schema → 拖拽基础页 → 生成 C → PC 可运行 → 文档接入固件；动画/AI/Figma/Flow/装包后置。  
5. **FlyThings / Persim 是产品形态选项，不是 LVGL 工具的功能补丁**；**EEZ 是范式 A 的开源重装版本**，专项可「用官方」或「吸架构做 ForgeFlow」，不宜把仪器台塞进拖拽 UI MVP。

---

## 11. 参考资料

### 11.1 本仓库文档

| 产品 | 分析 | 仿制 / 综合 | 竞品逆向与重构设计 |
|------|------|-------------|-------------------|
| ArtInChip | `artinchip/ArtInChip_UIBuilder分析文档.md` | `ArtInChip_UIBuilder_仿制方案.md` 等 | `ArtInChip_UIBuilder_竞品逆向与重构设计说明.md` |
| Beken | `beken/博通集成_LVGL_UI_Designer分析文档.md` | `BEKEN_LVGL_UI_Designer实现原理与仿制方案.md` 等 | `BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md` |
| LVGL Pro | `lvgl_pro/LVGL_Pro官方UI工具分析文档.md` | `LVGL_Pro官方UI工具_仿制方案.md` 等 | `LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md` |
| SquareLine | `quareline/SquareLine_Studio分析文档.md` | `SquareLine_Studio_仿制方案.md` 等 | `SquareLine_Studio_竞品逆向与重构设计说明.md` |
| Persim | `rt-thread/Persim_Studio分析文档.md` | `Persim_Studio_仿制方案.md` 等 | `Persim_Studio_竞品逆向与重构设计说明.md` |
| FlyThings | `中科世为/中科世为UI_IDE分析文档.md` | `FlyThings风格UI_IDE仿制方案.md` 等 | `FlyThings_竞品逆向与重构设计说明.md` |
| **EEZ Studio** | **`EEZ Studio/EEZ_Studio分析文档.md`** | **`EEZ_Studio_仿制方案.md`、`EEZ_Studio_分析与仿制方案.md`** | **`EEZ_Studio_竞品逆向与重构设计说明.md`** |

另见：`report/旷明智能专项汇报-UI工具-20260713.md`、`report/要求.txt`、**`report/嵌入式UI工具_立项书.md`**、**`report/嵌入式UI工具_产品定义书.md`**、**`report/嵌入式UI工具_集各家之长_设计需求文档.md`（需求基线）**。

### 11.2 公开站点（抽样）

- https://lvgl.io/pro 、https://lvgl.io/docs/pro/cli  
- https://squareline.io/  
- https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder-introduction.html  
- https://developer.flythings.cn/zh-hans/docs_brief.html 、http://www.zkswe.com/  
- https://www.envox.eu/studio/studio-introduction/ 、https://github.com/eez-open/studio  
- 社区对比线索：LVGL Forum；PicoPixel 等对 SquareLine / EEZ 的公开对比页（版本策略随时间变化，引用时需复核）

---

*本报告为技术选型与自研评估依据，不构成对任何厂商的授权、兼容或商业承诺；商标、许可以及 XML/工程规范以官方为准。*
