# LVGL Pro 官方 UI 工具：分析与仿制方案

> 结构暗示：**上篇分析**（定位 / 原理 / 主要功能 / 优劣）+ **下篇仿制**。  
> 综合 `LVGL_Pro官方UI工具分析文档.md`、`LVGL_Pro官方UI工具_仿制方案.md`、**本机 2.0.1 安装包实测**、官网与授权说明。  
> 对象：**LVGL Pro**（核心 Editor；含 Online Viewer、Figma、CLI）。  
> **格式路线：** 自有 JSON（不对齐 Pro XML）。  
> **功能目标：** 对齐原版 Pro（含 Figma 等）。  
> **宿主补正（实测）：** 官方 Editor = **Theia 1.69 + Electron 40** + `lved` 扩展 + **双版本 `lved-runtime.wasm`** + 内置 **Figma Flow 本机服务**；导出侧有 **.jsc** 保护。

---

# 上篇：工具分析

## 1. 产品定位

LVGL 官方的 **嵌入式 UI 专业工具套件**：声明式工程 + 真 LVGL 预览 + 导出标准 C（或运行时装载），缩短「改 UI → 刷机」循环。

| 组件 | 作用 |
|------|------|
| **Editor** | XML/Design 双模、真预览、导出 C、测试/调试 |
| **Online Viewer** | 浏览器打开 GitHub 工程分享（viewer.lvgl.io） |
| **Figma（LVGL Flow）** | 设计稿同步到 Pro |
| **CLI** | CI 校验、生成 C、跑 UI 测试 |

一句话：

> **不是另一套 GUI 库，而是「XML 声明式 UI + 官方编辑器 + 双路径落地（导出 C / 运行时 XML）」工具链。**

| 项 | 内容 |
|----|------|
| 官网 / 下载 | https://lvgl.io/pro ；Releases 如 v2.0.1 Windows zip |
| 仓库 / 文档 | https://github.com/lvgl/lvgl_editor ；https://lvgl.io/docs/pro/ |
| 平台 | Windows / macOS / Linux |
| 图形库 | LVGL（MIT）；工具与 XML 规范另有授权 |
| 商业 | Community/Evaluation 免费；商用 Product/Platform |

---

## 2. 实现原理

### 2.1 一句话

> **明文 XML 多文件工程 → Editor 内真 LVGL Runtime 解析预览 → 导出 `*_gen` C（或商业 XML Engine 板上加载）→ 普通 LVGL 应用运行。**

易混点：

- 设计器显示的源头是 **XML**；Design 模式改的也是同一套文件。  
- **预览**多数时候是 XML → Runtime 建 `lv_obj` → 真渲染；即使量产走「导出 C」，编辑期预览仍主要靠装载，不是先生成再跑那份 C。  
- 量产 **导出 C** 后板上可不依赖 XML；**运行时 XML** 在 LVGL 9.5+ 已从开源核剥离，偏商业 Engine。

### 2.2 总体架构

```text
Editor / Viewer / Figma / CLI
        │ 读写 XML 工程
        ▼
project.xml + globals.xml + screens/ + components/ + widgets/ + assets
        │
        ├─► 编译期：XML → *_gen.c/h（user 骨架不覆盖）→ 固件
        └─► 运行期：板上 XML Engine 装载（9.5+ 商业）→ 固件
                    │
                    ▼
              普通 LVGL（自备 display/indev）
```

### 2.3 工程模型与三分法

```text
my_project/
├── project.xml / globals.xml / translations.xml
├── fonts/ images/
├── widgets/      ← 可含自定义 C，预览需重编
├── components/   ← 纯 XML 组合，可声明 api
└── screens/      ← 顶层页
```

| 类型 | 本质 | 预览 | 运行时装载 |
|------|------|------|------------|
| Widget | 近内置控件 + 可写 C | 改 C 后重编预览 | 一般否 |
| Component | 纯 XML + 可选 api | 改 XML 即时 | 可以（有 Engine） |
| Screen | 顶层视图 | 即时 | 可以 |

