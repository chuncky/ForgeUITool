# BEKEN LVGL UI Designer：实现原理与仿制方案

> 范围：博通集成 **BEKEN LVGL UI Designer**（可视化设计 → 导出 LVGL 源码）。  
> 依据：官方文档/GitHub、本地 `lvgl_ui_designer_2.0.3` 包结构（含 `app.asar` 字符串与资源目录）、后续技术拆解。  
> 仿制目标：合法自研同类工具，**不复制**其闭源 `app.asar`、品牌资源与专有授权逻辑。

---

## 第一部分：实现原理

### 1. 一句话概括

> **Electron + Vue 设计器编辑明文 JSON 工程（`.bkprj`）→ Handlebars 生成标准 LVGL C/MicroPython → 本机 SDL+LVGL 仿真 → 生成目录并入芯片 SDK 交叉编译上板。**

要点澄清（易混）：

- **不是**把 Vue 网页/DOM 编译成 C。  
- Vue 只负责 **PC 上编辑与近似预览**；权威数据是 **JSON**；真显示效果靠 **LVGL 再渲染**（仿真或板端）。  
- 板上 **没有** 闭源 GUI 解释器；运行时就是开源 **LVGL**。

---

### 2. 原厂技术栈清单（本地包可核对）

| 层级 | 技术 | 证据/说明 |
|------|------|-----------|
| 桌面壳 | **Electron** | `LVGL-UI-Designer.exe`、`LICENSE.electron.txt`、`*.pak` |
| 设计器前端 | **Vue 3 + TypeScript** | asar 中 `vue` / `vue3` / `createApp`；控件定义路径 `*.ts` |
| 构建 | **Vite** | asar 中可见 |
| UI 组件库 | **Element Plus** | asar 中可见 |
| 状态/路由/工具 | **Pinia**、**vue-router**、**@vueuse** | asar 中可见；拖拽等可用 VueUse |
| 代码查看编辑 | **Monaco Editor** | asar 中可见 |
| 工程数据 | **明文 JSON（`.bkprj`）** | 示例可直接 `JSON.parse` |
| 画布预览 | **DOM 绝对定位 + WidgetRenderer** | asar 中 `WidgetRenderer`、`position:absolute`、`style.left`、`useDraggable`；**未**见 Konva/Fabric/Pixi |
| CodeGen | **Handlebars（`.hbs`）** | `resources/templates/**/*.hbs`；asar 含 handlebars |
| 生成语言 | **C（LVGL API）**、**MicroPython** | 双模板目录；工具栏分入口 |
| PC 仿真 | **LVGL + SDL2 + C** | `lv_port_pc_simulate`；`#include <SDL.h>` |
| 本机工具链 | **w64devkit、CMake、SDL2** | `resources/tools/win/` |
| AI | **MCP（Node `.cjs`）+ Bridge + Skill** | `resources/mcp/`、`ai-skill/`；对接 Cursor/TRAE/Codex |

同类成熟工具（同一赛道，非 Vue→C）：SquareLine Studio、NXP GUI Guider、LVGL 官方 UI Editor 等。

---

### 3. 分层架构

```text
┌──────────────────────────────────────────────────────────────┐
│ L1 宿主：Electron + Vue3 工作台                               │
│   画布(DOM近似) / 组件库 / 组件树 / 属性 / 事件 / 资源 / AI   │
└────────────────────────────┬─────────────────────────────────┘
                             │ 读写 .bkprj（JSON）
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ L2 文档模型：工程 JSON                                        │
│   settings + pages[] + components + style + events + assets  │
└────────────────────────────┬─────────────────────────────────┘
                             │ CodeGen（Handlebars）
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ L3 生成物：beken_generated/ + custom/ + *.cmake               │
│   C：lv_* API  │  MicroPython：lvgl 绑定调用                  │
└───────────────┬────────────────────────────┬─────────────────┘
                ▼                            ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│ L4a PC 仿真              │    │ L4b 板端                     │
│ LVGL + SDL2 + 工具链     │    │ SDK LVGL port + 交叉编译     │
│ C：生成→编译→运行        │    │ 调用 beken_ui_init() 等      │
│ MP：生成→解释运行        │    │                              │
└──────────────────────────┘    └──────────────────────────────┘
```

可选 **L5 AI**：外部 LLM 经 MCP 改 L2，设计器按同一模型刷新画布。

---

### 4. 设计器如何工作（核心）

#### 4.1 工程数据：就是 JSON

扩展名 **`.bkprj`**，内容为 UTF-8 JSON。逻辑结构：

```text
Project
 ├─ name / lvglVersion / resolution
 └─ pages[]
      └─ components[]（树）
           type / name / wid
           properties[]     → x,y,width,height,text,flags…
           style.parts[].states[].styles[]  → 对齐 LVGL Part/State
           children[] / layout / events[]
```

