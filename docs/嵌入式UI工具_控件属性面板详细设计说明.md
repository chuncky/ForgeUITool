# ForgeUI Kit 控件属性面板详细设计说明

> **文档类型：** 模块详细设计（Designer / 属性检查器子系统）  
> **产品暂名：** ForgeUI Kit  
> **版本：** V1.6l  
> **日期：** 2026-08-07  
> **V1.6l：** 分册 `03-button.md`：`isContainer=false`（与 Core / 树拖拽 / MCP 父规则对齐；文案用 `props.text`）。  
> **V1.6k：** 新建控件写入 `WidgetSpec.defaultStyle`（对齐 LVGL `theme_default` Light），画布缺省回退同源种子，避免「画布透明 / 模拟有主题色」。见 §5.4；分册 JSON 已同步。  
> **V1.6j：** 旋转锚点补**箭头图示**（放大圆柄 + 内联 SVG，对标 Beken；避免仅实心点无语义）。  
> **V1.6i：** 对齐 Beken：selection chrome 与内容层分离（外壳不裁切 + 选中 z-index）；修复手柄被 overflow 裁成「长方形」/旋转柄不可见。  
> **V1.6h：** 缩放手柄恢复纯色方块；画布增加**旋转锚点**（顶边上方圆柄，绕中心改 `frame.rotation`）。  
> **V1.6g：** 画布选中 **8 向缩放手柄**（对标 Beken 四角+四边）；见详设 §9.7 / 属性面板详设 §8。  
> **V1.6f：** 画布↔模拟字号/框比例：默认 Montserrat（对齐 `LV_FONT_DEFAULT`）；行高按 LVGL montserrat `line_height`（非 ×1.3）；见 `04-label.md`。  
> **V1.6e：** 长文本/字号对标 BK 收口——`long_mode` 画布+模拟；按钮子 label `LV_PCT(100)`；`text_font`+`text_font_size` 进 CodeGen；画布默认字号 14、WRAP 框内裁切。  
> **V1.6d：** 样式库对标 BK：`SaveStyleDialog` / `StyleLibraryDialog`（名称/描述/预览/应用/删除）；**样式**主题不在颜色库内（颜色库可有独立的 **色板主题** `colorThemes`，见主详设 V1.29）。  
> **V1.6c：** 样式子组对标 BK——独立「间距」；圆角归「边框」；label 暴露完整六组；子组「显示/隐藏」同步展开/收起编辑区（无左侧三角）。  
> **V1.6：** §3.5 锁定位置信息 3×3 格：**示意方位** + **吸附到父容器九宫**（对标 Beken；纠正「九格同图 / 仅改锚点不移动」）。  
> **V1.6b：** 标签 `label` 对标 BK——对齐仅样式 `text_align`；`long_mode` 画布可见；补 `is_text_static`；厘清显示名≠文本（见分册 `04-label.md`）。  
> **V1.5：** 删除 §5.4 分期矩阵、§9 差距表、§10 里程碑；进度见 IMPLEMENTATION_PROGRESS.md。  
> **V1.4：** **FR-016e 收口**：面板写入的 `bg_image` / `text_font` / **字号 `text_font_size`** 必须在画布**实际可见**（详设 §6.5）；选图仅写路径不算完成。  
> **V1.3：** 删除控件支持 **Delete/Backspace** 快捷键（FR-012a），与底部按钮同路径。  
> **对标竞品：** Beken LVGL UI Designer 2.x 右侧「属性 | 事件」检查器（`docs/beken界面/属性面板/`）  
> **上游依据：** 《设计需求文档》FR-010a、FR-012a、FR-016～017、FR-016a/b/c/e；《软件概要设计说明》§5.6.4；《软件详细设计说明》§3.5.2、§9.7.4  
> **用户手册（字段级）：** `docs/工具详细说明手册/控件属性面板使用说明.md`（38 控件 + 页面、Beken 截图索引）  
> **权威规格输入：** `ref/beken/.../ai-skill/beken-lvgl-ui-designer/component-specs/`  
> **V1.2：** 登记缺口 **样式 `bg_image`（imageSrc）缺资源库选择按钮**（对标 Beken 背景图文件夹选择；与属性组 `props.src` 不一致）；修正方案见 §6.4。

> **结构：** 2026-08-05 起 **按控件** 拆分为 `docs/控件属性面板详设/`；本文件保留模块架构与共性契约。

---

## 分册目录（按控件）

