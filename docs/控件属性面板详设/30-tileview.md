# 平铺视图（`tileview`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `tileview`  
> **分类：** 布局  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/tileview/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `tileview` |
| 中文名 | 平铺视图 |
| category | `layout` |
| isContainer | true |
| styleParts | `main`, `scrollbar` |
| events | `VALUE_CHANGED` |
| extraDataEditor | `tabs` |

### 2.1 专用属性（props）

（无专用 `props`；面板仍含位置信息、行为配置、样式。）

### 2.2 扩展数据（extraData）

- 编辑器种类：`tabs`（见模块详设 §4.2 / `ExtraDataGroup`）
- 默认：`{ tabs: [{ name: "Tile 1" }, { name: "Tile 2" }] }`

### 2.3 样式 Part

- `main`
- `scrollbar`

通用样式子组见模块详设 §6；多 Part 控件须在 PART 下拉中分别编辑。

## 3. 面板实现要点

| 能力 | 要求 |
|------|------|
| DynamicPropForm | 仅渲染上表 PropSpec；类型映射见模块详设 §5.2 |
| StyleGroup | Part = styleParts；`bg_image` / `text_font` 须资源库拾取且画布真显示（§6.4 / §6.5） |
| ExtraData | 使用 `tabs`；改完须驱动画布 |
| 事件 Tab | 仅注册表 events 中的触发器 |
| 删除 | 底部删除 + Delete/Backspace（FR-012a） |

## 4. JSON 落盘形态（摘要）

```json
{
  "type": "tileview",
  "id": "tileview_1",
  "name": "平铺视图",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {},
  "extraData": {
    "_editor": "tabs"
  },
  "style": {
    "main": {
      "default": {
        "bg_color": "#f5f5f5ff",
        "text_color": "#212121ff"
      }
    }
  },
  "events": [],
  "children": []
}
```

添加时由 `WidgetSpec.defaultStyle`（`STYLE_SEED_SCR`）写入，对齐 LVGL `theme_default` Light，保证画布与模拟一致。

## 5. 验收要点

1. 选中后属性 Tab 显示专用字段与正确 Part 列表。
2. 修改专用属性/样式后画布或预览可观测变化（FR-016e）；存档后 JSON 一致。
3. 若有 extraData：增删改与 CodeGen 同源，不得依赖伪子控件。
4. Undo/Redo 可回退属性修改。

## 6. 用户手册摘录（字段 encyclopedia）

> 摘自《控件属性面板使用说明》；冲突时以 `widgets.ts` + 需求 FR 为准。

## 5.11.3 平铺视图（`tileview`）

**Beken 参照：** `ref/beken/.../component-specs/tileview/tileview.md`；截图 `docs/beken界面/属性面板/平铺视图属性/平铺视图属性-1.png`～`平铺视图属性-5.png`、`-全窗.png`

**Beken 截图：**

![平铺视图-1](../../beken界面/属性面板/平铺视图属性/平铺视图属性-1.png)
![平铺视图-2](../../beken界面/属性面板/平铺视图属性/平铺视图属性-2.png)
![平铺视图-3](../../beken界面/属性面板/平铺视图属性/平铺视图属性-3.png)
![平铺视图-4](../../beken界面/属性面板/平铺视图属性/平铺视图属性-4.png)
![平铺视图-5](../../beken界面/属性面板/平铺视图属性/平铺视图属性-5.png)

### 专用属性

| 字段 | Beken UI | 类型 | 默认值 | ForgeUI |
|------|----------|------|--------|---------|
| `scrollbar_mode` | scrollbar_mode | Common/Enum | "OFF" | V1 |

**扩展数据（extraData，属性面板内嵌编辑器）：**

- `tiles[]`: available tile pages.
- `tiles[].id`: stable tile id used by child `layout.tileId`.
- `tiles[].name`: designer display name.
- `tiles[].col`: tile column.
- `tiles[].row`: tile row.
- `tiles[].dir`: allowed scroll direction: `"NONE"`, `"ALL"`, `"LEFT"`, `"RIGHT"`, `"TOP"`, `"BOTTOM"`, `"HOR"`, or `"VER"`.

### 样式 Part

`main`（MAIN）、`scrollbar`（SCROLLBAR）

> 通用样式子组（背景、字体、边框、阴影、内边距等）见 §4.4.2；多 Part 控件请在 **PART** 下拉中分别编辑 `main` / `indicator` / `knob` 等。

---

*分册序号：30 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