保存 = 序列化该对象；打开 = 反序列化；AI/手动/撤销都改这份数据。

#### 4.2 画布显示：DOM 近似，不是编辑器内嵌 LVGL

```text
JSON 控件树
  → 每个节点一个 Vue 组件（WidgetRenderer）
  → CSS position:absolute; left/top/width/height
  → 按 type 画文字/色块/图片/边框等「皮肤」
  → 叠加网格、参考线、选中框、拖拽手柄
```

| 场景 | 用什么显示 |
|------|------------|
| 设计期拖拽画布 | Electron 里 **Vue + DOM 近似渲染** |
| 工具栏「运行」仿真 | **真 LVGL + SDL** 窗口 |
| 板端 | **真 LVGL**（芯片 port） |

因此画布与真机可能有细微视觉差；**以仿真/板端为准**。

#### 4.3 多视图绑定同一模型

```text
                ┌── 画布（几何 + 近似绘制）
  工程 JSON ────┼── 组件树（层级、锁定、显隐）
                ├── 属性/样式面板（Part×State）
                └── 事件面板（触发→动作）
```

拖入控件、改坐标、改颜色 = 改 JSON → 各视图刷新。撤销 = 工程快照/命令栈。

#### 4.4 「Vue 如何变成 C/Python」——纠正

**不会转换 Vue。** 正确链路：

```text
设计器（Vue）编辑 ──► .bkprj JSON
                         │
                         ▼ Handlebars 模板
              generated/*.c  或  *.py（调用 LVGL）
                         │
                         ▼
              LVGL 渲染 → 与设计接近的界面
```

MicroPython 生成物用途：① 本机快速预览（生成即跑）；② 跑在 MicroPython+LVGL 的产品上。量产 C 固件一般用 **C 导出**。

---

### 5. 代码生成与仿真

#### 5.1 CodeGen

`resources/templates/c/` 等目录：

- `beken_ui.h.hbs` / `beken_ui.c.hbs`：句柄结构体、`beken_ui_init`  
- `page_init.c.hbs`、`event_runtime.*.hbs`、`partials/widgets/*`  
- `custom/`：重新生成不覆盖；业务写这里  
- `beken_generated.cmake`：供 SDK/CMake 收录  

策略：「生成代码」保护 `custom/`；「全部清理」才重置生成区/仿真模板。

#### 5.2 仿真

C：`lv_init` → `sdl_hal_init` → `beken_ui_init` → `lv_timer_handler` 循环。  
内置 w64devkit/CMake；版本升级常需删除工程内旧 `lv_port_pc_simulate` 再生成。

#### 5.3 事件

设计器存「CLICKED → 跳转/改属性/改样式/调函数/自定义代码」；CodeGen 生成 `lv_obj_add_event_cb`、`lv_screen_load` 等。非 Android Activity 栈。

---

### 6. AI 如何接入、改什么、怎么显示

```text
Cursor/TRAE 自然语言
  → MCP 工具（stdio，Electron 以 Node 跑 mcp.cjs）
  → Bridge（如 http://127.0.0.1:39001）
  → Designer 改内存中的工程 JSON
  → 画布/树/属性即时重绘（与手动编辑同一刷新链）
  → 用户「保存/撤销」确认整轮 AI 任务
```

AI **主要改**：页面/组件树、属性、样式、事件、资源（如导入 PNG）、动画/i18n（视版本）。  
AI **不直接改**：已生成的固件 C（除非之后再点生成）。  
显示：模型变更驱动 DOM 画布刷新；可用截图 MCP 供模型对照；真 LVGL 仍需再跑仿真。

---

### 7. 与 FlyThings 差异

| | BEKEN LVGL Designer | FlyThings IDE |
|--|---------------------|---------------|
| 产出 | LVGL **源码** | 专有 `.ftu` + `libzkgui.so` |
| 板上 | 开源 LVGL | 闭源 EasyUI 宿主 |
| 设计文件 | 明文 JSON `.bkprj` | `ZKSW`+zlib+JSON |
| 宿主 | Electron + Vue | Eclipse CDT |
| 画布 | DOM 近似 | 设计期预览（另一套） |
| 锁定 | 弱 | 强 |

仿制 Beken = 仿 **SquareLine 式「可视化 + 导出 LVGL 源码」**，不是仿专有 HMI OS。

---

### 7.5 主要功能面（对标用）

依据官方 README、工作台文档、发行说明与本地 **2.0.3**。详表见 `博通集成_LVGL_UI_Designer分析文档.md` §3。

