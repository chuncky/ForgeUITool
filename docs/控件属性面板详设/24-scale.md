# 刻度（`scale`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `scale`  
> **分类：** 可视化  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/scale/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `scale` |
| 中文名 | 刻度 |
| category | `viz` |
| isContainer | false |
| styleParts | `main`, `items`, `indicator` |
| events | — |
| extraDataEditor | — |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 |
|------|----------|------|--------|
| `tick_cnt` | 刻度数 | `number` | `10` |
| `major_tick_every` | 主刻度间隔 | `number` | `5` |
| `angle_range` | 角度范围 | `number` | `270` |
| `range_min` | 最小值 | `number` | `0` |
| `range_max` | 最大值 | `number` | `100` |
| `mode` | 刻度模式 | `enum` | `"HORIZONTAL_BOTTOM"` |

### 2.2 样式 Part

- `main`
- `items`
- `indicator`

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
  "type": "scale",
  "id": "scale_1",
  "name": "刻度",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {
    "tick_cnt": 10,
    "major_tick_every": 5,
    "angle_range": 270,
    "range_min": 0,
    "range_max": 100,
    "mode": "HORIZONTAL_BOTTOM"
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

## 5.12.4 刻度（`scale`）

**Beken 参照：** `ref/beken/.../component-specs/scale/scale.md`；截图 `docs/beken界面/属性面板/刻度属性/刻度属性-1.png`～`刻度属性-7.png`、`-全窗.png`

**Beken 截图：**

![刻度-1](../../beken界面/属性面板/刻度属性/刻度属性-1.png)
![刻度-2](../../beken界面/属性面板/刻度属性/刻度属性-2.png)
![刻度-3](../../beken界面/属性面板/刻度属性/刻度属性-3.png)
![刻度-4](../../beken界面/属性面板/刻度属性/刻度属性-4.png)
![刻度-5](../../beken界面/属性面板/刻度属性/刻度属性-5.png)
![刻度-6](../../beken界面/属性面板/刻度属性/刻度属性-6.png)
![刻度-7](../../beken界面/属性面板/刻度属性/刻度属性-7.png)

### 专用属性

| 字段 | Beken UI | 类型 | 默认值 | ForgeUI |
|------|----------|------|--------|---------|
| `tick_cnt` | tick_cnt | Common/Number | 41 | V1 |
| `major_tick_nth` | major_tick_nth | Common/Number | 8 | V1 |
| `rotation` | rotation | Common/Number | 14 | V1 |
| `angle_range` | angle_range | Common/Number | 260 | V1 |
| `range` | 范围 | Common/Range | {"min":0,"max":100} | V1 |
| `label_enable` | label_enable | Common/Boolean | true | V1 |
| `mode` | 模式 | Common/Enum | "ROUND_INNER" | V1 |

**扩展数据（extraData，属性面板内嵌编辑器）：**

- `needles[]`: gauge indicators.
- `needles[].needle_type`: `"line"` or `"image"`.
- `needles[].needle_width`, `needle_color`, `needle_length`, `needle_rounded`: line needle style.
- `needles[].img_path`, `img_width`, `img_height`: image needle asset and si

---

*分册序号：24 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
