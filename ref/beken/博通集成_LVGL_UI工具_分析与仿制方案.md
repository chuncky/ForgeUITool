# 博通集成 LVGL UI 工具：分析与仿制方案

> 综合 `博通集成_LVGL_UI_Designer分析文档.md`、实现原理拆解、本地工具包 `lvgl_ui_designer_2.0.3` 及官方公开资料。  
> 对象：**BEKEN LVGL UI Designer**（博通集成 / Beken；与 Broadcom「博通」不是同一家）。  
> 结构：**上篇分析**（定位 / 原理 / 主要功能 / 优劣）+ **下篇仿制**（目标 / 工作拆分 / 设计器怎么做）。

---

# 上篇：工具分析

## 1. 产品定位

面向嵌入式设备的 **LVGL 可视化 UI 设计工具**：PC 上拖拽设计 → **生成标准 LVGL C / MicroPython 源码** → 本机仿真或并入芯片 SDK 编译运行。

定位接近 SquareLine Studio、NXP GUI Guider，而非中科世为 FlyThings（专有 UI 文件 + 闭源运行时）。

| 项 | 内容 |
|----|------|
| 本地版本线索 | `lvgl_ui_designer_2.0.3` |
| 下载 | https://dl.bekencorp.com/tools/lvgl_ui_designer |
| 文档 / 仓库 | docs.bekencorp.com…；https://github.com/bekencorp/lvgl_ui_designer |
| 运行环境 | **Windows**（绿色解压即用） |
| 商业模式 | **免费、无订阅**（官方宣传对标 SquareLine 主流能力） |
| 许可证 | 文档仓库侧 MIT；工具本体为 Electron 发行包 |

宣传能力概览：Flex、快速仿真、30+ 组件、云资源、自定义组件/颜色库、一键生成标准代码、2.x AI 设计等。

---

## 2. 实现原理

### 2.1 一句话

> **Electron + Vue 编辑明文 JSON（`.bkprj`）→ Handlebars 生成 LVGL C/MicroPython → SDL+LVGL 仿真 → 生成目录进 SDK。**

易混点：

- **不是**把 Vue 网页编译成 C；权威数据是 JSON，真效果靠 LVGL 再渲染。  
- 板上 **没有** 闭源 GUI 解释器；图形栈是开源 **LVGL**。

### 2.2 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│  Designer（Electron + Vue3）                                │
│  画布(DOM近似) / 组件库 / 树 / 属性 / 事件 / 资源 / AI(MCP)  │
└───────────────────────────┬────────────────────────────────┘
                            │ .bkprj（JSON）
                            ▼
┌────────────────────────────────────────────────────────────┐
│  CodeGen（Handlebars .hbs）                                 │
│  beken_generated/ + custom/（不覆盖）+ beken_generated.cmake│
└───────────────┬────────────────────────────┬───────────────┘
                ▼                            ▼
     PC：LVGL + SDL2 + 工具链          板端：SDK LVGL port
     C 生成→编译→运行 / MP 生成→运行    交叉编译，调用 ui_init
```

### 2.3 技术栈（安装包可核对）

| 层级 | 技术 |
|------|------|
| 桌面壳 | **Electron** |
| 前端 | **Vue 3 + TypeScript + Vite** |
| UI 库 | **Element Plus**；**Pinia** / **vue-router** / **@vueuse** |
| 代码编辑 | **Monaco Editor** |
| 工程数据 | **明文 JSON（`.bkprj`）** |
| 画布预览 | **DOM 绝对定位 + WidgetRenderer**（非 Konva/真 LVGL 嵌编辑器） |
| CodeGen | **Handlebars** → C / MicroPython |
| 仿真 | **LVGL + SDL2 + C**；内置 **w64devkit、CMake** |
| AI | **MCP（.cjs）+ Bridge + Skill** → Cursor / TRAE / Codex |

### 2.4 工程数据与设计器显示

**`.bkprj` = JSON**，大致结构：

```text
name / resolution / lvglVersion
project.pages[]
  └─ components[]：type, name, properties, style(parts×states), children, events…