完整列表见 [`docs/控件属性面板详设/README.md`](./控件属性面板详设/README.md)。

| # | 控件 | 文档 |
|---|------|------|
| 1 | 屏幕（`screen`） | [./控件属性面板详设/01-screen.md](./控件属性面板详设/01-screen.md) |
| 2 | 容器（`container`） | [./控件属性面板详设/02-container.md](./控件属性面板详设/02-container.md) |
| 3 | 按钮（`button`） | [./控件属性面板详设/03-button.md](./控件属性面板详设/03-button.md) |
| 4 | 标签（`label`） | [./控件属性面板详设/04-label.md](./控件属性面板详设/04-label.md) |
| 5 | 图片（`image`） | [./控件属性面板详设/05-image.md](./控件属性面板详设/05-image.md) |
| 6 | 滑条（`slider`） | [./控件属性面板详设/06-slider.md](./控件属性面板详设/06-slider.md) |
| 7 | 开关（`switch`） | [./控件属性面板详设/07-switch.md](./控件属性面板详设/07-switch.md) |
| 8 | 复选框（`checkbox`） | [./控件属性面板详设/08-checkbox.md](./控件属性面板详设/08-checkbox.md) |
| 9 | 进度条（`bar`） | [./控件属性面板详设/09-bar.md](./控件属性面板详设/09-bar.md) |
| 10 | 圆弧（`arc`） | [./控件属性面板详设/10-arc.md](./控件属性面板详设/10-arc.md) |
| 11 | 下拉框（`dropdown`） | [./控件属性面板详设/11-dropdown.md](./控件属性面板详设/11-dropdown.md) |
| 12 | 文本域（`textarea`） | [./控件属性面板详设/12-textarea.md](./控件属性面板详设/12-textarea.md) |
| 13 | 列表（`list`） | [./控件属性面板详设/13-list.md](./控件属性面板详设/13-list.md) |
| 14 | 滚轮（`roller`） | [./控件属性面板详设/14-roller.md](./控件属性面板详设/14-roller.md) |
| 15 | 图片按钮（`imagebutton`） | [./控件属性面板详设/15-imagebutton.md](./控件属性面板详设/15-imagebutton.md) |
| 16 | 加载动画（`spinner`） | [./控件属性面板详设/16-spinner.md](./控件属性面板详设/16-spinner.md) |
| 17 | 标签视图（`tabview`） | [./控件属性面板详设/17-tabview.md](./控件属性面板详设/17-tabview.md) |
| 18 | 键盘（`keyboard`） | [./控件属性面板详设/18-keyboard.md](./控件属性面板详设/18-keyboard.md) |
| 19 | 消息框（`msgbox`） | [./控件属性面板详设/19-msgbox.md](./控件属性面板详设/19-msgbox.md) |
| 20 | 线条（`line`） | [./控件属性面板详设/20-line.md](./控件属性面板详设/20-line.md) |
| 21 | LED（`led`） | [./控件属性面板详设/21-led.md](./控件属性面板详设/21-led.md) |
| 22 | 动画图片（`animimg`） | [./控件属性面板详设/22-animimg.md](./控件属性面板详设/22-animimg.md) |
| 23 | 数字输入框（`spinbox`） | [./控件属性面板详设/23-spinbox.md](./控件属性面板详设/23-spinbox.md) |
| 24 | 刻度（`scale`） | [./控件属性面板详设/24-scale.md](./控件属性面板详设/24-scale.md) |
| 25 | 二维码（`qrcode`） | [./控件属性面板详设/25-qrcode.md](./控件属性面板详设/25-qrcode.md) |
| 26 | 条形码（`barcode`） | [./控件属性面板详设/26-barcode.md](./控件属性面板详设/26-barcode.md) |
| 27 | 画布（`canvas`） | [./控件属性面板详设/27-canvas.md](./控件属性面板详设/27-canvas.md) |
| 28 | 日历（`calendar`） | [./控件属性面板详设/28-calendar.md](./控件属性面板详设/28-calendar.md) |
| 29 | 数字时钟（`digitalclock`） | [./控件属性面板详设/29-digitalclock.md](./控件属性面板详设/29-digitalclock.md) |
| 30 | 平铺视图（`tileview`） | [./控件属性面板详设/30-tileview.md](./控件属性面板详设/30-tileview.md) |
| 31 | 窗口（`win`） | [./控件属性面板详设/31-win.md](./控件属性面板详设/31-win.md) |
| 32 | 菜单（`menu`） | [./控件属性面板详设/32-menu.md](./控件属性面板详设/32-menu.md) |
| 33 | 文本组（`spangroup`） | [./控件属性面板详设/33-spangroup.md](./控件属性面板详设/33-spangroup.md) |
| 34 | 表格（`table`） | [./控件属性面板详设/34-table.md](./控件属性面板详设/34-table.md) |
| 35 | 按钮矩阵（`buttonmatrix`） | [./控件属性面板详设/35-buttonmatrix.md](./控件属性面板详设/35-buttonmatrix.md) |
| 36 | 线图（`linechart`） | [./控件属性面板详设/36-linechart.md](./控件属性面板详设/36-linechart.md) |
| 37 | 柱状图（`barchart`） | [./控件属性面板详设/37-barchart.md](./控件属性面板详设/37-barchart.md) |
| 38 | 散点图（`scatterchart`） | [./控件属性面板详设/38-scatterchart.md](./控件属性面板详设/38-scatterchart.md) |
| 39 | 图表（`chart`） | [./控件属性面板详设/39-chart.md](./控件属性面板详设/39-chart.md) |

