# 图表（`chart`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `chart`  
> **分类：** 可视化  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/chart/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `chart` |
| 中文名 | 图表 |
| category | `viz` |
| isContainer | false |
| styleParts | `main`, `series` |
| events | — |
| extraDataEditor | `series` |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 |
|------|----------|------|--------|
| `point_count` | 点数 | `number` | `10` |
| `div_line_count_h` | 水平分割线 | `number` | `5` |
| `div_line_count_v` | 垂直分割线 | `number` | `5` |
| `chart_type` | 图表类型 | `enum` | `"LINE"` |

### 2.2 扩展数据（extraData）

- 编辑器种类：`series`（见模块详设 §4.2 / `ExtraDataGroup`）
- 默认：`{ series: [ { name: "Series 1", color: "#4a90e2", values: [10, 20, 30, 40, 50, 10, 30, 50, 30, 10] }, { name: "Series 2", color: "#bd93f9", values: [5, 15, 25, 35, 45, 15, 25, 35, 25, 15] }, ], }`

### 2.3 样式 Part

- `main`
- `series`

通用样式子组见模块详设 §6；多 Part 控件须在 PART 下拉中分别编辑。

## 3. 面板实现要点

| 能力 | 要求 |
|------|------|
| DynamicPropForm | 仅渲染上表 PropSpec；类型映射见模块详设 §5.2 |
| StyleGroup | Part = styleParts；`bg_image` / `text_font` 须资源库拾取且画布真显示（§6.4 / §6.5） |
| ExtraData | 使用 `series`；改完须驱动画布 |
| 事件 Tab | 仅注册表 events 中的触发器 |
| 删除 | 底部删除 + Delete/Backspace（FR-012a） |

## 4. JSON 落盘形态（摘要）

```json
{
  "type": "chart",
  "id": "chart_1",
  "name": "图表",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {
    "point_count": 10,
    "div_line_count_h": 5,
    "div_line_count_v": 5,
    "chart_type": "LINE"
  },
  "extraData": {
    "_editor": "series"
  },
  "style": {
    "main": {
      "default": {}
    }
  },
  "events": [],
  "children": []
}
```

## 5. 验收要点

1. 选中后属性 Tab 显示专用字段与正确 Part 列表。
2. 修改专用属性/样式后画布或预览可观测变化（FR-016e）；存档后 JSON 一致。
3. 若有 extraData：增删改与 CodeGen 同源，不得依赖伪子控件。
4. Undo/Redo 可回退属性修改。

## 6. 用户手册摘录（字段 encyclopedia）

> 摘自《控件属性面板使用说明》；冲突时以 `widgets.ts` + 需求 FR 为准。

## 5.13.4 chart（`chart`）

**Beken 参照：** `ref/beken/.../component-specs/chart/chart.md`；截图目录 `docs/beken界面/属性面板/chart属性/`（**暂无截图**，见 component-specs）

### 专用属性

| 字段 | Beken UI | 类型 | 默认值 | ForgeUI |
|------|----------|------|--------|---------|
| `point_count` | point_count | Common/Number | 10 | V1 |
| `div_line_count_h` | div_line_count_h | Common/Number | 5 | V1 |
| `div_line_count_v` | div_line_count_v | Common/Number | 5 | V1 |
| `range_min` | 最小值 | Common/Number | 0 | V1 |
| `range_max` | 最大值 | Common/Number | 100 | V1 |
| `

---

*分册序号：39 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