```

设计器行为：拖入/改属性/改样式/配事件 → 改同一棵树 → 画布与树刷新。

**画布怎么显示：** Vue 按 JSON 用 HTML/CSS 绝对定位近似画控件（文字、色块、图、选中框、网格）。  
**真 LVGL 画面：** 工具栏「生成 + 运行」仿真，或板端运行生成代码。

### 2.5 代码生成

1. 读 `.bkprj` → Handlebars 展开（`beken_ui.*`、`page_init`、控件 partial、事件运行时）  
2. 输出可配置的 `beken_generated/`；附 `beken_generated.cmake`  
3. 特征：`bk_lv_ui_t` 句柄表、`init_page_xxx`、`beken_ui_init()` → `lv_screen_load`  
4. **`custom/` 重新生成不覆盖**；「生成」与「全部清理」分离  

**C**：标准固件 / SDK。  
**MicroPython**：本机快速预览，或跑在 MicroPython+LVGL 环境。

### 2.6 PC 仿真

```text
生成代码 → lv_port_pc_simulate（LVGL+SDL）→ 内置工具链编译
→ lv_init → sdl_hal_init → beken_ui_init → lv_timer_handler 循环
```

升级版本常需删除工程内旧 `lv_port_pc_simulate` 再生成。

### 2.7 事件与导航

设计器可配：CLICKED / 长按 / 值变化 / Gesture… → 跳转页（动画）、改属性/样式、调函数、自定义代码、触发动画等。  
画布可显示事件连线。本质是 **LVGL screen 切换 + 事件表 CodeGen**，不是 Android Activity 栈。

### 2.8 AI（2.x）

```text
自然语言 → MCP 工具 → Bridge → 改工程 JSON → 画布即时重绘
→ 用户「保存/撤销」确认整轮任务
```

改的是设计数据（页/组件/样式/事件/资源等），不是直接改固件；上板仍需再「生成」。复杂事件链/动画精调可能仍要手补。

### 2.9 与板端关系

工具 = **设计 + 生成 + PC 仿真**，不是一键烧录 IDE。上板：生成源进 SDK → 板级 LVGL port → 调 `beken_ui_init()`。

---

## 3. 主要功能、优劣与对比

### 3.1 主要功能

依据官方 README、工作台文档、发行说明与本地 **2.0.3**。完整表见分析文档 §3；此处为压缩版。

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| 环境 | Windows Electron；**免费无订阅** | 绿色解压；LVGL 9.x（可见 9.3） |
| 工程 | 多项目、导入导出、模板/云示例 | 明文 `.bkprj` JSON |
| 工作台 | 五区：库/画布/树/属性/工具栏 | 网格、参考线、撤销、多页、存档历史 |
| 组件 | **30+** + 自定义组件 | 含图表/仪表及 TabView/Menu/Win 等 |
| 样式 | Part/State；样式库；颜色库/主题；Flex | 贴 LVGL 样式思维 |
| 事件 | 跳转、改属性/样式、调函数、自定义代码 | 可选切页动画、连线可视化 |
| 动画 | 时间轴关键帧 | 预览 + 事件触发 |
| 资源 | PNG/TTF；自定义字符；FontAwesome | 可外置图 |
| 多语言 | 语言包/翻译/字体方案 | 事件可切语言 |
| 生成 | **C** + **MicroPython** | `beken_generated` + `custom` + cmake |
| 仿真 | 生成→编译→运行（C）；生成→运行（MP） | SDL；日志可调试 |
| AI | MCP + Cursor/TRAE/Codex 等 | 自然语言改工程 JSON |

闭环：**设计 → 生成 → PC 仿真 → 源码进 SDK → `beken_ui_init()` 上板**。

### 3.2 优点

免费无订阅；标准 LVGL 可移植；上手快；本机仿真少刷机；JSON 可读；样式贴 LVGL；AI 搭骨架；迭代快（1.0→2.0.3）。

### 3.3 缺点

仅 Windows；非完整芯片 IDE；导出源码需守 `custom/` 纪律；升级常清仿真目录；路径/命名约束；早期嵌套限制；Electron 体积与杀毒拦截；AI 有边界。

### 3.4 对比

| | BEKEN Designer | SquareLine | GUI Guider | FlyThings |
|--|----------------|------------|------------|-----------|
| 图形库 | LVGL | LVGL | LVGL | 闭源 EasyUI |
| 产出 | C / MicroPython | C / MicroPython | C/Python 等 | `.ftu` + so |
| 模式 | 导出源码 | 同左 | 同左 | 解释 UI + 宿主 |
| 收费 | 免费 | 订阅为主 | NXP 生态 | 绑硬件/授权 |
| AI | MCP 改画布 | 视版本 | — | 无对等公开能力 |
| 锁定 | 弱 | 弱 | 偏 NXP | 强 |

### 3.5 适用

**适合：**已选 LVGL、要可视化与仿真、控订阅成本、可自接 SDK。  
**不适合：**要 macOS/Linux 原生设计器、要一键烧录一体 IDE、非 LVGL/要专有串口屏运行时。

### 3.6 分析结论

站在开源 LVGL 上的 **免费设计前端**；主要功能面覆盖设计、样式/事件、资源/i18n、双语言生成、仿真与 AI；强项是拖拽、仿真、代码隔离与免费；弱项是 Windows、上板自集成、源码工作流维护与升级摩擦。与 FlyThings 架构不同，选型勿混。

---

# 下篇：仿制方案

## 4. 仿制目标

仿的是范式，不是 asar/品牌：

> **JSON 文档 ↔ Vue/DOM 设计器 ↔ 模板 CodeGen（custom 隔离）↔ SDL 仿真 ↔ CMake/SDK 导出**

MVP：拖拽基础控件、JSON 工程、导出 LVGL C、一键仿真、点击切页/调 custom、约 8 类控件。  
首期不做：兼容 `.bkprj`、烧录 IDE、MicroPython/i18n/动画/AI（可二期）。

---

## 5. 具体工作拆分（按顺序）

| 序号 | 工作 | 周期参考 | 交付 |
|------|------|----------|------|
| **1** | 定 JSON Schema + 示例 | 3～5 天 | 字段约定可校验 |
| **2** | CodeGen CLI | 1～2 周 | JSON→`generated/`+`custom/`+cmake；**优先打通** |
| **3** | PC 仿真模板 | 1～2 周 | 生成→cmake→SDL 窗口 |
| **4** | 设计器 UI | 1.5～2.5 月 | 拖完即可生成仿真（见下节） |
| **5** | SDK 接入文档+示例 | 1～2 周 | 板端跑同套生成代码 |

**原则：先 1→2→3，再 4。** 不要先做花哨界面。

人员：嵌入式（仿真/生成/SDK）+ 前端（设计器）+ 中间层（Schema/模板/脚本）。  
可内测约 **3～5 人月**；接近 Beken 1.x 密度约 **10～15 人月**（不含 AI）。

---

## 6. 工作 4：设计器怎么做、用什么

### 6.1 工具选型

| 用途 | 推荐 |
|------|------|
| 壳 | Electron（electron-vite）或 Tauri 2 |
| 前端 | Vue 3 + TS |
| 组件库 | Element Plus |
| 状态 | Pinia（整份 project JSON） |
| 画布 | DOM 绝对定位 + @vueuse 拖拽（对齐原厂，不必 Konva） |
| 撤销 | 深拷贝历史栈 |
| 调生成/仿真 | child_process / Tauri Command 调工作 2/3 |
| 打包 | electron-builder / Tauri |

### 6.2 模块实现要点

| 模块 | 做什么 |
|------|--------|
| 工程管理 | 新建/打开/保存 JSON，设分辨率 |
| 组件库 | 元数据拖入，push 默认节点 |
| 画布 | Widget 按 x/y/w/h 绝对定位；拖改坐标；网格/选中框 |
| 组件树 | 层级、选中、删、锁、隐 |
| 属性面板 | 表单写回 JSON → 画布刷新 |
| 事件（简） | 存触发/动作；CodeGen 落地 |
| 资源 | 拷入 assets，JSON 记相对路径 |
| 按钮 | 「生成」「仿真」spawn CLI |
| 撤销 | 每次修改压栈 |

内部顺序：空壳读写 JSON → 只读渲染 → 拖+属性 → 库拖入 → 树/撤销 → 接生成仿真 → 事件/资源。

### 6.3 目录建议

```text
ui-codegen/           # 工作 2
simulator-template/   # 工作 3
ui-designer/          # 工作 4 Electron+Vue
用户工程/
  project.json / assets / generated / custom