---

## 1. 文档说明

### 1.1 目的

主详设 `嵌入式UI工具_软件详细设计说明.md` 在 §3.5.2、§9.7.4 给出了属性面板与工程 JSON 的契约摘要。本文档在其基础上展开 **可直接指导编码与验收** 的模块级设计：组件树、状态机、动态表单引擎、样式/事件写路径与共性契约。单控件属性设计见 `docs/控件属性面板详设/`；实现进度见 `docs/IMPLEMENTATION_PROGRESS.md`。

### 1.2 范围

| 纳入 | 不纳入 |
|------|--------|
| `InspectorPanel` / `PropPanel` / `EventPanel` / `StylePanel`（V1）架构 | 画布渲染算法、CodeGen 模板逐行映射 |
| UI 分组 → JSON → IPC → Core API 全链路 | 单控件设计见 `docs/控件属性面板详设/`；操作 encyclopedia 见用户手册 §5 |
| `WidgetRegistry` / `PropSpec` 扩展约定 | Beken `.bkprj` 字段兼容 |
| `extraData` 内嵌编辑器契约（V1） | 颜色库/样式库对话框内部 CRUD（见主详设 §9.8） |
| 测试策略与共性验收 | AI MCP `batch_update` 工具面（见 MCP 详设）；实现进度见 `IMPLEMENTATION_PROGRESS.md` |

### 1.3 文档关系

