# 图片（`image`）属性面板设计

> **文档类型：** 控件属性面板 — 单控件设计契约  
> **所属模块：** [《控件属性面板详细设计说明》](../嵌入式UI工具_控件属性面板详细设计说明.md)  
> **Forge 类型：** `image`  
> **分类：** 图片媒体  
> **权威注册表：** `packages/core/src/widgets.ts`  
> **字段级用户手册：** `docs/工具详细说明手册/控件属性面板使用说明.md`  
> **Beken 规格：** `ref/beken/.../component-specs/image/`（若存在）

---

## 1. 设计目标

- 属性 Tab 按模块详设 §3.3 分组：身份头 → 位置信息 → **专用属性** → 扩展数据（若有）→ 行为配置 → 样式。
- 写路径：面板 → `projectStore.patchSelected` / `patchSelectedStyle` → IPC → Core；画布须满足 **FR-016e**（改完可见）。
- 禁止用 `children` 冒充列表/标签/图表数据（**FR-016b**）；结构化数据走 `extraData`。

## 2. 注册表契约（WidgetSpec）

| 项 | 值 |
|----|----|
| type | `image` |
| 中文名 | 图片 |
| category | `media` |
| isContainer | false |
| styleParts | `main` |
| events | `CLICKED` |
| extraDataEditor | — |

### 2.1 专用属性（props）

| 字段 | 面板标签 | 类型 | 默认值 |
|------|----------|------|--------|
| `src` | 图片路径 | `imageSrc` | `""` |

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
  "type": "image",
  "id": "image_1",
  "name": "图片",
  "frame": {
    "x": 0,
    "y": 0,
    "w": 100,
    "h": 40
  },
  "props": {
    "src": ""
  },
  "style": {
    "main": {
      "default": {
        "bg_color": "#ffffff00"
      }
    }
  },
  "events": [],
  "children": []
}
```

添加时由 `WidgetSpec.defaultStyle`（`STYLE_SEED_TRANSPARENT`）写入，对齐 LVGL `theme_default` Light，保证画布与模拟一致。

## 5. 验收要点

1. 选中后属性 Tab 显示专用字段与正确 Part 列表。
2. 修改专用属性/样式后画布或预览可观测变化（FR-016e）；存档后 JSON 一致。
3. 若有 extraData：增删改与 CodeGen 同源，不得依赖伪子控件。
4. Undo/Redo 可回退属性修改。

## 6. 用户手册摘录（字段 encyclopedia）

> 摘自《控件属性面板使用说明》；冲突时以 `widgets.ts` + 需求 FR 为准。

## 5.3 图片（image）

**Beken 参照：** `属性面板/图片属性/图片属性-1.png`～`图片属性-3.png`

### 5.3.1 专用属性

| 字段 | Beken UI | ForgeUI 字段 | 说明 |
|------|----------|--------------|------|
| 图片路径 | 未选择图片 + 文件夹 | `props.src` | 相对 `assets/` 或工程内路径 |
| 外部存储 | 开关 | V1 | 资源不打包进工程 |
| 颜色格式 | RGB565A8 | V1（导出管线） | 与平台纹理格式相关 |
| 抖动算法 | NONE | V1 | 量化导出选项 |
| 旋转角度 / 旋转中心 X/Y | 0 / 50 / 50 | V1 | 图片自身变换 |

![图片-属性](../../beken界面/属性面板/图片属性/图片属性-1.png)

### 5.3.2 选择图片步骤

1. 顶栏 **资源管理** 导入 PNG 等到 `assets/`。  
2. 选中图片控件。  
3. **属性 → 图片路径** 点击文件夹图标，从资源列表选择（MVP 可手填 `props.src` 路径）。  
4. 画布显示占位或缩略图；仿真以 LVGL 解码为准。

### 5.3.3 样式要点

图片控件除通用 **背景 / 边框 / 阴影** 外，另有 **Image** 子组：

| 字段 | 说明 |
|------|------|
| 重染色&透明度 | `img_recolor`，整体调色 |
| 图片透明度 | `img_opa`，0～255 |

![图片-样式](../../beken界面/属性面板/图片属性/图片属性-2.png)  
![图片-Image子组](../../beken界面/属性面板/图片属性/图片属性-3.png)

### 5.3.4 JSON 片段示例

```json
{
  "type": "image",
  "id": "img_logo",
  "name": "Logo",
  "frame": { "x": 190, "y": 86, "w": 100, "h": 100 },
  "props": { "src": "assets/logo.png" },
  "style": {
    "main": {
      "default": { "img_opa": 255 }
    }
  },
  "events": [],
  "children": []
}
```

---

*分册序号：5 · 生成自注册表与用户手册；模块架构见 [总目录](../嵌入式UI工具_控件属性面板详细设计说明.md)。*