### 2.4 双模编辑与预览

- **XML Mode**：左编辑右真预览（补全/校验）。  
- **Design Mode**：拖拽拼屏，只暴露组件 `api`。  
- **预览机制**：Editor 把 XML 交给内置 LVGL Runtime → 清屏 → 重建实例；可交互。无自定义 C 可用 bundled runtime；有 Widget/手写 C 需 Compile（如 Emscripten）更新 preview-bin。  
- **Inspector**：尺寸、padding/margin、点击区、预览上拖改几何。

### 2.5 代码生成（编译期路径）

1. 解析工程 → 生成 `*_gen.c/h`（覆盖）  
2. 用户骨架首次生成后不覆盖  
3. 入口如 `project_init(asset_path)`、`main_screen_create()`  
4. 风格接近手写 LVGL；不含驱动；可再包 wrapper  

### 2.6 授权与规范要点

- Pro 工具：非商用/评估免费；正式商用需付费。  
- **XML Specification**：固件内使用通常无碍；**对外发布「读写该规范」的编辑器/生成器需 LVGL LLC 许可**。  
- CLI 等专业能力通常不在 Community/Evaluation。

### 2.7 与板端关系

工具 = 设计 / 预览 / 导出 / 协作 / CI，不是芯片烧录 IDE。上板：导出 C → 并入已移植 LVGL 的 SDK → 调 init / screen load。

---

## 3. 主要功能、优劣与对比

### 3.1 主要功能

依据官网、GitHub README、Pro 文档与本机 **2.0.1**。完整表见分析文档 §3；此处为压缩版。

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| 套件 | Editor + Online Viewer + Figma Flow + CLI | 跨 Win/macOS/Linux |
| 工程 | 多文件明文 XML；Git/AI/CI 友好 | HTML 风格；贴 LVGL API 命名 |
| 编辑 | XML Mode + Design Mode | 组件 `api` 约束设计面 |
| 预览 | 真 LVGL **Wasm** + Inspector | 实测双版本 9.4/9.5；可重编自定义 Widget |
| 专业能力 | Subjects 绑定、Timeline、翻译、UI Test、多 Target | 资源/内存规划 |
| 落地 | 导出标准 C；可选运行时 XML | gen/user 分离；板上 Engine 授权需核对 |
| 协作 | Figma 同步；viewer.lvgl.io 分享 | 本机 Flow 桥写 XML |
| 工程化 | CLI validate/generate/test；Editor 内调试 | 商用档 CLI token |
| AI | 官方 MCP Server | 读写/生成 XML |
| 其它 | 脚手架（UI Only/VS Code/Zephyr/Linux）+ 大量示例 | Community～Platform 授权分层 |

闭环：**组件/屏 XML → 真预览 →（可选）Figma/在线 → 导出 C 或 CI → 上板**。

### 3.2 优点

官方同源；真 LVGL 预览；双路径落地；工程可版本化；可扩展预览（自定义 C）；工程化强；相对按座订阅更清晰的产品授权表述。

### 3.3 缺点

学习曲线偏开发者；商用付费；运行时 XML 商业化；XML 规范限制第三方工具；Design 依赖先写组件；自定义 Widget 要重编；导出源码需守 generated/user 纪律；IDE 体积大。

### 3.4 对比

| | LVGL Pro | BEKEN Designer | SquareLine |
|--|----------|----------------|------------|
| 工程源 | 官方 XML 多文件 | `.bkprj` JSON | 专有工程 |
| 预览 | 真 LVGL + 可重编 C | DOM 近似 + SDL 仿真 | 真 LVGL 向 |
| 产出 | C；可选运行时 XML | C / MicroPython | C / MicroPython |
| CI/协作 | CLI + Viewer + Figma | 偏本机；MCP 改画布 | 视版本 |
| 平台 | Win/macOS/Linux | 官方 Windows | 视发行 |
| 费用 | 非商用免费；商用授权 | 厂商免费宣传 | 订阅为主 |