```text
设计需求 FR-016～017
        │
        ▼
软件概要设计 §5.6.4 ──► 软件详细设计 §3.5.2 / §9.7.4（契约摘要）
        │                        │
        │                        ▼
        └──────────────► 本文档（模块详设、组件/API、共性契约）
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        控件属性面板详设/   用户手册 §5      IMPLEMENTATION_PROGRESS
        （按控件分册）     （操作 encyclopedia） （实现进度）
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

| 序号 | 分组 | screen 根 | 控件 | 当前实现 |
|------|------|-----------|------|----------|
| 0 | 身份区 | type + id + name | 同左 | `PropIdentityHeader` |
| 1 | **屏幕信息** / **位置信息** | 宽/高 | X/Y/W/H + **3×3 容器方位格** / 旋转 / 布局 | `LayoutGroup` |
| 2 | **属性** | 页面背景等 | `props` 动态表单 + `extraData` | `DynamicPropForm` / `ExtraDataGroup` |
| 3 | **行为配置** | — | flags / preview state | `BehaviorGroup` |
| 4 | **样式** | 页面背景 | Part×State 子组 | `StyleGroup` |
| — | 删除控件 | — | 底部按钮 + **Delete/Backspace**（FR-012a） | ✓；输入框聚焦时不删控件 |

分组标题：左侧 **蓝色圆点**（`span.dot`，`--accent`）；`<details>` 默认可折叠。

### 3.4 EventPanel（事件 Tab）

| 项 | 约定 |
|----|------|
| 可用条件 | `selectedNode` 存在且 `type !== 'screen'` |
| 数据结构 | `EventBinding[]`：`{ trigger, actions[] }` |
| 触发器 | `CLICKED` \| `PRESSED` \| `RELEASED` \| `LONG_PRESSED` \| `VALUE_CHANGED` |
| 动作 | `CHANGE_SCREEN`（目标页下拉）、`CALL_FUNCTION`（handler 文本）等 |
| 写回 | `projectStore.setEvents` → IPC `project:setEvents` |
| UI | 卡片列表；`+ 事件` / `+ 动作` / 删除 |

**禁止：** 事件仅存 Vue 本地 ref、不调用 IPC（AR-050）。

### 3.5 位置信息 · 3×3 容器方位格（对标 Beken）

> **问题输入：** `docs/工具问题/控件属性位置问题/控件属性位置信息的图示九个点.png`（九格示意点全在中央，无法区分方位）。

#### 3.5.1 产品语义（锁定）

| 项 | 约定 |
|----|------|
| 出现条件 | 选中**非 screen** 控件时，「位置信息」左侧显示 3×3 格；screen 根为「屏幕信息」，**无**此格 |
| 参考系 | **直接父容器**内容区（父为 screen 时 = 页面逻辑分辨率；否则 = 父节点 `frame.w/h`） |
| 点击行为 | 将控件 **吸附** 到父容器对应九宫方位；**同时**写入 `frame.anchorX/anchorY`（0/1/2）标识当前方位 |
| 非行为 | ❌ 不得做成「九格示意完全相同」；❌ 不得仅 `reanchor`（改枢轴、画面不动）；❌ 不得相对「画布空白 / 兄弟随意点」移动 |
| X/Y 含义 | 吸附后的 `frame.x/y` 仍为相对**父容器左上角**的整数 px（与拖拽、手改数值同一坐标系） |
| 历史 | 每次点击记入编辑器历史，可 Ctrl+Z |

**九宫 → 几何（父宽 `Pw`、父高 `Ph`，控件 `w/h`）：**

| 格 (col,row) | 标签 | `x` | `y` | `anchorX` | `anchorY` |
|--------------|------|-----|-----|-----------|-----------|
| (0,0) | 左上 | `0` | `0` | 0 | 0 |
| (1,0) | 上中 | `round((Pw-w)/2)` | `0` | 1 | 0 |
| (2,0) | 右上 | `Pw-w` | `0` | 2 | 0 |
| (0,1) | 左中 | `0` | `round((Ph-h)/2)` | 0 | 1 |
| (1,1) | 中心 | `round((Pw-w)/2)` | `round((Ph-h)/2)` | 1 | 1 |
| (2,1) | 右中 | `Pw-w` | `round((Ph-h)/2)` | 2 | 1 |
| (0,2) | 左下 | `0` | `Ph-h` | 0 | 2 |
| (1,2) | 下中 | `round((Pw-w)/2)` | `Ph-h` | 1 | 2 |
| (2,2) | 右下 | `Pw-w` | `Ph-h` | 2 | 2 |

取整后 `x/y` 按实现可 `Math.round`；若 `w>Pw` 或 `h>Ph`，允许负偏移（与拖出父界一致），**不要**强行夹到 0 以致「右/下」失效。

#### 3.5.2 示意视觉（对标 Beken）

每个格是独立按钮；**格内小方块/圆点的位置必须对应该格方位**，禁止九格共用「居中一点」：

```text
┌─┬─┬─┐     每格内部示意（■ = 指示点）：
│■│■│■│       左上■··   ·■·   ··■右上
│·│·│·│       左中·■·   ·■·   ·■·右中
├─┼─┼─┤       左下··■   ·■·   ■··右下
│■│■│■│
│·│·│·│     选中格：边框 + 指示点用 accent（如 #3d5afe）
├─┼─┼─┤
│■│■│■│
│·│·│·│
└─┴─┴─┘
```

| 态 | 视觉 |
|----|------|
| 默认 | 暗底、边框 `--border`；指示点 `--muted` |
| 悬停 | 边框略亮 |
| 激活（当前 `anchorX/Y`） | accent 边框 + 指示点实心 accent |

#### 3.5.3 实现契约

| 层 | 约定 |
|----|------|
| Core | `alignFrameToParent(frame, parentW, parentH, col, row) → Partial<Frame>`（`packages/core/src/frame-anchor.ts`）；保留 `reanchorFrame` 仅用于「改枢轴、视觉不动」的内部/测试，**面板点击不得调用** |
| UI | `LayoutGroup.vue`：九格分示意 CSS；点击发 `update:frame` 为吸附结果 |
| 父尺寸 | `PropPanel` / store 解析选中节点的直接父：`screen` → `display`/`screen.frame`；否则父 `frame.w/h` |
| IPC | 仍走 `patchSelected({ frame })`，与手改 X/Y 同路径 |
| 测试 | ① 九格指示点 `inset`/位置互异；② 给定父 200×100、控件 40×20，点右下 → `x=160,y=80`；③ 点中心 → 居中；④ 不调用 `reanchorFrame` 作为面板主路径 |

#### 3.5.4 与「多选对齐」区分

| 能力 | 入口 | 参考系 |
|------|------|--------|
| 3×3 容器方位格 | 属性「位置信息」 | **父容器** |
| 多选左/中/右对齐（FR-013b） | 控件 ⋯ 菜单 / 快捷 | 选区包围盒或单选时 screen |

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
| 注册表 | `packages/core/src/widgets.ts` | `WidgetSpec[]`：props、styleParts、events、codegen、**defaultStyle** |
| Designer 镜像 | Main `listWidgets` IPC → `projectStore.widgets` | 启动/开工程后缓存 |
| 查询 | `projectStore.widgetSpec(type)` | PropPanel 取 `props`、events 白名单 |

**扩展流程（V1 38 控件）：**

1. 从 Beken `component-specs/{type}/{type}.md` 提取 `general` 字段 → `PropSpec[]`。  
2. 补充 `styleParts`、`events`、`extraData` schema、**`defaultStyle` 种子**（对齐 `theme_default` Light，见 §5.4）。  
3. 增加 CodeGen `templatePartial`。  
4. 在用户手册 §5 与 `docs/控件属性面板详设/` 补字段说明 + JSON 示例。  
5. 校验器 + 黄金工程用例覆盖（含 `designer_widget_default_styles`）。

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
| `imageSrc`（V1） | 路径 + 「从资源选择」/「库」 | 打开 `AssetsDialog`（**属性组与样式组均须支持**） |

**目标组件：** `DynamicPropForm.vue` 接收 `specs: PropSpec[]`、`model: props`，统一渲染并 emit `update`，替代 `PropPanel` 内联 `v-for`。

### 5.3 已注册控件（38 + screen）

`widgets.ts` 已覆盖用户手册 §5.0 全部 **38** 种可添加控件（`container` 对标 Beken `obj`）+ `screen` 页面根。

完整 props / Part / extraData 以各控件分册与用户手册 §5.0 为准。

### 5.4 新建控件默认样式（画布 ↔ 模拟）

**问题：** 若 `style: {}`，画布按「缺 `bg_color` → 透明」渲染；PC 模拟走 LVGL `theme_default` Light，容器呈白卡片、按钮呈主色等 → **同工程两边外观不一致**。

**契约：**

| 环节 | 行为 |
|------|------|
| `WidgetSpec.defaultStyle` | 各可添加控件在 `widgets.ts` 声明种子（`STYLE_SEED_*`，token 见 `LVGL_THEME_LIGHT`） |
| `addChildNode`（`mutate.ts`） | `structuredClone(spec.defaultStyle)` 写入新节点；无种子则 `{}` |
| 画布 chrome（`canvas-chrome.ts`） | 节点缺键时回退 `getWidgetSpec(type).defaultStyle.main.default` |
| CodeGen / 模拟 | 工程 JSON 已含显式样式；与主题叠加时以工程值为准 |

**种子族（与 LVGL Light 对应关系）：**

| 常量 | 典型控件 | 要点 |
|------|----------|------|
| `STYLE_SEED_CARD` | container / textarea / list / … | 白底、radius 8、灰边 2、字色 `#212121` |
| `STYLE_SEED_BTN_PRIMARY` | button / imagebutton | `#2196F3` 底 + 白字 + radius 8 |
| `STYLE_SEED_SCR` | tabview / keyboard / tileview | 屏灰底 `#f5f5f5` |
| `STYLE_SEED_SWITCH` | switch | 灰轨 + 圆形 radius |
| `STYLE_SEED_BAR_TRACK` | bar / slider | primary muted + 圆形 |
| `STYLE_SEED_LABEL` | label / checkbox / … | 透明底 + 主题字色 |
| `STYLE_SEED_LINE` / `LED` / `TRANSPARENT` | line / led / image / arc / … | 见 `widgets.ts` |