```

---

## 7. 验收标准（仿制成功）

1. 设计器拖出背景+图+字+两按钮（不手写 JSON）  
2. 一键切页；一键 custom 计数改 Label  
3. 一键 PC 仿真正确  
4. 再改样式生成后 custom 不丢  
5. 生成代码可进最小 LVGL+CMake 工程运行  

---

## 8. 风险

画布≠真 LVGL → 强制仿真验收；锁 LVGL 版本；严分 generated/custom；控件用注册表扩展；控制 Electron 体积；自研实现、遵守 LVGL 许可、勿搬 asar。

---

## 9. 总结论

| 维度 | 结论 |
|------|------|
| 本质 | JSON 工程 + Vue 设计器 + Handlebars→LVGL 源码 + SDL 仿真 |
| 价值 | 免费、标准 LVGL、仿真与 AI 降低 HMI 出活成本 |
| 仿制抓手 | Schema → CodeGen → 仿真 → Designer → SDK 文档 |
| 勿做 | Vue 转 C、闭源板上解释器、首期范围膨胀 |

公开能力对标见分析文档 **§3** / 实现原理稿 **§7.5**；落地总设计见 **`BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`**。

---

## 参考资料

1. `beken/博通集成ui工具.txt`  
2. `beken/博通集成_LVGL_UI_Designer分析文档.md`（§3 主要功能）  
3. `beken/BEKEN_LVGL_UI_Designer实现原理与仿制方案.md`（§7.5 功能对标）  
4. `beken/BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`（L1+L2 兼容重构总设计）  
5. `beken/lvgl_ui_designer_2.0.3`（含 `resources/doc/zh-cn/`）  
6. https://github.com/bekencorp/lvgl_ui_designer  
7. https://dl.bekencorp.com/tools/lvgl_ui_designer  
8. 官方文档与发行说明；B 站产品介绍视频  

---

*基于公开资料与本地包结构的综合分析与落地建议，非官方白皮书；以现行版本发行说明为准。*
