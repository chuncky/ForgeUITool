# 嵌入式 UI 工具软件详细设计说明

> **文档类型：** 软件详细设计（LLD）  
> **产品暂名：** ForgeUI Kit（可替换）  
> **版本：** V1.32  
> **日期：** 2026-08-07  
> **V1.32：** 画布坐标系回归：禁止 `.screen` 子节点 `position:relative` 覆盖控件 `absolute`（否则 left/top 相对文档流，与模拟 `lv_obj_set_pos` 错位）；`.screen-clip` 裁屏外绘制；拖/缩 live 相对父框钳制。§9.7.2。  
> **V1.31：** 控件树拖拽改父 / 可父容器收紧：`moveNode` + `project:moveNode`；`button.isContainer=false`；§9.7.1 / §9.7.3.2 / §9.7.3.5 / §9.10；Core §4.1.3。  
> **V1.30：** §9.8 资源管理对齐 BK（图片\|字体\|多语言）；顶栏多语言并入资源管理。  
> **V1.29：** §9.8 颜色库含色板主题 `colorThemes`（≠ 样式库 `themes`）；见 `颜色库-本产品映射.md`。  
> **V1.28：** §9.7.4 滚动条 chrome 对齐 Beken（6px + ocean-blue 色板；`styles.css` 全局）。  
> **V1.27：** Renderer **禁止** `@forgeui/core` barrel（§2 / 详设 §2）；`vite build` / `npm run release` 门禁。  
> **V1.24：** **FR-016e 收口**：工程资源 `project:assetDataUrl` → 画布真图/真字体；`text_font_size`；按钮文案满宽；§9.7.2 / §9.7.4。禁止未解析相对路径冒充完成。  
> **V1.23：** **FR-016e** 属性→画布 chrome：`buildWidgetCanvasChrome`；按钮契约测试 `designer_button_canvas_chrome.test.ts`；§9.7.2。  
> **V1.22：** **FR-011d** 切页/存档前 `flushPendingEditor` + mutation 队列；EventPanel 仅按选中重置草稿。  
> **V1.21：** **FR-011c** 启动页整行冷青蓝分色 + 立体样式（§9.7.3.1）；禁止页名外框方案。  
> **V1.20：** **FR-016d** 控件属性 ↔ LVGL API：`WidgetSpec.lvglPropApis`；CodeGen 按类型发射专用 `lv_*`（含 spinbox/scale/qrcode/tabview/spinner LVGL9 签名）；测试 `widget_props_lvgl_contract.test.ts`。  
> **V1.19：** **FR-013c** 画布控件右键菜单（与树 ⋯ 同源）；`FloatingPanelMenu` 支持点位；§9.7.2 / §9.7.3.3。漏项说明：原 FR-013b 仅控件树，未覆盖 Beken 画布右键。  
> **V1.18：** 工作区快捷键 **Delete/Backspace** 删除选中控件（FR-012a）；§9.5 / §9.7.4.6。  
> **V1.17：** 画布交互：舞台无滚动条；滚轮缩放；左键拖空白区平移（FR-021b）；§9.7.2。  
> **V1.16：** **画布工作台**详设（需求 V2.18 / FR-021a～d、FR-010g，**全部 P0**）：标尺+屏区高亮、缩放+「视图」、设备框+舞台网格、指针坐标、底栏辅助多 Tab；§9.5 / §9.7.2 / §9.8。  
> **V1.15：** 样式 `bg_image` 须资源库选择（FR-016c）；缺口与方案见属性面板详设 §6.4；§9.7.4.5 补充验收。  
> **V1.14：** **控件属性面板**补充详设 `docs/嵌入式UI工具_控件属性面板详细设计说明.md`（模块架构、动态表单、Style/Event、MVP 差距与 V1 里程碑）；主文档 §3.5.2、§9.7.4 保持契约摘要。  
> **V1.13：** **控件属性面板**详设（§3.5.2、§9.7.4）：对标 Beken 38 控件 + 页面属性；分组（位置/属性/行为/样式）、Part×State、`extraData` 内嵌编辑器；用户手册见 `docs/工具详细说明手册/控件属性面板使用说明.md`。
> **V1.12：** **D-07** 单目录生成物：合并 `generated/`+`user/` 为 `forgeui_generated/`（内嵌 `custom/`），对标 Beken `beken_generated`；见 `docs/生成代码问题/单目录生成物设计方案.md`。
> **V1.11：** **PageTreePanel** 详设（对标 `页面组件库.png`、`组件修改菜单.png`）；Core 增补 duplicate/reorder screen、node order/flags API（FR-011a/b、FR-013a/b）。
> **V1.10：** 移除 Electron 默认系统菜单栏（File/Edit/View/Window/Help）；`Menu.setApplicationMenu(null)`。
> **V1.9：** 工作区顶栏 **ToolbarButton** 契约：图标+名称磁贴；undo/redo icon-only（FR-010f）；映射 `docs/beken界面/工作区顶栏-本产品映射.md`。
> **V1.8：** 顶栏 **项目名称** 可点击打开工程根目录（`tb.projectName` → `shell:openProjectFolder`）。
> **V1.7：** 顶栏新增 **「交付 ▾」**（`tb.deliveryMenu`）；SDK 导出 / UI 包打包迁出 C 语言菜单；项目设置含交付次要入口（FR-010d）。
> **V1.6：** C 语言菜单五步分离；PreviewHost 新增 `buildOnly` / `runOnly`；`cleanOnly` 清理 generated 与预览 out（FR-060d）。
> **V1.4：** 预览非阻塞详设（FR-061a）：禁止 Main 上 `spawnSync` 跑 cmake；`previewStore.busy` + 画布只读；构建日志流式推送 + 节流刷新。
> **V1.3：** 控件库面板详设（对标 `docs/beken界面/组件面板/组件面板.png`）；顶栏/布局与 FR-010a 对齐；WidgetLibrary 与 Outline 解耦；`WidgetSpec.category` 字段。
> **状态：** 草案  
> **结构：** 2026-08-05 起按章拆分为 `docs/软件详细设计/` 分册；本文件为总目录与版本头。  
> **上游：** 《软件概要设计说明》V2.12、《设计需求文档》V2.21、《产品定义书》《立项书》《竞品对比分析报告》  
> **实现蓝本：** 主路径对标 **Beken**（JSON + Handlebars + SDL）；体验对标 SquareLine + Beken 壳；SDK 接入对标 UIBuilder；开源对照 EEZ（不 GPL 换皮、不搬 Wasm）  
> **界面参照：** `docs/beken界面/界面说明.txt`；控件库 `组件面板/控件库面板-本产品映射.md`；顶栏 `工作区顶栏-本产品映射.md`；**页面/组件树** `组件面板/页面组件树-本产品映射.md`；**属性面板** 补充详设 `嵌入式UI工具_控件属性面板详细设计说明.md`、用户手册 `工具详细说明手册/控件属性面板使用说明.md`、`docs/beken界面/属性面板/`  
> **参考材料：** `ref/beken/`、`ref/artinchip/`、`ref/quareline/`、`ref/EEZ Studio/` 分析与重构设计文档  

