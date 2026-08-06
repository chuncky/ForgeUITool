# 日历（`calendar`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `calendar`  
> **分类：** 数据展示  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/calendar/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `calendar` |
| 中文名 | 日历 |
| category | `display` |
| isContainer | false |
| styleParts | `main`, `main_header`, `main_buttonmatrix`, `items_buttonmatrix` |
| events | `VALUE_CHANGED` |
| extraDataEditor | — |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 |
|------|----------|------|--------|
| `today_year` | 年 | `number` | `2026` |
| `today_month` | 月 | `number` | `8` |
| `today_day` | 日 | `number` | `1` |

### 2.2 样式 Part

- `main`
- `main_header`
- `main_buttonmatrix`
- `items_buttonmatrix`

通用样式子组见模块详设 §6；多 Part 控件须在 PART 下拉中分别编辑。

## 3. 面板实现要点

| 能力 | 要求 |
|------|------|
| DynamicPropForm | 仅渲染上表 PropSpec；类型映射见模块详设 §5.2 |
| StyleGroup | Part = styleParts；`bg_image` / `text_font` 须资源库拾取且画布真显示（§6.4 / §6.5） |
| ExtraData | 无 |
| 事件 Tab | 仅注册表 events 中的触发器 |
| 删除 | 底部删除 + Delete/Backspace（FR-012a） |

## 4. JSON 落盘形态（摘要）

```json
{
  "type": "calendar",
  "id": "calendar_1",
  "name": "日历",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {
    "today_year": 2026,
    "today_month": 8,
    "today_day": 1
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

## 5.12.2 日历（`calendar`）

**Beken 参照：** `ref/beken/.../component-specs/calendar/calendar.md`；截图 `docs/beken界面/属性面板/日历属性/日历属性-1.png`～`日历属性-5.png`、`-全窗.png`

**Beken 截图：**

![日历-1](../../beken界面/属性面板/日历属性/日历属性-1.png)
![日历-2](../../beken界面/属性面板/日历属性/日历属性-2.png)
![日历-3](../../beken界面/属性面板/日历属性/日历属性-3.png)
![日历-4](../../beken界面/属性面板/日历属性/日历属性-4.png)
![日历-5](../../beken界面/属性面板/日历属性/日历属性-5.png)

### 专用属性

| 字段 | Beken UI | 类型 | 默认值 | ForgeUI |
|------|----------|------|--------|---------|
| `today_year` | today_year | Common/Number | 2024 | V1 |
| `today_month` | today_month | Common/Number | 1 | V1 |
| `today_day` | today_day | Common/Number | 1 | V1 |
| `showed_year` | showed_year | Common/Number | 2024 | V1 |
| `showed_month` | showed_month | Common/Number | 1 | V1 |

**扩展数据（extraData，属性面板内嵌编辑器）：**

- `highlighted_dates[]`: dates to highlight.
- `highlighted_dates[].year`: full year.
- `highlighted_dates[].month`: month number, 1-12.
- `highlighted_dates[].day`: day number, 1-31.
- `header_type`: `"arrow"`, `"dropdown"`, or `"none"`.
- `header_years_list`: year options for dropdown headers.

### 样式 Part

`main`（MAIN）、`main_header`（HEADER）、`main_buttonmatrix`（MAIN_BUTTONMATRIX）、`items_buttonmatrix`（ITEMS_BUTTONMATRIX）

> 通用样式子组（背景、字体、边框、阴影、内边距等）见 §4.4.2；多 Part 控件请在 **PART** 下拉中分别编辑 `main` / `indicator` / `knob` 等。

---

*分册序号：28 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
