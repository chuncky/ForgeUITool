# 控件属性面板详设 — 分册（按控件）

每个控件一份属性面板设计契约。生成自 `packages/core/src/widgets.ts` 与用户手册 §5。

**模块总目录（架构 / IPC / 共性契约）：** [`../嵌入式UI工具_控件属性面板详细设计说明.md`](../嵌入式UI工具_控件属性面板详细设计说明.md)

**默认样式：** 可添加控件的 §4 JSON `style.main.default` 须与 `WidgetSpec.defaultStyle`（`STYLE_SEED_*` / LVGL `theme_default` Light）一致，见模块详设 **§5.4**。权威源：`packages/core/src/widgets.ts`。

| # | 控件 | 类型 | 文档 |
|---|------|------|------|
| 1 | 屏幕 | `screen` | [01-screen.md](./01-screen.md) |
| 2 | 容器 | `container` | [02-container.md](./02-container.md) |
| 3 | 按钮 | `button` | [03-button.md](./03-button.md) |
| 4 | 标签 | `label` | [04-label.md](./04-label.md) |
| 5 | 图片 | `image` | [05-image.md](./05-image.md) |
| 6 | 滑条 | `slider` | [06-slider.md](./06-slider.md) |
| 7 | 开关 | `switch` | [07-switch.md](./07-switch.md) |
| 8 | 复选框 | `checkbox` | [08-checkbox.md](./08-checkbox.md) |
| 9 | 进度条 | `bar` | [09-bar.md](./09-bar.md) |
| 10 | 圆弧 | `arc` | [10-arc.md](./10-arc.md) |
| 11 | 下拉框 | `dropdown` | [11-dropdown.md](./11-dropdown.md) |
| 12 | 文本域 | `textarea` | [12-textarea.md](./12-textarea.md) |
| 13 | 列表 | `list` | [13-list.md](./13-list.md) |
| 14 | 滚轮 | `roller` | [14-roller.md](./14-roller.md) |
| 15 | 图片按钮 | `imagebutton` | [15-imagebutton.md](./15-imagebutton.md) |
| 16 | 加载动画 | `spinner` | [16-spinner.md](./16-spinner.md) |
| 17 | 标签视图 | `tabview` | [17-tabview.md](./17-tabview.md) |
| 18 | 键盘 | `keyboard` | [18-keyboard.md](./18-keyboard.md) |
| 19 | 消息框 | `msgbox` | [19-msgbox.md](./19-msgbox.md) |
| 20 | 线条 | `line` | [20-line.md](./20-line.md) |
| 21 | LED | `led` | [21-led.md](./21-led.md) |
| 22 | 动画图片 | `animimg` | [22-animimg.md](./22-animimg.md) |
| 23 | 数字输入框 | `spinbox` | [23-spinbox.md](./23-spinbox.md) |
| 24 | 刻度 | `scale` | [24-scale.md](./24-scale.md) |
| 25 | 二维码 | `qrcode` | [25-qrcode.md](./25-qrcode.md) |
| 26 | 条形码 | `barcode` | [26-barcode.md](./26-barcode.md) |
| 27 | 画布 | `canvas` | [27-canvas.md](./27-canvas.md) |
| 28 | 日历 | `calendar` | [28-calendar.md](./28-calendar.md) |
| 29 | 数字时钟 | `digitalclock` | [29-digitalclock.md](./29-digitalclock.md) |
| 30 | 平铺视图 | `tileview` | [30-tileview.md](./30-tileview.md) |
| 31 | 窗口 | `win` | [31-win.md](./31-win.md) |
| 32 | 菜单 | `menu` | [32-menu.md](./32-menu.md) |
| 33 | 文本组 | `spangroup` | [33-spangroup.md](./33-spangroup.md) |
| 34 | 表格 | `table` | [34-table.md](./34-table.md) |
| 35 | 按钮矩阵 | `buttonmatrix` | [35-buttonmatrix.md](./35-buttonmatrix.md) |
| 36 | 线图 | `linechart` | [36-linechart.md](./36-linechart.md) |
| 37 | 柱状图 | `barchart` | [37-barchart.md](./37-barchart.md) |
| 38 | 散点图 | `scatterchart` | [38-scatterchart.md](./38-scatterchart.md) |
| 39 | 图表 | `chart` | [39-chart.md](./39-chart.md) |

重新生成：`node scripts/split-prop-panel-by-widget.mjs`
