# ForgeUI Kit 控件属性面板详细设计说明

> **文档类型：** 模块详细设计（Designer / 属性检查器子系统）  
> **产品暂名：** ForgeUI Kit  
> **版本：** V1.0  
> **日期：** 2026-08-01  
> **交付分期：** MVP 骨架已落地；V1 对齐 Beken 38 控件全量属性/样式/行为  
> **对标竞品：** Beken LVGL UI Designer 2.x 右侧「属性 | 事件」检查器（`docs/beken界面/属性面板/`）  
> **上游依据：** 《设计需求文档》FR-010a、FR-016～017、FR-016a/b；《软件概要设计说明》§5.6.4；《软件详细设计说明》§3.5.2、§9.7.4  
> **用户手册（字段级）：** `docs/工具详细说明手册/控件属性面板使用说明.md`（38 控件 + 页面、Beken 截图索引）  
> **权威规格输入：** `ref/beken/.../ai-skill/beken-lvgl-ui-designer/component-specs/`  

---

## 1. 文档说明

### 1.1 目的

主详设 `嵌入式UI工具_软件详细设计说明.md` 在 §3.5.2、§9.7.4 给出了属性面板与工程 JSON 的契约摘要。本文档在其基础上展开 **可直接指导编码与验收** 的模块级设计：组件树、状态机、动态表单引擎、样式/事件写路径、38 控件分期矩阵，以及 **当前 MVP 实现差距** 与 V1 填满计划。

### 1.2 范围

| 纳入 | 不纳入 |
|------|--------|
| `InspectorPanel` / `PropPanel` / `EventPanel` / `StylePanel`（V1）架构 | 画布渲染算法、CodeGen 模板逐行映射 |
| UI 分组 → JSON → IPC → Core API 全链路 | 38 控件逐字段操作步骤（见用户手册 §5） |
| `WidgetRegistry` / `PropSpec` 扩展约定 | Beken `.bkprj` 字段兼容 |
| `extraData` 内嵌编辑器契约（V1） | 颜色库/样式库对话框内部 CRUD（见主详设 §9.8） |
| MVP 差距清单、V1 里程碑、测试策略 | AI MCP `batch_update` 工具面（见 MCP 详设） |

### 1.3 文档关系

```text
设计需求 FR-016～017
        │
        ▼
软件概要设计 §5.6.4 ──► 软件详细设计 §3.5.2 / §9.7.4（契约摘要）
        │                        │
        │                        ▼
        └──────────────► 本文档（模块详设、组件/API、分期与差距）
                                │
                                ▼
                    用户手册《控件属性面板使用说明》（操作与字段 encyclopedia）
                                │
                                ▼
                    Beken component-specs + docs/beken界面/属性面板/（对标输入）
```

### 1.4 与 Beken 的差异摘要

| 维度 | Beken | ForgeUI Kit |
|------|-------|-------------|
| 工程字段 | `.bkprj` / wid | `screens/*.json` / `id` |
| 属性/事件布局 | 右栏顶栏 Tab 切换 | ✓ 同结构（`InspectorPanel` + `uiStore.rightTab`） |
| 规格来源 | 内置 + MCP `get_component_type_spec` | `packages/core/src/widgets.ts` + 导入 Beken specs |
| 样式模型 | `style.parts[].states[]` | 兼容扁平 `style.main.default` 与嵌套 `style.parts`（§3.5.1） |
| 列表/表格数据 | `extraData` 内嵌编辑器 | V1 同原则；**禁止**用 `children` 冒充列表项（FR-016b） |

---

## 2. 总体架构

### 2.1 组件树

```text
DesignerWorkbench.vue
  └── aside.side.right
        └── InspectorPanel.vue          # Tab 容器；uiStore.rightTab
              ├── [Tab 属性]
              │     └── PropPanel.vue   # MVP：折叠分组 + 最小动态表单
              │           ├── PropGroupHeader.vue      # V1：蓝色圆点 + 折叠（现内联于 PropPanel）
              │           ├── PropIdentityHeader.vue   # V1：type / id / name
              │           ├── LayoutGroup.vue          # V1：锚点格 + frame
              │           ├── DynamicPropForm.vue      # V1：从 PropSpec[] 渲染
              │           ├── BehaviorGroup.vue        # V1：flags / preview state
              │           ├── StyleGroup.vue           # MVP 内联；V1 → StylePanel
              │           └── ExtraDataEditor/*.vue    # V1：按 WidgetSpec.extraData
              └── [Tab 事件]
                    └── EventPanel.vue
                          ├── EventCard.vue            # V1：单条 binding
                          └── ActionRow.vue            # CHANGE_SCREEN / CALL_FUNCTION
```