### 已锁定决策（摘自概要设计）

| ID | 结论 |
|----|------|
| D-01 | 设计器壳：**Electron + Vue3** |
| D-02 | 用户代码：**`<codegenDir>/custom/` 再生成不覆盖**（weak 非默认）；`customSubdir` 默认 `custom` |
| D-07 | 生成物 **单根目录** `forgeui_generated/`（`export.codegenDir`）；**废弃** 根下并列 `generated/`+`user/` |
| D-03 | MVP 首发平台：**qm10xd** |
| D-04 | LVGL 版本线：**仅 1 条 — 9.10**（须与 qm10xd SDK 捆绑版本核对） |
| D-05 | A2：**默认启用**（`deliveryMode=both`；可改 `static_c`） |
| D-06 | 工程：**多文件目录为权威**；单文件仅导出/分享 |

---

## 分册目录

本文档已按章拆分。正文位于 [`docs/软件详细设计/`](./软件详细设计/)。

| 章节 | 文档 |
|------|------|
| §1 | [文档说明](./软件详细设计/01-文档说明.md) |
| §2 | [仓库与包结构](./软件详细设计/02-仓库与包结构.md) |
| §3 | [工程文件系统详设](./软件详细设计/03-工程文件系统详设.md) |
| §4 | [核心模块详细设计](./软件详细设计/04-核心模块详细设计.md) |
| §5 | [CodeGen（A1）详细设计](./软件详细设计/05-CodeGen详细设计.md) |
| §6 | [预览（PreviewHost / SDL）详细设计](./软件详细设计/06-预览详细设计.md) |
| §7 | [Packer / Loader（A2）详细设计](./软件详细设计/07-Packer与Loader详细设计.md) |
| §8 | [SDK 交付适配（原「平台插件」；D-08）](./软件详细设计/08-SDK交付适配.md) |
| §9 | [设计器界面详细设计（Electron + Vue3）](./软件详细设计/09-设计器界面详细设计.md) |
| §10 | [CLI 详细设计](./软件详细设计/10-CLI详细设计.md) |
| §11 | [扩展点 Stub（AR）](./软件详细设计/11-扩展点Stub.md) |
| §12 | [错误码](./软件详细设计/12-错误码.md) |
| §13 | [黄金用例与测试](./软件详细设计/13-黄金用例与测试.md) |
| §14 | [实现里程碑（编码顺序）](./软件详细设计/14-实现里程碑.md) |
| §15 | [与竞品实现的映射（合规）](./软件详细设计/15-与竞品实现的映射.md) |
| §16 | [待详细设计收口（非产品选型）](./软件详细设计/16-待详细设计收口.md) |
| §17 | [修订记录](./软件详细设计/17-修订记录.md) |

---

*引用约定：外部文档仍可写作 `嵌入式UI工具_软件详细设计说明.md` §N；请打开上表对应分册。章节内小节编号（如 §9.7.4）语义保持不变。*