### 3.5 适用

**适合：**已选 LVGL、要组件库化/Git/CI、接受商用授权、量产导出 C。  
**不适合：**要零成本商用纯拖拽、强依赖免费板上动态 XML、做对外兼容官方 XML 的竞品工具、非 LVGL 栈。

### 3.6 分析结论

> Pro = **Theia+Electron IDE + 官方 XML + 双版本 Wasm 真预览（含编辑器内 XML 装载）+（部分保护的）C 导出 + 内置 Figma Flow 本机桥**。  
> 主要功能面覆盖声明式双模、真预览、专业绑定/动画/测试、四件套协作与 CI；强在官方同源与工程化；弱在学习成本、商用、体积与规范合规边界。

实测补充见分析文档 **§1.1 安装包实测摘要**（安装目录、Theia/Electron 版本、`preview-bin`、Flow 端口预设、`.jsc` 等）。

---

# 下篇：仿制方案

## 4. 路线锁定与合规红线

### 4.1 已选定：技术自研（自有声明式格式）

本方案 **不再把「兼容官方 Pro XML」列为仿制实现选项**。仿制一律采用：

| 项 | 约定 |
|----|------|
| **格式** | **自有声明式 Schema**；序列化 **优先 JSON 多文件**，可选 YAML；若用标记方言，须与官方 Pro XML **可区分且不同构** |
| **兼容性** | **不对齐、不导入/导出、不宣称兼容**官方 Pro XML；Figma/CLI/Online 等能力用自有工程承接 |
| **量产落地** | 主路径只做 **导出标准 LVGL C**（`generated`/`user` 分离） |
| **功能面** | **对齐原版 Pro**（含 Figma 读取/导入、在线预览、CLI、专业能力等） |
| **板上动态 UI** | 二期可自研轻量 loader 吃**自有格式**；勿依赖或逆向官方商业 XML Engine |

**商务路径说明：** 若必须使用 **官方 Pro XML 工程格式** 与官方商业支持，应直接采购 LVGL Pro——那是「用官方产品」。本仿制方案在 **自有 JSON** 上实现 **与 Pro 同级的功能面**（含自研 Figma 插件、在线预览等），二者择一，勿混用格式。

### 4.2 官方 XML 规范边界（为何必须自有格式）

| 允许 | 不允许（无书面许可） |
|------|----------------------|
| 固件用官方 XML；用官方 Editor/CLI | 对外发布读写**该规范**的编辑器/设计器/生成器 |
| **组织内**自用脚本处理该规范 | 把内部 XML 工具开源/对客/做公开 API |
| UI 随产品固件分发 | 在通用工具里实现该规范以提供类似 Pro 的创作能力 |

自研工具读写的是 **自有 JSON/YAML/方言**；Figma 插件输出也必须是自有工程，不得写官方 Pro XML。

---

## 5. 仿制目标：功能对齐 Pro，格式自有

### 5.0 总原则

| 维度 | 要求 |
|------|------|
| **功能** | **对齐原版 Pro 公开能力面**：Editor（声明式+Design）、真 LVGL 预览与 Inspector、C 导出、CLI、**Figma 设计读取/导入**、在线分享预览、Subjects/动画/翻译/UI Test、自定义 Widget、MCP 等 |
| **格式** | 全部落在 **自有 JSON 工程**；不对齐官方 Pro XML |
| **实现** | 可自研等价能力（如自有 Figma 插件 → JSON），不必复刻 VS Code 壳或官方 Viewer 域名 |

一句话：

> **功能对齐 Pro 四件套 + 专业能力；工程与 Figma 落点一律自有 JSON → 真 LVGL 预览 → generated/user 导出 C → CLI/协作。**

### 5.1 功能对照表（应对齐 vs 不要对齐）