**StylePanel（V1）：** 可独立文件 `StylePanel.vue`，由 `PropPanel` 的「样式」分组引用；内含 Part/State 下拉与各样式子组（背景、字体、边框…）。

### 2.2 数据流（写路径）

```text
用户编辑字段
  → PropPanel / EventPanel 本地 @change / v-model
  → projectStore.patchSelected | patchSelectedStyle | setEvents
  → IPC project:updateNode | project:setEvents
  → Main: EditorHistory.record + @forgeui/core mutate
  → 返回 SerializedProject
  → projectStore.hydrate → Canvas / PropPanel 重绘
  → dirty = true（须 Ctrl+S 落盘）
```

**强制约束（AR-020 / FR-010c）：**

1. Renderer **不得**直接写磁盘 JSON。  
2. 每次 mutate 前 Main 入历史栈；`Ctrl+Z/Y` 可撤回属性修改。  
3. CodeGen / Preview **只读磁盘**；未存档的内存修改不会进入仿真。

### 2.3 读路径（选中同步）

```text
Canvas.click(nodeId) | PageTreePanel.click(nodeId)
  → projectStore.select(nodeId)   # selectedId
  → PropPanel computed(node) 刷新
  → EventPanel watch(node) 同步 local events[]
```

未选中：`PropPanel` 显示「未选中控件」；`EventPanel` 显示「选中非屏幕控件后可编辑事件」。

---

## 3. 布局与交互契约

### 3.1 工作区位置

| 项 | 值 |
|----|-----|
| 区域 | 工作区右栏 `aside.side.right` |
| 默认宽度 | **300px**（主详设 §9.5） |
| 与控件库边界 | 顶栏「控件库」**仅**切换 `WidgetLibraryPanel`；**不得**隐藏 Inspector（FR-010a） |

### 3.2 InspectorPanel（Tab 容器）

| 项 | 约定 |
|----|------|
| Tab 项 | **属性**（`props`）、**事件**（`events`） |
| 状态 | `uiStore.rightTab: 'props' \| 'events'`，默认 `'props'` |
| 视觉 | 两 Tab 等宽；激活项 accent 色 + 底边 2px 下划线（对标 Beken） |
| 内容区 | `v-show` 互斥显示 `PropPanel` / `EventPanel`；占满右栏剩余高度；内部各自 `overflow: auto` |
| 持久化 | Tab 选择 **不** 写入工程 JSON（纯 UI 状态） |

**实现文件：** `apps/designer/src/components/InspectorPanel.vue`  
**测试：** `tests/designer_inspector_panel.test.ts`（Tab 切换组件测试）

### 3.3 PropPanel 分组（属性 Tab）

折叠分组 **顺序固定**，与 Beken 滚动区一致：

| 序号 | 分组 | screen 根 | 控件 | MVP 实现 | V1 目标 |
|------|------|-----------|------|----------|---------|
| 0 | 身份区 | type + id + name | 同左 | ✓ 内联 header | 抽 `PropIdentityHeader` |
| 1 | **屏幕信息** / **位置信息** | 宽/高 | X/Y/W/H | ✓ grid2/grid4 | + 3×3 锚点、旋转、布局类型 |
| 2 | **属性** | 页面背景等 | `props` 动态表单 | ✓ `PropSpec[]` 驱动 | + `extraData` 编辑器 |
| 3 | **行为配置** | — | flags / preview state | ✗ 未实现 | 对象标志 + Select State |
| 4 | **样式** | 页面背景 | Part×State 子组 | △ 固定 main/default 3 键 | 完整 StylePanel |
| — | 删除控件 | — | 底部按钮 | ✓ | + 二次确认（可选） |