分册 `docs/控件属性面板详设/0x-*.md` §4 JSON 示例须与种子一致。回归：`tests/designer_widget_default_styles.test.ts`、`designer_container_default_style.test.ts`。

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
| … | 见用户手册 §4.4.1、§5.0.2 与各控件分册 | LVGL 9.10 状态枚举 |

Part/State 由 `StyleGroup` 下拉选择；默认 `main` + `default`。

**面板规则（对标 BK / 2026-08-05）：**

- **STATE** 始终显示（按钮等单 Part 控件也要能编 `pressed` / `disabled`）。
- **PART** 仅当 `styleParts.length > 1` 时显示；单 Part 固定 `main`，不占下拉。

### 6.2 样式子组与 JSON 键

| 子组 | 主要键 | 要求 |
|------|--------|------|
| 背景 | `bg_color`, `bg_grad_dir`, `bg_image`（对标手册 `bg_img_src`） | **`bg_image` 须资源库选择（§6.4）且画布真出图（§6.5）** |
| 字体 | `text_font`, **`text_font_size`（字号）**, `text_color`, `text_align`, … | 不含字/行间距；`text_font`「库」拾取；**字号画布必变且进 CodeGen**（对标 BK） |
| 间距 | `text_letter_space`, `text_line_space` | 对标 BK `space` |
| 边框 | `border_width`, `border_color`, **`radius`**, **`clip_corner`** | 圆角在边框组（对标 BK） |
| 内边距 | `pad_top`… | 全量 |
| 阴影 | `shadow_*` | 全量 |
| 外轮廓 | `outline_*` | Forge 扩展 |
| Image 专用 | `img_recolor`, `img_opa` | 全量 |

