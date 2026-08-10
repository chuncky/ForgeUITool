# 标签（`label`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `label`  
> **分类：** 数据展示  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md` §5.2  
> **Beken 规格：** `ref/beken/.../component-specs/label/`  
> **修订：** 2026-08-06 — CodeGen `long_mode` 对齐产品 LVGL（`LV_LABEL_LONG_*`，DOTS→DOT）；2026-08-05 — 对标 BK：对齐改样式侧；`long_mode` 画布+模拟；`is_text_static`；字号进 CodeGen；**V1.6f 画布默认 Montserrat + LVGL 行高，修正框比例**；厘清「显示名」与「文本」

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- **对标 Beken label：** 文本 / 静态文本 / 长文本模式在属性；**文本对齐只在样式→字体**。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `label` |
| 中文名 | 标签 |
| category | `display` |
| isContainer | false |
| styleParts | `main` |
| events | — |
| extraDataEditor | — |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 | 说明 |
|------|----------|------|--------|------|
| `text` | 文本 | `text` | `"Label"` | **画布与 CodeGen 显示内容**（对标 BK `text`） |
| `is_text_static` | 静态文本 | `boolean` | `false` | 对标 BK `is_text_static`；为 true 时 CodeGen 用 `lv_label_set_text_static` |
| `long_mode` | 长文本模式 | `enum` | `"WRAP"` | WRAP / DOTS / SCROLL / SCROLL_CIRCULAR / CLIP；**画布与模拟均须可见**（对标 BK 固定宽高框） |

**禁止**再放 `props.text_align`（对齐只走样式，见 §2.3）。

### 2.2 身份区（非 props）

| UI | 字段 | 说明 |
|----|------|------|
| 显示名 | `node.name` | 大纲/树显示名，**不等于**画布文案 |
| ID | `node.id` | 只读，CodeGen 符号 |

### 2.3 样式子组（对标 BK `enabledGroups`）

可见子组：`background` / `font` / `space` / `border` / `padding` / `shadow`。

| 字段 | 面板位置 | JSON | 画布 |
|------|----------|------|------|
| 对齐 | 样式 → **字体** → 对齐 | `style.main.*.text_align` | `textAlign` + `justifyContent` |
| 颜色 / 字号 / 字体 | 样式 → 字体 | `text_color` / `text_font_size` / `text_font` | 画布 CSS；**字号同时驱动 CodeGen**（对标 BK `font_family`+`font_size`） |
| 字间距 / 行间距 | 样式 → **间距** | `text_letter_space` / `text_line_space` | letterSpacing；**行高按 LVGL montserrat：`fontSize+2 + text_line_space`**（14→16，非 ×1.3） |
| 圆角 | 样式 → **边框** | `radius` | borderRadius |

**画布↔模拟字号/框比例（V1.6f）：**

| 项 | 契约 |
|----|------|
| 默认字体 | 未设时种子为 **`@SourceHanSansCN-Bold`**（内置 `xos-package/res/ttf`）；画布 `@font-face` 加载，禁止依赖系统 Segoe/Arial 冒充 |
| 默认字号 | 未设 `text_font_size` → **16**（画布与模拟一致） |
| 行高 | 对齐 LVGL montserrat `line_height`（常见 = size+2；24 等为 size+3 时用表）；再加 `text_line_space` |
| WRAP | 固定 `frame` 宽高内换行裁切；断行位置以模拟为准，画布用同族字体逼近 |
| 验收 | 同框同文：画布与模拟可见行数接近；字相对框的比例不得明显「画布小一圈 / 模拟撑满」 |

### 2.4 样式 Part

- `main`

## 3. 面板实现要点

| 能力 | 要求 |
|------|------|
| PropIdentityHeader | 「显示名」+ 短说明：大纲用，非画布文案 |
| DynamicPropForm | 仅 §2.1 三字段；`text` 单块文本区 |
| StyleGroup | 六组；**显示**展开编辑并参与渲染，**隐藏**收起且不参与；字体含 `text_align`；间距独立 |
| 长文本模式 | `canvas-chrome` / WidgetView 对 label 应用与 button 同源的 overflow 映射 |
| 删除 | 底部删除 + Delete/Backspace |

## 4. JSON 落盘形态（摘要）

```json
{
  "type": "label",
  "id": "label_1",
  "name": "标题",
  "frame": { "x": 0, "y": 0, "w": 120, "h": 32 },
  "props": {
    "text": "Hello",
    "is_text_static": false,
    "long_mode": "WRAP"
  },
  "style": {
    "main": {
      "default": {
        "bg_color": "#ffffff00",
        "text_color": "#212121ff"
      }
    }
  },
  "events": [],
  "children": []
}
```

添加时由 `WidgetSpec.defaultStyle`（`STYLE_SEED_LABEL`）写入，对齐 LVGL `theme_default` Light（透明底 + 主题字色），保证画布与模拟一致。用户可再改对齐/字色等。

## 5. CodeGen

| 条件 | C API |
|------|-------|
| `is_text_static === true` | `lv_label_set_text_static(obj, "…")` |
| 否则 | `lv_label_set_text(obj, "…")` |
| `long_mode` | `lv_label_set_long_mode(obj, LV_LABEL_LONG_*)`（产品 LVGL / xos-package；**勿**用 Beken 模板的 `LV_LABEL_LONG_MODE_*`；面板 `DOTS` → `LV_LABEL_LONG_DOT`）；随后对本对象 `lv_obj_set_size`，固定框；DOTS 依赖宽度 |
| 对齐 | 仅由样式发射 `lv_obj_set_style_text_align`（**勿**再从 props 发射） |
| `text_font` + `text_font_size` | `lv_obj_set_style_text_font` → `forgeui_font_<id>_<size>`（对标 BK `i18nFontC(family, size)`） |
| 仅 `text_font_size` | `&lv_font_montserrat_<size>`（对标 BK 默认族） |
| 仅 `text_font` | 资源默认 size，缺省 **16** |

回归：`tests/codegen_long_mode_bk.test.ts`、`tests/codegen_style_text_font.test.ts`。

## 6. 验收要点

1. 改「文本」→ 画布文字变；改「显示名」→ 仅树/头变，画布文案不变。  
2. 长文本：窄框 + 长文，**画布与模拟** DOTS 出省略，WRAP 在框内换行且超出高度裁切；SCROLL / SCROLL_CIRCULAR 画布为 CSS 预览，**以模拟为准**。  
3. 样式字体对齐 Left/Center/Right → 画布对齐变化。  
4. 改字号 → 画布变大/变小，且重新生成后模拟字号一致（非仅 CSS）。  
5. **框比例：** 默认 SourceHanSansCN-Bold 16 + 行高按 LVGL montserrat 表（18）；窄框 WRAP 下画布与模拟行数/占框比例接近。  
6. 属性区**无**「文本对齐」下拉。  
7. 勾选静态文本 → 存档后生成 C 含 `lv_label_set_text_static`。  
8. Undo/Redo 可回退。

## 7. 用户手册摘录

见《控件属性面板使用说明》§5.2（须与本文一致）。

---

*分册序号：4 · 对标 Beken label 规格。*