分组标题：左侧 **蓝色圆点**（`span.dot`，`--accent`）；`<details>` 默认可折叠（MVP 全部 `open`）。

### 3.4 EventPanel（事件 Tab）

| 项 | 约定 |
|----|------|
| 可用条件 | `selectedNode` 存在且 `type !== 'screen'` |
| 数据结构 | `EventBinding[]`：`{ trigger, actions[] }` |
| 触发器 MVP | `CLICKED` \| `PRESSED` \| `RELEASED` \| `LONG_PRESSED` \| `VALUE_CHANGED` |
| 动作 MVP | `CHANGE_SCREEN`（目标页下拉）、`CALL_FUNCTION`（handler 文本） |
| 写回 | `projectStore.setEvents` → IPC `project:setEvents` |
| UI | 卡片列表；`+ 事件` / `+ 动作` / 删除 |

**禁止：** 事件仅存 Vue 本地 ref、不调用 IPC（AR-050）。

---

## 4. 数据模型

### 4.1 UI 分组 → JSON 映射

与主详设 §3.5.2.1 一致，此处补充 **TypeScript 形状**：

```ts
/** 选中节点（控件） */
interface UiNode {
  id: string;
  type: string;
  name: string;
  frame: { x: number; y: number; w: number; h: number; rotation?: number };
  props: Record<string, unknown>;
  style?: StyleModel;           // 扁平或 parts 嵌套
  extraData?: Record<string, unknown>;
  flags?: string[];
  events?: EventBinding[];
  children: UiNode[];
}

/** 样式：MVP 常用写法 */
type StyleModel =
  | { main?: { default?: Record<string, unknown> } }
  | { parts?: Record<string, Record<string, Record<string, unknown>>> };
```

| 面板分组 | 写入路径 | IPC patch 键 |
|----------|----------|--------------|
| 屏幕信息 | `project.display.width/height` | `patchDisplay` |
| 位置信息 | `node.frame.*` | `patchSelected({ frame })` |
| 属性 | `node.props.*` | `patchSelected({ props })` |
| 扩展数据 | `node.extraData.*` | `patchSelected({ extraData })` |
| 行为 | `node.flags` / 预览 state | V1 `patchSelected({ flags })` |
| 样式 | `style.parts[part][state].*` | `patchSelectedStyle(part, state, props)` |
| 事件 | `node.events[]` | `setEvents` |
| 显示名 | `node.name` | `patchSelected({ name })` |

**颜色格式：** `#RRGGBBAA`（8 位十六进制）。UI 色块选择器输出 `#RRGGBB` 时，写回须补 `ff` 透明度（见 `PropPanel.toRgbaHex`）。

**Range 类型：** JSON 中为 `{ min, max }` 对象；**禁止** `"0,100"` 逗号字符串（与 Beken AI 指南一致）。

### 4.2 extraData 约定（V1）

`extraData` 承载结构化数据，**不得**用子控件树模拟：

| type | 键 | 编辑器 UI |
|------|-----|-----------|
| `spangroup` | `spans[]` | 可增删 Span 行 |
| `list` / `dropdown` / `roller` | `items[]` | 选项列表 |
| `table` | `cells[]`, `column_widths[]` | 行列网格 |
| `buttonmatrix` | `text_map[]`, `one_checked` | 矩阵标签 |
| `tabview` | `tabs[]`, `selectedTabIndex` | Tab 头列表 |
| `linechart` / `barchart` / `scatterchart` | `series[]` | Series 编辑器 |
| `menu` | `pages[]`, `rootPageId` | 菜单页树 |
| `win` / `msgbox` | `buttons[]` 等 | 对话框按钮列表 |

完整字段见用户手册 §5 各小节及 Beken `component-specs/{type}/{type}.md`。

### 4.3 事件与动作

```ts
type EventTrigger =
  | "CLICKED" | "PRESSED" | "RELEASED" | "LONG_PRESSED" | "VALUE_CHANGED";

type Action =
  | { type: "CHANGE_SCREEN"; target: string; anim?: string; ms?: number }
  | { type: "CALL_FUNCTION"; handler: string }
  | { type: "SET_PROP"; nodeId: string; prop: string; value: unknown }; // V1

interface EventBinding {
  trigger: EventTrigger;
  actions: Action[];
}
```

