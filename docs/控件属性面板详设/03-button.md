# 按钮（`button`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `button`  
> **分类：** 按钮  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/button/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `button` |
| 中文名 | 按钮 |
| category | `button` |
| isContainer | **false**（不可作父；面板添加 / 树拖拽 / MCP 均不可把子控件挂进 button；文案用 `props.text`） |
| styleParts | `main` |
| events | `CLICKED`, `PRESSED`, `RELEASED`, `LONG_PRESSED` |
| extraDataEditor | — |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 |
|------|----------|------|--------|
| `text` | 文本 | `text` | `"Button"` |
| `long_mode` | 长文本模式 | `enum` | `"WRAP"` |

### 2.2 样式 Part

- `main`

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
  "type": "button",
  "id": "button_1",
  "name": "按钮",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {
    "text": "Button",
    "long_mode": "WRAP"
  },
  "style": {
    "main": {
      "default": {
        "bg_color": "#2196F3ff",
        "text_color": "#ffffffff",
        "radius": 8
      }
    }
  },
  "events": [],
  "children": []
}
```

添加时由 `WidgetSpec.defaultStyle`（`STYLE_SEED_BTN_PRIMARY`）写入，对齐 LVGL `theme_default` Light，保证画布与模拟一致。

## 5. 验收要点

1. 选中后属性 Tab 显示专用字段与正确 Part 列表。
2. 修改专用属性/样式后画布或预览可观测变化（FR-016e）；存档后 JSON 一致。
3. 若有 extraData：增删改与 CodeGen 同源，不得依赖伪子控件。
4. Undo/Redo 可回退属性修改。

## 6. 用户手册摘录（字段 encyclopedia）

> 摘自《控件属性面板使用说明》；冲突时以 `widgets.ts` + 需求 FR 为准。

## 5.1 按钮（button）

**Beken 参照：** `属性面板/按钮属性/按钮属性-1.png`～`按钮属性-6.png`、`-全窗.png`

### 5.1.1 位置信息

与 §4.1 相同。Beken 示例：X=190，Y=116，宽=100，高=40。

### 5.1.2 专用属性

| 字段 | Beken UI | ForgeUI 字段 | 默认值 | 说明 |
|------|----------|--------------|--------|------|
| 文本 | 文本 + 静态文本勾选 | `props.text` | `"Button"` | 按钮显示文字；画布即时更新 |
| 长文本模式 | WRAP / DOTS / SCROLL / … | `props.long_mode` | `WRAP` | 画布+模拟：WRAP 框内换行裁切；DOTS 省略；CLIP 裁剪（对标 BK；子 label `LV_PCT(100)`） |
| 多语言 | 文本框右侧图标 | V2 | — | i18n 键引用 |

**回归测试：** `tests/designer_button_prop_display_bk.test.ts` 按 Beken 对照清单逐项断言画布可用（几何/属性/行为/样式共 38 项）。

**画布可见性（FR-016e，对标 Beken，必须实际能用）：**

| 操作 | 期望画布效果 |
|------|----------------|
| 样式 → 背景 → 选背景图片 | 按钮区域显示图片（不是只有路径写入） |
| 样式 → 字体 → 字号 | 文字大小变化（如 16→24）；**重新生成后模拟一致**（CodeGen 按 size 选字） |
| 样式 → 字体 → 字体（已导入） | 字形切换（需先资源管理导入字体） |
| 样式 → 字体 → 对齐 Left/Right | 文案靠左/靠右 |
| 样式 → 字体 → 颜色 | 文字颜色变化 |

**CodeGen（对标 BK `widget_button.hbs` 意图）：** 子 label `lv_label_set_long_mode` → `lv_obj_set_width(label, LV_PCT(100))` → `lv_obj_align(CENTER)`。回归：`tests/codegen_long_mode_bk.test.ts`。

![按钮-属性](../../beken界面/属性面板/按钮属性/按钮属性-1.png)

### 5.1.3 样式建议（对标 Beken 默认）

| Part | State | 常用设置 |
|------|-------|----------|
| MAIN | DEFAULT | 背景 `#2d75b9ff`，圆角 5，文字 `#ffffffff` |
| MAIN | PRESSED | 背景加深，可选 PRESSED 态 |
| MAIN | DISABLED | 降透明度或灰显 |

![按钮-样式](../../beken界面/属性面板/按钮属性/按钮属性-2.png)  
![按钮-字体边框](../../beken界面/属性面板/按钮属性/按钮属性-3.png)  
![按钮-内边距阴影](../../beken界面/属性面板/按钮属性/按钮属性-4.png)  
![按钮-5](../../beken界面/属性面板/按钮属性/按钮属性-5.png)  
![按钮-6](../../beken界面/属性面板/按钮属性/按钮属性-6.png)

### 5.1.4 操作示例：修改按钮文字

1. 选中画布上的按钮。  
2. 在 **属性 → 文本** 中输入新文字。  
3. 失焦或回车后画布标签即时更新。  
4. **Ctrl+S** 存档。

### 5.1.5 JSON 片段示例

```json
{
  "type": "button",
  "id": "btn_ok",
  "name": "确定按钮",
  "frame": { "x": 190, "y": 116, "w": 100, "h": 40 },
  "props": { "text": "确定" },
  "style": {
    "main": {
      "default": { "bg_color": "#2196F3ff", "text_color": "#ffffffff", "radius": 8 },
      "pressed": { "bg_color": "#1976D2ff" }
    }
  },
  "events": [],
  "children": []
}
```

---

---

*分册序号：3 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