| Pro 能力 | 功能对齐方式（自有格式） | 不要对齐 |
|----------|--------------------------|----------|
| 多文件声明式工程 | 自有 JSON Schema 多文件 | 官方标签/属性集、Pro XML 读写 |
| XML Mode + Design | JSON/Monaco + Design 双模，同一 IR | 必须做成 VS Code 发行版 |
| 真预览 + Inspector | Runtime 解析自有工程→真 LVGL | DOM 当唯一验收 |
| 导出 C | `*_gen` / user 分离，标准 LVGL C | 官方导出文件名/API 兼容层 |
| **Figma（LVGL Flow 类）** | **自研 Figma 插件：读 Figma 文件/选区 → 写自有 JSON**（样式、组件、屏、资源、标注控件类型、原型跳转、可选绑定） | 输出官方 Pro XML；依赖官方 Flow 插件 |
| Online Viewer | 自建 Web 预览（读 Git/上传自有工程） | 复刻 viewer.lvgl.io 品牌 |
| CLI | validate / generate / test / 截图 | 官方 CLI token 体系 |
| Subjects / Timeline / i18n / UI Test / MCP | 在自有 Schema 中一等公民实现 | 绑定官方 XML MCP |
| 自定义 Widget | 用户 C + 重编 preview-bin | 官方 XML Engine |

### 5.2 目标架构（含 Figma / 在线）

```text
┌──────────────┐     本地桥接      ┌─────────────────────────────────┐
│ Figma 插件   │ ────────────────► │ Designer（声明式+Design+预览）   │
│ 读设计/标注  │   写入自有 JSON    │ Inspector / 资源 / 多 Target     │
└──────────────┘                   └───────────────┬─────────────────┘
                                                   │ 自有工程
        ┌──────────────┐                           ▼
        │ Online 预览  │◄── 打包/Git ──  project.json + screens/ + …
        └──────────────┘         │
                                 ├─► CodeGen → generated/* + user/* → LVGL C
                                 ├─► Preview Runtime（真 LVGL）
                                 └─► CLI（validate/generate/test）
```

**Figma 链路（对齐 Pro Flow 思路，换落点格式）：**

```text
Figma 文件
  → 社区插件导出
  → Editor 本机服务（官方实测端口预设 Alpha 9111/9112 等）
  → 官方写 XML；本方案改为写 globals.json + screens/ + components/ + assets/
  → 真 LVGL 预览校验 → 再导出 C
```

官方安装包内为 Theia 扩展 `lvgl.flow`（Express+WS+sharp）；仿制应对齐该 **本机桥模型**，但输出自有 JSON。预览应对齐 **按 LVGL 版本打包的 Wasm runtime**（官方为 `lved-runtime.wasm`，含 v9.4/v9.5），而非长期只靠 DOM。

壳选型务实建议：

| 路径 | 说明 |
|------|------|
| **轻量（推荐起步）** | Electron/Tauri + 自研工作台 + Wasm/SDL 预览 + 独立 Figma 服务进程 |
| **重 IDE（功能外形更像 Pro）** | Theia / Code-OSS 二次分发 — 工期与体积接近官方，慎选首期 |

### 5.3 与仿 Beken 对比

| | 本方案（功能对齐 Pro） | 仿 Beken |
|--|------------------------|----------|
| 功能面 | **对齐 Pro**（含 Figma/CLI/在线等） | 偏拖拽+仿真+厂商包 |
| 工程 | 自有多文件 JSON + 组件 api | 单文件 JSON 树 |
| 预览 | **真 LVGL 优先** | DOM + 另开 SDL |
| 与官方 Pro XML | **主动不兼容** | 无关 |

### 5.4 分期（功能对齐，分期交付）

**MVP（核心可上板，约 4～7 人月）：**  
自有 JSON Schema；8～12 控件；多页+简单事件；CodeGen；真预览（可 SDL）；Design 基础；SDK 文档。  
*暂缓但已列入总目标：* Figma、Online、Test、Subjects 全量。