CodeGen 将 `CALL_FUNCTION` 生成对 `<codegenDir>/custom/ui_events.c` 桩的调用（FR-030～033）。

---

## 5. WidgetRegistry 与动态表单

### 5.1 单一数据源

| 层 | 路径 | 职责 |
|----|------|------|
| 注册表 | `packages/core/src/widgets.ts` | `WidgetSpec[]`：props、styleParts、events、codegen |
| Designer 镜像 | Main `listWidgets` IPC → `projectStore.widgets` | 启动/开工程后缓存 |
| 查询 | `projectStore.widgetSpec(type)` | PropPanel 取 `props`、events 白名单 |

**扩展流程（V1 38 控件）：**

1. 从 Beken `component-specs/{type}/{type}.md` 提取 `general` 字段 → `PropSpec[]`。  
2. 补充 `styleParts`、`events`、`extraData` schema。  
3. 增加 CodeGen `templatePartial`。  
4. 在用户手册 §5 补字段说明 + 截图索引。  
5. 校验器 + 黄金工程用例覆盖。

### 5.2 PropSpec 类型 → UI 控件

| PropSpec.type | UI 控件 | 变更时机 |
|---------------|---------|----------|
| `string` | `<input>` | `@change` |
| `text` | `<textarea rows="3">` | `@change` |
| `number` | `<input type="number">` | `@change` |
| `boolean` | checkbox + label | `@change` |
| `enum` | `<select>` + `enumLabels` | `@change` |
| `color` | 文本 `#RRGGBBAA` + 色块 | `@change` / `@input` |
| `range`（V1） | min/max 双字段 | `@change` |
| `imageSrc`（V1） | 路径 + 「从资源选择」 | 打开 `AssetsDialog` |

**V1 目标组件：** `DynamicPropForm.vue` 接收 `specs: PropSpec[]`、`model: props`，统一渲染并 emit `update`，替代 `PropPanel` 内联 `v-for`。

### 5.3 MVP 已注册控件（12 + screen）

当前 `widgets.ts` 中 **MVP 数组** 含：`screen`、`container`、`label`、`button`、`image`、`slider`、`switch`、`checkbox`、`bar`、`arc`、`dropdown`、`textarea`。

与用户手册 §5.0（38 控件）差距：**26 种** 待 V1 注册（Tabview、List、Table、Chart、Keyboard…）。

### 5.4 38 控件分期矩阵（摘要）

完整 props/Part/extraData 见用户手册 §5.0 总览表。下表为 **工程交付分期**：

| 分期 | 控件范围 | 属性面板能力 |
|------|----------|--------------|
| **MVP（当前）** | 上表 12 种 | Tab + 位置 + 动态 props + 固定 3 样式键 |
| **V1-A** | +15 常用 HMI（list、tabview、roller、imagebutton、msgbox…） | + Part/State 下拉 + 行为 flags |
| **V1-B** | 剩余至 38 | + extraData 编辑器 + 全样式子组 + 样式库引用 |
| **V2** | 自定义控件属性 | 读 `WidgetSpec` 扩展 + FR-019 |

---

## 6. StylePanel 设计（FR-017）

### 6.1 Part / State 选择器

| 控件类型 | styleParts（注册表） | STATE 集合 |
|----------|---------------------|------------|
| button / label / image / container | `main` | default, pressed, focused, disabled, checked… |
| slider / switch / arc | main, indicator, knob | 同上 |
| bar / spinner | main, indicator | 同上 |
| dropdown | main, main_list, selected_list, scrollbar_list | 同上 |
| list | main, main_button, main_item, scrollbar | 同上 |
| … | 见用户手册 §4.4.1、§5.0.2 | LVGL 9.10 状态枚举 |

MVP：**隐藏** Part/State 下拉，硬编码 `main` + `default`，分组标题显示 `MAIN · DEFAULT` 提示。

### 6.2 样式子组与 JSON 键