| 类别 | 原厂主要功能 | 仿制建议落点 |
|------|--------------|--------------|
| 环境 | Windows Electron；免费 | MVP：Win 或跨平台壳 |
| 工程 | 多项目、`.bkprj`、模板/导入导出、存档历史 | MVP：自有 JSON 工程；V1：模板/存档 |
| 工作台 | 五区 + 网格/参考线/撤销/多页 | MVP：五区；对齐增强 V1 |
| 组件 | 30+ + 自定义组件 | MVP：8～12；V1：20+ 与自定义 |
| 样式 | Part/State、样式库、主题、Flex | MVP：Main+Default；V1：全 Part/State + 库 |
| 事件 | 跳转/改属性样式/调函数/自定义代码 | MVP：切页 + custom；V1：其余 |
| 动画 | 时间轴关键帧 | V1～V2 |
| 资源 | PNG/TTF、自定义字符 | MVP：基础图字；V1：字符裁剪 |
| 多语言 | 语言包/翻译/切语言动作 | V1 |
| 生成 | C + MicroPython；`custom/`；cmake | MVP：C + custom；MP 可选 V1 |
| 仿真 | 生成→编译→运行 | MVP 必做 |
| AI | MCP + Cursor/TRAE 等 | V2 / 按需 |
| 导出设置 | 自定义 generated 路径 | V1 |

闭环主路径：**设计 → 生成 C/MP → 仿真 → 并入 SDK → `beken_ui_init()` 上板**。

---

## 第二部分：仿制方案

### 8. 目标与边界

#### 8.1 MVP 应对齐

| 能力 | 说明 |
|------|------|
| 拖拽设计 | 画布 + 库 + 树 + 属性 |
| 工程 | 明文 JSON + Schema |
| CodeGen | 至少 **LVGL C**（锁 9.x 某一 minor） |
| 隔离 | `generated/` 可覆盖，`custom/` 不覆盖 |
| 仿真 | SDL+LVGL，一键生成→编译→运行 |
| 事件 | 点击切页 / 调 custom 函数 |
| 控件 | 先 8 个内：panel/label/btn/img/slider/bar/switch/obj |

完整原厂功能对标见 **§7.5** / 分析文档 §3。

#### 8.2 首期不做

不兼容 `.bkprj`、不搬 asar、不做整机烧录 IDE、可不做 MicroPython/i18n/动画/AI。

---

### 9. 仿制要做的具体工作（按顺序）

> 原则：**先打通 JSON→C→仿真，再做漂亮设计器。**

#### 工作 1：定工程 JSON 格式（约 3～5 天）

- 交付：JSON Schema + 手写示例工程  
- 内容：页面、控件字段、样式、事件约定  

#### 工作 2：CodeGen CLI（约 1～2 周）——优先

- 交付：`ui-codegen project.json -o generated/`  
- 技术：Node/TS 或 Python + **Handlebars/Nunjucks**  
- 产出：`ui_init`、页面创建、简单事件、`custom/` 空钩子、`ui.cmake`  
- 验收：手写 JSON → 生成 C 能编译  

#### 工作 3：PC 仿真（约 1～2 周）

- 交付：LVGL+SDL 工程模板 + 脚本「生成→cmake→运行」  
- 验收：改 JSON 文字 → 仿真窗口文字变化  

#### 工作 4：设计器界面（约 1.5～2.5 月）——工作量最大

见下一节专章。

#### 工作 5：接入芯片 SDK（约 1～2 周）

- 文档：`generated/`/`custom/` 如何进 SDK、如何调用 `ui_init()`  
- 验收：同套生成代码板端可显示  

#### 二期可选

更多控件、MicroPython、Flex/动画/i18n、MCP AI、云示例/存档。

---

### 10. 工作 4 专章：设计器怎么做、用什么工具

#### 10.1 推荐工具链

| 用途 | 推荐 |
|------|------|
| 桌面壳 | **Electron**（electron-vite）或 **Tauri 2** |
| 前端 | **Vue 3 + TypeScript** |
| UI 库 | **Element Plus** |
| 状态 | **Pinia**（存整份 project JSON + 选中项） |
| 画布 | **DOM 绝对定位** + **@vueuse**（拖拽）；不必上 Konva |
| 撤销 | 深拷贝快照栈，或 immer 补丁 |
| 调 CLI | Electron `child_process` / Tauri Command |
| 打包 | electron-builder / Tauri 打包 |

与原厂对齐：**Electron + Vue3 + Element Plus + DOM 画布**；仿制时也可选 Tauri 减轻体积。

#### 10.2 模块怎么实现

| 模块 | 具体做法 |
|------|----------|
| 工程管理 | 主进程读写下 JSON；新建时写分辨率等默认字段 |
| 组件库 | 元数据列表（type+默认 props）；drag 到画布 push 节点 |
| 画布 | `v-for` 渲染 Widget；`:style={left,top,width,height}`；拖动手势写回 x/y/w/h |
| 组件树 | `el-tree` 绑定同一数组；选中/删除/锁定/隐藏改字段 |
| 属性面板 | `el-form` 按 type 换表单项；v-model 绑 JSON → 画布自动刷新 |
| 事件面板 | 存 `{trigger, action, target}`；生效靠 CodeGen |
| 资源 | 复制到 `assets/`，JSON 记相对路径；画布用本地 URL 显示 |
| 生成/仿真 | 先保存 JSON，再 spawn 工作 2/3 的命令，日志进面板 |
| 撤销重做 | 每次修改后 `history.push(clone(project))` |