**V1（专业 Editor + CLI，约再 4～6 人月）：**  
Component `api`；样式/资源；双模+Inspector；CLI validate/generate；多分辨率；**Figma 插件 MVP**（样式+基础屏/组件+资源 → JSON）；Wasm 预览可选。

**V2（对齐 Pro 差异化能力，约再 6～10 人月）：**  
Figma 增强（标注控件类型、原型导航、variants、绑定）；Subjects/Timeline/i18n；UI Test；Online 预览；自定义 Widget；自有 MCP。

**明确永不做：** Pro XML 兼容/转换；复刻官方品牌与授权体系。

---

## 6. 工作拆分（按顺序）

**原则：自有 Schema → CodeGen → 真预览 → Designer → CLI → Figma → Online/高级能力。禁止 Pro XML 兼容包；Figma 为正式工作包，不是「可选彩蛋」。**

| 序号 | 工作 | 周期 | 交付 |
|------|------|------|------|
| 0 | 范围与合规备忘 | 2～3 天 | 自有 JSON；**功能对齐清单**（对照 Pro）；`compliance.md` |
| 1 | 自有 Schema + 示例 | 1～2 周 | JSON Schema；双页 Hello |
| 2 | CodeGen CLI | 2～3 周 | generated + user + cmake |
| 3 | Preview Runtime | 2～4 周 | 只加载自有格式→lv_obj |
| 4 | Designer MVP | 6～10 周 | 库/树/属性/Design/预览 |
| 5 | SDK 接入包 | 1～2 周 | 最小 CMake + 文档 |
| 6 | V1：api/样式/Inspector/CLI | 1～2 月 | 专业编辑闭环 |
| **7** | **Figma 插件 + 本机桥** | **1.5～3 月** | **读 Figma→写自有 JSON**；样式/屏/组件/资源；与 Editor 联调 |
| 8 | V2：绑定/动画/i18n/Test | 2～4 月 | 对齐 Pro 专业能力 |
| 9 | Online 预览 + MCP + Widget 重编 | 按需 | 协作与扩展 |

粗算：到 V1+Figma MVP 约 **12～18 人月**；功能面接近 Pro 公开套件约 **22～30 人月**（含 Figma/Online/Test）。  
人员：嵌入式 + 前端 + **Figma 插件（TS）** + Schema/工具链。

---

## 7. 关键落地怎么做

### 7.1 自有工程格式（JSON 优先）

权威数据为 **自有 IR**；磁盘默认 **JSON 多文件**（YAML 为同 Schema 可选序列化）。

```text
my_ui/
├── project.json / globals.json / translations.json?
├── screens/*.screen.json
├── components/*.comp.json
├── widgets/
├── assets/
├── generated/
└── user/
```

Figma 导入结果必须写入上述结构，不得生成官方 `project.xml`。  
**禁止：** Pro XML 作为本工具输入输出。

### 7.2 CodeGen / 真预览 / Designer

- CodeGen：只消费自有工程 → `*_gen` + `user` + cmake。  
- Preview：只实现自有格式 loader（SDL MVP → Wasm）。  
- Designer：Electron/Tauri + Monaco（JSON Schema）+ Design；预览条含 **连接 Figma 插件**（对齐 Pro 工具条能力）。

### 7.3 Figma 读取与导入（功能对齐重点）

对齐官方 Flow（安装包 `lvgl.flow` 0.2.0-rc.1 行为），**输出改为自有 JSON**：

| 能力 | 说明 |
|------|------|
| 本机桥 | 插件 ↔ 本地 HTTP/WS；预设多组端口防冲突（官方 Alpha **9111/9112**） |
| 读设计 | 屏/组件/variants、Auto Layout、token、资源 |
| 意图标注 | 层→控件类型；可选 subject、原型跳转 |
| 落盘 | **仅自有 JSON 树**；禁止写官方 `globals.xml` / Pro 工程 |
| 图像 | 导出光栅资源（官方用 sharp）；字体可离线策略 |
| Inspect | 单层样式写入当前 JSON 节点 |