| 子组 | 主要键 | MVP | V1 |
|------|--------|-----|-----|
| 背景 | `bg_color`, `bg_grad_dir`, `bg_img_src` | `bg_color` | 全量 |
| 字体 | `text_font`, `text_color`, `text_align` | `text_color` | 全量 |
| 边框 | `border_width`, `border_color`, `radius` | `radius` | 全量 |
| 内边距 | `pad_top`… | — | ✓ |
| 阴影 | `shadow_*` | — | ✓ |
| Image 专用 | `img_recolor`, `img_opa` | — | ✓ |

**按控件过滤可见子组（MVP 已做）：** `label` 仅 `text_color`；`image` 仅 `bg_color` + `radius`；其余默认三键。

**样式库（FR-018，V1）：** 分组右上角「保存 / 应用」→ `ColorLibraryDialog` / 主题 JSON；节点可 `styleRef` 引用。

### 6.3 CodeGen 映射

Core/CodeGen 将 `style.parts[part][state]` 归一化后输出 `lv_obj_set_style_*`（LVGL 9.10）。Part 名与 LVGL `LV_PART_*` 映射表维护于主详设 §16 收口项。

---

## 7. IPC 与 Store API

### 7.1 Renderer → Main

| IPC | 参数（摘要） | 用途 |
|-----|--------------|------|
| `project:updateNode` | `{ screenId, nodeId, patch }` | frame / props / name / styleKeys / extraData |
| `project:setEvents` | `{ screenId, nodeId, events }` | 整表替换 events |
| `project:updateScreen` | display 补丁 | 屏幕宽/高 |
| `project:removeNode` | `{ screenId, nodeId }` | 删除控件 |

`patchSelected` 封装（`project.ts`）：

```ts
async function patchSelected(patch: Record<string, unknown>) { /* updateNode IPC */ }
async function patchSelectedStyle(part: string, state: string, props: Record<string, unknown>) {
  await patchSelected({ styleKeys: { part, state, props } });
}
async function setEvents(events: EventBinding[]) { /* setEvents IPC */ }
```

### 7.2 uiStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `rightTab` | `'props' \| 'events'` | Inspector Tab |
| `widgetLibraryVisible` | `boolean` | 与 Inspector 无关 |
| `showAssets` 等 | `boolean` | 资源/设置对话框 |

---

## 8. 与画布、历史、存档的协同

| 交互 | 行为 |
|------|------|
| 画布拖拽移动 | 更新 `frame.x/y`；松手入栈 |
| 画布角点缩放 | 更新 `frame.w/h`；最小 16px |
| 属性面板改 frame | 画布即时同步 |
| 删除控件 | `removeSelected()`；可 undo |
| 修改任意属性 | `dirty=true`；**Ctrl+S** 写 `screens/*.json` |
| 生成/预览 | 流程内自动 `saveProject`（若 dirty） |

---

## 9. 当前实现差距（MVP 骨架 vs 验收基准）

> 以下对照用户手册 V1.4 与 Beken 截图；**粗粒度** 指 UI 分组/交互缺失，**细粒度** 指字段未注册或未渲染。

| 能力 | 用户手册/Beken | 当前代码 | 优先级 |
|------|----------------|----------|--------|
| 属性/事件 Tab | ✓ | ✓ `InspectorPanel` | — |
| 身份区 type/id/name | ✓ | ✓ | — |
| 位置 X/Y/W/H | ✓ | ✓ | — |
| 3×3 锚点格 | ✓ | ✗ | V1 |
| 旋转 / 布局类型 | ✓ | ✗ | V1 |
| 动态 props 表单 | ✓ 38 种 | △ 12 种注册 | V1-A |
| 行为配置分组 | ✓ | ✗ 无分组 | V1-A |
| Part/State 下拉 | ✓ | ✗ 固定 main/default | V1-A |
| 样式子组（背景/字体/边框/阴影/内边距） | ✓ | △ 最多 3 键 | V1-B |
| 样式库 保存/应用 | ✓ | ✗ | V1-B |
| extraData 编辑器 | ✓ | ✗ | V1-B |
| 颜色库引用 | ✓ | ✗ | V1-B |
| 图片路径选择器 | ✓ 资源管理 | △ 手填 string | V1 |
| 资源管理联动 | ✓ | △ `AssetsDialog` 独立 | V1 |
| 分组视觉（圆点/折叠动画） | ✓ | △ 圆点有；动画无 | P2 |
| 控件类型图标 | ✓ | ✗ 仅文字 typeLabel | P2 |
| 多语言 props | ✓ | ✗ V2 | V2 |