#### 10.3 设计器内落地顺序

1. 空壳 + 读写假 JSON  
2. 画布只读渲染矩形/文字  
3. 拖拽改坐标 + 属性面板  
4. 组件库拖入  
5. 树、删除、撤销  
6. 接「生成」「仿真」按钮  
7. 事件、资源  

#### 10.4 建议仓库结构

```text
ui-designer/                 # 工作 4
├── electron/ 或 src-tauri/
├── src/
│   ├── stores/project.ts
│   ├── views/Home.vue / Workspace.vue
│   └── components/ Palette / Canvas / WidgetView / Outline / PropPanel
ui-codegen/                  # 工作 2
simulator-template/          # 工作 3
```

用户工程：

```text
MyLvglUi/
├── project.json
├── assets/
├── generated/     # 可覆盖
├── custom/        # 不覆盖
└── simulator/     # 可选
```

---

### 11. 人员与周期

| 角色 | 职责 |
|------|------|
| 嵌入式 | 仿真模板、生成代码可编译、SDK 接入 |
| 工具前端 | Electron/Vue 设计器 |
| 中间层 | Schema、CodeGen 模板、一键脚本 |

| 阶段 | 周期 | 交付 |
|------|------|------|
| P0 | 2～3 周 | 工作 1～3：手写 JSON→C→仿真 |
| P1 | 6～10 周 | 工作 4 MVP + 接仿真 |
| P2 | 4～6 周 | 样式/资源/导出完善、示例 |
| P3+ | 持续 | 控件扩展、MP、AI… |

可内测约 **3～5 人月**；接近 Beken 1.x 密度约 **10～15 人月**（不含 AI）。

---

### 12. 验收标准

1. 设计器拖出：背景 + Image + Label + 两 Button（无需手写 JSON）  
2. BtnA 切页；BtnB 在 `custom` 计数并改 Label  
3. 一键 PC 仿真正确  
4. 再改样式后生成，`custom` 逻辑仍在  
5. 生成代码可进最小 CMake+LVGL 工程桌面运行  

---

### 13. 风险与对策

| 风险 | 对策 |
|------|------|
| 画布 ≠ 真 LVGL | 关键路径强制仿真；画布只求可编辑 |
| LVGL API 变 | 锁版本；模板目录按版本拆分 |
| 覆盖用户代码 | 严格 `generated/` vs `custom/` |
| 控件膨胀 | 注册表：元数据 + 画布渲染 + hbs partial |
| Electron 体积 | 工具链外置或改用 Tauri |
| IP | 自研实现与模板；遵守 LVGL 许可；勿搬 asar |

---

### 14. 结论

**原厂**：Electron+Vue 编辑 JSON → Handlebars 出 LVGL C/MP → SDL 仿真/SDK；画布用 DOM 近似；AI 用 MCP 改同一 JSON。主要功能面对标见 **§7.5**。

**仿制抓手**（五件事）：

1. 定 JSON  
2. 做 CodeGen（JSON→LVGL C）  
3. 接 SDL 仿真  
4. 用 Electron/Vue 做拖拽编辑器（读写 JSON）  
5. 文档化接入 SDK  

> **文档模型 ↔ DOM 设计器三视图 ↔ 模板 CodeGen（custom 隔离）↔ 桌面仿真 ↔ CMake 导出**

不要仿闭源运行时，不要试图「Vue 编译成 C」。公开卖点（免费、30+ 组件、仿真、双语言、AI）应用 **工程闭环** 兑现，而不是复刻品牌与 asar。

---

## 参考

1. `beken/博通集成_LVGL_UI_Designer分析文档.md`（§3 主要功能）  
2. `beken/博通集成_LVGL_UI工具_分析与仿制方案.md`  
3. `beken/BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`  
4. `beken/lvgl_ui_designer_2.0.3`（Electron 包、`.bkprj`、`templates/**/*.hbs`、`lv_port_pc_simulate`、`mcp/`、`app.asar` 字符串）  
5. https://github.com/bekencorp/lvgl_ui_designer  
6. 官方文档：快速开始 / 工作台 / 事件 / AI 设计 / 发行说明（`doc/zh-cn/` 与本地 `resources/doc/zh-cn/`）  

---

*本文为技术架构与落地工作拆解，实施前请结合目标 LVGL 版本、团队栈与法务要求裁剪。*