按控件过滤可见子组由 `styleSubgroupsForWidget` 决定（见各控件分册）。label 默认：背景/字体/间距/边框/内边距/阴影。

**样式库（FR-018，对标 BK）：**

1. 属性「样式」→ **保存** → `SaveStyleDialog`（名称必填 ≤50、描述可选 ≤200、样式图标预览）→ 写入 `project.themes[]`（含 `createdAt` / `description` / 当前 Part×State `props`）。  
2. **样式库** → `StyleLibraryDialog` 列表（缩略图、名称、描述、创建时间、应用/删除）→ 选中控件写入对应 Part×State 并设 `styleRef`。  
3. 颜色库管理命名色 + **色板主题**（`colorThemes`）；**样式**主题（Part×State）仅在样式库，不嵌在颜色库。

### 6.3 CodeGen 映射

Core/CodeGen 将 `style.parts[part][state]` 归一化后输出 `lv_obj_set_style_*`（LVGL 9.10）。Part 名与 LVGL `LV_PART_*` 映射表维护于主详设 §16 收口项。`bg_image` → `lv_obj_set_style_bg_image_src`（路径经资源规范化）。

### 6.4 缺口与修正方案（2026-08-03）：样式 `bg_image` 资源库选择

#### 现象

样式子组「背景图片」仅有手填路径输入框，**无**「库 / 选择」按钮；无法像 Beken 属性面板背景图那样从资源列表点选。同产品内：属性组 `props.src`（`DynamicPropForm`）与样式 `text_font`（`StyleGroup`「库」）均已接 `AssetsDialog`。

#### 根因（实现对照）

| 位置 | 行为 |
|------|------|
| Beken | 背景图字段带文件夹/资源选择入口，写入工程资源路径 |
| `DynamicPropForm.vue` | `imageSrc` → 下拉（已有图）+ **「选择」** → `ui.openAssetsForImagePick` |
| `StyleGroup.vue` | `sf.type === 'imageSrc'`（含 `bg_image`）→ **仅** `<input type="text">`，未调用资源拾取 |
| `ui.ts` / `AssetsDialog` | 拾取管道已存在（`openAssetsForImagePick` / `pickImageAsset`），样式侧未接线 |

字段已注册：`style-fields.ts` 中 `{ key: "bg_image", type: "imageSrc" }`；CodeGen/画布已支持路径。缺口在 **StyleGroup 控件渲染**，非 Schema / CodeGen。

#### 修正方案（待确认后实现）

1. **UI 对齐 `DynamicPropForm` + 字体「库」行：** `StyleGroup` 对 `imageSrc` 使用「可选下拉（工程图片列表）+ 文本路径 + **库** 按钮」。  
2. **交互：** 「库」→ `ui.openAssetsForImagePick` → 回调 `emit('patch', part, state, { [key]: path })`；路径约定与属性组一致（`assets/images/…`）。  
3. **范围：** 所有样式 `imageSrc` 键（当前主要为 `bg_image`）；后续若增 `bg_image_*` 同类键自动受益。  
4. **验收：** 选中控件 → 样式/背景 → 「库」打开资源管理 → 选图后 `style.parts.main.default.bg_image` 更新；画布/CodeGen 可见；单测断言 StyleGroup 含 `openAssetsForImagePick` / 「库」。  
5. **不做：** 不改 MCP 工具面（AI 仍用 `batch_update`/`styleKeys` 写路径）；不改工程 Schema 字段名（保持 `bg_image`，手册别名 `bg_img_src` 仅文档映射）。