**结论：** 架构（Tab + 分组 + Registry 驱动）已对齐 Beken；**视觉密度与字段完整度** 仍为 MVP 水平，V1 按 §10 里程碑填满。

---

## 10. V1 实施里程碑

### 10.1 阶段 A — 表单引擎与样式骨架（4～6 周）

| 任务 | 产出 |
|------|------|
| 抽取 `DynamicPropForm.vue` | 统一 PropSpec 渲染 |
| 新增 `StyleGroup.vue` + Part/State 下拉 | 读写 `style.parts` |
| 扩展 `widgets.ts` +15 控件 | list、tabview、roller、imagebutton… |
| 行为分组 `BehaviorGroup.vue` | flags 多选 |
| 单元测试 | PropSpec 渲染快照 + styleKeys IPC |

### 10.2 阶段 B — extraData 与全样式（6～8 周）

| 任务 | 产出 |
|------|------|
| `ExtraDataEditor` 插件表 | 按 type 注册编辑器组件 |
| 样式子组完整表单 | 背景/字体/边框/阴影/内边距 |
| 余下 26 控件注册 | 38 完整 |
| `AssetsDialog` ↔ `imageSrc` | 图片路径可视化 |
| 截图回归 | 对照 `docs/beken界面/属性面板/` |

### 10.3 阶段 C — 主题与体验（2～4 周）

| 任务 | 产出 |
|------|------|
| 样式库 FR-018 | 保存/应用命名主题 |
| 颜色库引用 | `#RRGGBBAA` 可选命名色 |
| 锚点/旋转/布局 | LayoutGroup 完整 |
| 无障碍/键盘 | Tab 焦点顺序 |

---

## 11. 测试策略

| 层级 | 文件 | 覆盖 |
|------|------|------|
| 结构测试 | `tests/designer_workbench_layout.test.ts` | Inspector 挂载、Tab  wiring |
| 组件测试 | `tests/designer_inspector_panel.test.ts` | Tab 切换、v-show 互斥 |
| 组件测试（V1） | `tests/designer_prop_form.test.ts`（待建） | PropSpec 各 type 渲染 |
| 集成测试 | `tests/designer_save_flow.test.ts` | 改 props 存档落盘 |
| E2E（可选） | Playwright | 开工程 → 选按钮 → 改 text → 存档 |

**验收用例（摘录）：**

1. 选 `button`，属性 Tab 改 `text` → 画布标签变 → 存档 → JSON `props.text` 一致。  
2. 事件 Tab 添加 `CLICKED` → `CHANGE_SCREEN` → 存档 → JSON `events[]` 一致。  
3. V1：选 `slider`，Style Part 切 `indicator` → 改色 → CodeGen 含对应 `lv_obj_set_style_*`。

---

## 12. 相关文档与路径索引

| 文档 | 路径 |
|------|------|
| 主详设 | `docs/嵌入式UI工具_软件详细设计说明.md` §3.5.2、§9.7.4 |
| 用户手册 | `docs/工具详细说明手册/控件属性面板使用说明.md` |
| 需求 | `docs/嵌入式UI工具_设计需求文档.md` FR-016～017 |
| Beken 截图 | `docs/beken界面/属性面板/` |
| AI 规格 | `ref/beken/.../component-specs/` |
| 实现 | `apps/designer/src/components/{InspectorPanel,PropPanel,EventPanel}.vue` |
| 注册表 | `packages/core/src/widgets.ts` |
| 截图脚本 | `.tmp/capture_component_props.py` |

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.0 | 2026-08-01 | 初版：模块架构、数据模型、Registry、Style/Event、MVP 差距、V1 里程碑；对齐 InspectorPanel Tab 实现 |

---

*本文为《软件详细设计说明》的补充模块契约；与用户手册冲突时以需求 FR 与已锁定决策 D-01～D-07 为准。38 控件字段级说明以用户手册 §5 为权威，本文档侧重工程实现与分期验收。*