实现注意：维护 Figma→自有控件映射表；导入后强制真 LVGL 预览；勿解包/复用官方 Flow 或 `code-export.jsc`。

### 7.4 真预览（对齐官方 Wasm 模型）

官方实测：`@lved-runtime-resources/v9.x/preview-bin/lved-runtime.wasm`。仿制建议：

- MVP：SDL Host 吃自有 JSON  
- V1：自研 `*-runtime.wasm`（锁定 1～2 个 LVGL 小版本）嵌编辑器  
- 自定义 Widget：重编 preview-bin（与官方 `preview-build` 思路一致）  

### 7.5 CLI / Online / 仓库

```text
ui-cli validate | generate | preview-build | test
packages/: schema, codegen, preview-host, designer, figma-plugin, online-viewer
```

**不要**首期做完整 Theia 发行版，除非明确要「外形也像 Pro IDE」。

---

## 8. 选型、验收与风险

### 8.1 买 Pro / 本方案 / 仿 Beken

| 诉求 | 建议 |
|------|------|
| 必须官方 Pro XML + 官方支持 | **买 Pro** |
| 要 Pro 级功能（含 Figma）且自控、对外可发 | **本文：自有 JSON + 功能对齐** |
| 只要轻量拖拽+仿真 | Beken 路线 |

### 8.2 验收

**MVP：** 自有 JSON 双页 UI；真 LVGL 预览切页；generate+user 不丢；可上板；明示不兼容 Pro XML。  
**V1：** Component api；CLI 进 CI；**Figma 插件可将选定 Frame 导入为 screens/components/assets 并预览正确**。  
**V2：** 标注控件类型与导航可用；Subjects/动画/Test/Online 至少各有一条主路径验收。

### 8.3 风险

| 风险 | 对策 |
|------|------|
| Figma API/布局语义复杂 | 先 Frame+基础组件+样式；标注强制意图；视觉回归 |
| 做成 Pro XML | 合规门禁；插件只写自有 Schema |
| 范围膨胀拖死 MVP | 分期不变：先可上板，再 Figma，再高级能力 |
| 预览≠设计稿 | 导入后强制真 LVGL 预览验收 |

---

## 9. 总结论

| 维度 | 结论 |
|------|------|
| Pro 本质 | XML 工程 + 真预览 + C 导出 + Figma/CLI/在线等套件 |
| **格式（已锁定）** | **自有 JSON**，不兼容 Pro XML |
| **功能（已锁定）** | **对齐原版 Pro**（含 **Figma 读取/导入**、CLI、在线、绑定/动画/测试等） |
| 落地顺序 | Schema → CodeGen → Preview → Designer → CLI → **Figma** → Online/高级 |
| 若要官方 XML | 买 Pro，不改本方案格式 |

一句话：

> **格式走自有 JSON；功能对齐 Pro（含 Figma）。官方实测为 Theia+双版本 Wasm 预览+Flow 本机桥——仿制应对齐能力与架构要点，用自有格式与自研运行时落地，勿兼容 Pro XML、勿复用 .jsc/Flow 闭源件。**

公开能力对标见分析文档 **§3** / 仿制方案 **§0.4**；落地总设计见 **`LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md`**。

---

## 参考资料

1. `lvgl_pro/lvglpro信息.txt`；本机 `D:\Program Files\LVGL_Pro_Editor`（2.0.1）  
2. `lvgl_pro/LVGL_Pro官方UI工具分析文档.md`（§3 主要功能；§1.1 安装包实测）  
3. `lvgl_pro/LVGL_Pro官方UI工具_仿制方案.md`（§0.4 功能对标）  
4. `lvgl_pro/LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md`  
5. https://lvgl.io/pro ；GitHub README Features；https://lvgl.io/docs/pro/figma  
6. https://lvgl.io/docs/pro/syntax/xml-license  
7. 对照：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`  

---

*综合技术分析与落地建议；安装包分析限于目录与清单级。不构成法律意见。*