**状态：** ✅ 已实现（`StyleGroup` image-row + `openAssetsForImagePick`；测试 `tests/designer_style_image_pick.test.ts`）。

### 6.5 缺口与修正（2026-08-04）：画布真显示（FR-016e 收口）

#### 现象（对照 Beken，已复现）

1. 样式选了背景图 → JSON 有 `bg_image` → **画布仍无图**。  
2. 改字体 / 对齐 → 画布文本几乎无变化；Beken「字号」在 Forge **无字段**。  
3. 前一版契约测试只断言 CSS 含文件名，**把假完成测成绿**。

#### 根因

| 项 | 说明 |
|----|------|
| 路径未解析 | chrome 写 `url("assets/images/x.png")`，页面在 `http://localhost:5173`，请求不到工程文件 |
| 字体未注册 | `fontFamily: "@id"` 浏览器无此字体 |
| 缺字号 | 样式子组无 `text_font_size` |
| 文案 DOM | `.btn-label` 内容收缩 + `nowrap`，对齐/换行弱 |

#### 设计（必须落地，验收以肉眼/真文件为准）

1. **IPC** `project:assetDataUrl(relPath)`：校验路径在工程根下 → 读二进制 → 返回 `data:<mime>;base64,...`；preload `resolveAssetDataUrl`。  
2. **Renderer** `projectAssetCache`：按 relPath 缓存 data URL；`buildWidgetCanvasChrome` 只接受**已解析**的 `resolvedBgImage` / 字体族名。  
3. **字体：** 新建/打开工程注入内置 TTF（`SourceHanSansCN-Bold` 等）并 `@font-face`；控件样式种子默认 **`text_font=@SourceHanSansCN-Bold`**、**`text_font_size=16`**。行高用 LVGL montserrat `line_height`（≈size+2，再加 `text_line_space`），**禁止**用 `size×1.3` 冒充。CodeGen：`text_font`+`text_font_size` → `forgeui_font_<id>_<size>` 或 `&lv_font_montserrat_<size>`。  
4. **按钮文案：** `.btn-label { width:100% }`；CodeGen 子 label `LV_PCT(100)` + `long_mode`。  
5. **image 控件：** `props.src` 同一管线，画布 `<img :src="dataUrl">`。  
6. **测试：** `designer_canvas_asset_url`；`codegen_long_mode_bk`；`codegen_style_text_font`；画布行高/默认族契约（label/button BK 测试）。

**不做借口：** chrome **不得空白**；字号/长文本不得「画布有、模拟无」；**字相对框的视觉比例**须与模拟接近（V1.6f）。

**状态：** ✅ V1.6e 长文本/字号 CodeGen；**V1.6f** 默认 Montserrat + LVGL 行高（框比例）。

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
| 画布 8 向缩放 | 选中 **8 手柄**（四角+四边，对标 Beken）；按方向更新 `frame.x/y/w/h`；最小边长 16px；锁定无手柄；手柄为**纯色小方块**（无描边）；挂在 `overflow:visible` 外壳，不被内容 overflow 裁切 |
| 画布旋转锚点 | 顶边中点上方圆形手柄（内含旋转箭头图示）+ 竖线；绕中心改 `frame.rotation`（与 CodeGen pivot 50% 一致）；面板旋转字段双向同步；与缩放点同层（外壳） |
| Selection 分层 | `.widget` 外壳 + `.widget-body` 内容；选中 `z-index:200`；独立 `.selection-border`（对标 Beken） |
| 属性面板改 frame | 画布即时同步 |
| 删除控件 | `removeSelected()`；可 undo；工作区 **Delete/Backspace** 同路径（FR-012a） |
| 修改任意属性 | `dirty=true`；**Ctrl+S** 写 `screens/*.json` |
| 生成/预览 | 流程内自动 `saveProject`（若 dirty） |

---

## 9. 测试策略

| 层级 | 文件 | 覆盖 |
|------|------|------|
| 结构测试 | `tests/designer_workbench_layout.test.ts` | Inspector 挂载、Tab  wiring |
| 组件测试 | `tests/designer_inspector_panel.test.ts` | Tab 切换、v-show 互斥 |
| 组件测试（V1） | `tests/designer_prop_form.test.ts` | PropSpec 各 type 渲染 |
| extraData | `packages/core/src/extra-data.test.ts` | list 默认 items + patch |
| 集成测试 | `tests/designer_save_flow.test.ts` | 改 props 存档落盘 |
| E2E（可选） | Playwright | 开工程 → 选按钮 → 改 text → 存档 |

**验收用例（摘录）：**

1. 选 `button`，属性 Tab 改 `text` → 画布标签变 → 存档 → JSON `props.text` 一致。  
2. 事件 Tab 添加 `CLICKED` → `CHANGE_SCREEN` → 存档 → JSON `events[]` 一致。  
3. V1：选 `slider`，Style Part 切 `indicator` → 改色 → CodeGen 含对应 `lv_obj_set_style_*`。

---

## 10. 相关文档与路径索引

| 文档 | 路径 |
|------|------|
| 主详设 | `docs/嵌入式UI工具_软件详细设计说明.md` §3.5.2、§9.7.4 |
| 用户手册 | `docs/工具详细说明手册/控件属性面板使用说明.md` |
| 需求 | `docs/嵌入式UI工具_设计需求文档.md` FR-016～017 |
| Beken 截图 | `docs/beken界面/属性面板/` |
| AI 规格 | `ref/beken/.../component-specs/` |
| 实现 | `apps/designer/src/components/{InspectorPanel,PropPanel,EventPanel}.vue` |
| 注册表 | `packages/core/src/widgets.ts` |
| 实现进度 | `docs/IMPLEMENTATION_PROGRESS.md` |
| 截图脚本 | `.tmp/capture_component_props.py` |

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.6l | 2026-08-07 | `03-button`：`isContainer=false`；与树/面板/MCP 可父规则对齐 |
| V1.6k | 2026-08-06 | §5.4：`WidgetSpec.defaultStyle` 对齐 theme_default Light；分册 JSON 同步；画布缺省回退种子 |
| V1.6j | 2026-08-06 | 旋转锚点补箭头图示（圆柄 + SVG，对标 Beken） |
| V1.6i | 2026-08-06 | Selection chrome 外壳/内容分离 + 选中 z-index；修复手柄裁切 |
| V1.6h | 2026-08-05 | 缩放手柄纯色方块；画布旋转锚点（绕中心 / CodeGen pivot 一致） |
| V1.6g | 2026-08-05 | 画布选中 8 向缩放手柄（对标 Beken）；`resize-handles.ts` + `designer_resize_handles` |
| V1.6f | 2026-08-05 | 画布默认 Montserrat + LVGL montserrat 行高；修正字号/文本框比例与模拟不一致 |
| V1.6e | 2026-08-05 | 长文本/字号对标 BK：模拟 DOTS/WRAP；字号进 CodeGen；画布默认 14；`codegen_long_mode_bk` |
| V1.6d | 2026-08-05 | 样式库：保存/库对话框对标 BK；themes 增 description/createdAt；颜色库去主题 Tab |
| V1.6c | 2026-08-05 | 样式子组对标 BK：独立间距；圆角归边框；label 六组；显示/隐藏同步展开收起 |
| V1.6b | 2026-08-05 | 标签：对齐改样式侧；long_mode 画布；is_text_static；显示名≠文本（04-label） |
| V1.6 | 2026-08-05 | §3.5：位置信息 3×3 格示意分方位 + 点击吸附父容器九宫（对标 Beken） |
| V1.5 | 2026-08-05 | 删除分期矩阵与 V1 里程碑；实现进度改指 IMPLEMENTATION_PROGRESS.md；按控件分册为属性设计主入口 |
| V1.4 | 2026-08-04 | §6.5：画布真显示（bg_image data URL、字号、字体 face）；FR-016e 收口 |
| V1.2 | 2026-08-03 | §6.4：样式 `bg_image` 缺资源库选择根因与修正方案；§9 差距表拆分属性/样式 imageSrc；刷新 V1-B 已完成项 |
| V1.0 | 2026-08-01 | 初版：模块架构、数据模型、Registry、Style/Event、MVP 差距、V1 里程碑；对齐 InspectorPanel Tab 实现 |

---

*本文为模块契约总目录；单控件属性设计见 `docs/控件属性面板详设/`。实现进度见 `docs/IMPLEMENTATION_PROGRESS.md`。与用户手册冲突时以需求 FR 与已锁定决策为准。*
