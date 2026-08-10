# ForgeUI Kit — 实现进度跟踪（Loop 工作区）

> **用途：** `/loop` 持续迭代时每次 tick 先读本文件，完成下一项后更新状态。  
> **依据：** 立项书 M0～M5、详设 §14 M1～M8、需求 FR/AC、控件属性面板详设 V1-A/B/C、MCP 详设 V2。  
> **最后更新：** 2026-08-07（FR-013a：控件树拖拽改父 + button 不可作父）

---

## 总体完成度（估算）

| 里程碑 | 目标 | 状态 | 完成度 |
|--------|------|------|--------|
| M1～M4 | Schema/Core/CodeGen/Preview/Platform | ✅ | 100% |
| M5 | Designer 六区工作台 + 双页事件 | ✅ | 100% |
| M6 | Packer/Loader A2 | ✅ | 100% |
| M7 | xv/xh、Part/State CodeGen、字体 | ✅ | 100%（xv/xh：**仅模板**，不做实机；用户 2026-08-03 确认） |
| M8 | MCP/Wasm/Figma | ✅ | 100% |
| V1-A 属性面板 | 38 控件 + Tab/Part/State/行为 | ✅ | ~95% |
| V1-B 属性面板 | extraData + 全样式 + 资源联动 | ✅ | 100%（缺口队列已清） |
| V1-C 属性面板 | 样式库/锚点/旋转 | ✅ | 100%（含 styleRef + Grid） |
| MVP 门禁 AC-001～007 | 含 qm10xd 板端 | ✅ | ~100%（AC-005 用户已验收；UI-01～09 清单） |

**控件注册：** 38 / 38（100%）

---

## Loop 工作队列（按优先级）

状态：`[ ]` 待做 · `[~]` 进行中 · `[x]` 完成 · `[-]` 阻塞/远期

### P0 — 多页存档丢改（需求 V2.24 / FR-011d）

- [x] 根因：切页未 flush `@change` 输入 + mutation 竞态
- [x] `flushPendingEditor` + `enqueueMutation`；切页/存档/生成前调用
- [x] EventPanel 去掉 deep watch 误重置
- [x] 测试 `designer_multipage_save.test.ts` + 文档

### P0 — 启动页视觉（需求 V2.23 / FR-011c）

- [x] 文档：需求 FR-011c / 详设 §9.7.3.1 / 概要 / 映射表
- [x] `PageTreePanel`：启动页整行冷青蓝分色 + 立体样式（禁止页名外框；色系对齐 `--accent`）
- [x] 回归测试 `designer_page_tree.test.ts`

### P0 — 控件属性 ↔ LVGL（需求 V2.22 / FR-016d）

- [x] 审计 `widgets.ts`：各控件专用 PropSpec + `lvglPropApis`
- [x] CodeGen `emitWidgetCreate` 对齐 LVGL 9（含 spinner/tabview/spinbox/scale/qrcode 等）
- [x] SET_PROP 补充常用专用 setter
- [x] JSON runtime 同步 spinner/tabview/barcode 签名
- [x] 契约测试 `tests/widget_props_lvgl_contract.test.ts`
- [x] 需求/详设/概要文档同步

### P0 — 属性 → 画布 chrome（需求 V2.26 / FR-016e 收口）

- [x] 文档：需求 V2.26（FR-016e-a/b/c）、详设 V1.24、属性面板详设 §6.5、概要 V2.15、手册按钮画布表
- [x] IPC `project:assetDataUrl` + preload；路径锁在工程根（`asset-data-url.mjs`）
- [x] Renderer 缓存 + chrome 仅用已解析 data URL；禁止裸 `assets/…` url
- [x] `text_font_size` 样式字段 + 画布 `fontSize`；`text_font` → `@font-face`
- [x] 按钮 `.btn-label` 满宽；image `props.src` 真图
- [x] 测试：`designer_canvas_asset_url` + 收紧 `designer_button_canvas_chrome`（bg 须 `data:image/`）21/21
- [x] BK 逐项显示契约：`button-prop-display-contract.ts` + `designer_button_prop_display_bk.test.ts`（38 属性项 it.each，51 用例）
- [x] 按钮补 `long_mode`（对标 BK）+ 画布 white-space / CodeGen `lv_label_set_long_mode`
- [x] **V1.6e：** 按钮子 label `LV_PCT(100)`；`text_font`+`text_font_size` 进 CodeGen；画布默认 14 / WRAP 裁切；`codegen_long_mode_bk` + 扩展 `codegen_style_text_font`

### P0 — MVP 发布门禁

- [x] AC-001/003 GUI 手工验收清单 UI-01～09（`docs/MVP_GUI_ACCEPTANCE_UI-01-08.md` + 设计器文档页）
- [x] AC-005 qm10xd 板端首屏实机验收（用户确认完成；清单 `docs/AC-005_BOARD_BRINGUP.md`）
- [x] FR-012 控件库拖拽入画布
- [x] FR-040 图片导入 assets（基础）

### P0 — 画布工作台（需求 V2.18，基本要求）

- [x] FR-021c：舞台网格（默认开）+ 设备框观感强化
- [x] FR-021b：画布缩放 % / 适应窗口 +「视图」菜单
- [x] FR-021a：标尺 + 屏区高亮
- [x] FR-021d：指针坐标（默认开）
- [x] FR-010g：底栏 Tab（日志 / 资源 / 配置）；事件不迁出右栏

### P1 — V1-A 控件与属性（详设 §10.1）

- [x] DynamicPropForm / StyleGroup / BehaviorGroup / InspectorPanel Tab
- [x] 扩展控件 list/roller/imagebutton/spinner/tabview/keyboard/msgbox/line/led/animimg
- [x] 补全 V1-A 剩余控件（Loop#2 + Loop#3）
- [x] 注册表 38 控件（对标用户手册 §5.0 / Beken component-specs）

### P1 — V1-B extraData 与样式（详设 §10.2）

- [x] extraData 字段 + Core mutate + Schema
- [x] ExtraDataEditor 插件（items / tabs / buttons / series / cells / keymap / frames）
- [x] 样式子组（背景/字体/边框/阴影/内边距）
- [x] AssetsDialog ↔ imageSrc
- [x] 样式库 FR-018（StyleGroup 保存/应用 + project.themes）
- [x] 颜色库 FR-018 + 顶栏启用（ColorLibraryDialog + @id 引用）

### P1 — M6/M7 交付与平台

- [x] Packer 实装（manifest + ui/ + assets/ + sha256 + fonts/subsets.json charset sidecar）
- [x] Loader 参考实现 AC-010～012（ReferenceLoader + C 桩 manifest/布局/分辨率校验）
- [x] qm10xv / qm10xh 平台模板 FR-007（插件 + boards/HELLO.md；**实机验收不做**，用户确认仅模板）
- [x] Part/State → CodeGen lv_obj_set_style 映射表（style-emit.ts）
- [x] 字体裁剪 FR-041（collectProjectGlyphs + generate 写 charset/stub；AssetsDialog 导入 TTF）

### P1 — 设计器补齐

- [x] FR-004 历史版本 `.forge/history/`（存档自动快照 + HistoryDialog 恢复）
- [x] FR-013b 六向对齐（多选 Ctrl+点击；控件 ⋯ 菜单）
- [x] FR-013a 控件树拖拽排序/改父（`moveNode` + `project:moveNode`；`ComponentTreeNode` HTML5 DnD）
- [x] 可父容器收紧：`button.isContainer=false`；面板/MCP/`addChildNode` 同源（仅 screen/container/tabview/tileview/win/menu）
- [x] FR-019 自定义控件 Tab（`project.customWidgets[]` + 树菜单另存 + 库 Tab 拖入）
- [x] 工程内 .forgeui 导入（IPC unbundle + Home/WorkspaceGate 入口）

### P2 — M8 / V2

- [x] MCP stdio Server + HTTP Bridge（`forgeui-mcp-server` + Designer `127.0.0.1:39201`）
- [x] forgeui_batch_update 写工具 + 事务 UI（`batch-update.ts` + Bridge 内存写 + AiTransactionBar）
- [x] Wasm 预览后端（`WasmBackend` + IR shell 多页/旋转 + `forge-bridge.ts`；Emscripten 可选）
- [x] AI 设计面板（`.forge-ai` 工作区 + Bridge 状态 + MCP 配置复制）
- [x] Figma 导入器（`forgeui-figma` JSON 适配 → 自有 screens + Designer 入口）
- [x] MCP 截图 + 图片导入（`forgeui_get_page_screenshot` wireframe PNG + `forgeui_create_image_asset`）

### P2 — V1-C 体验

- [x] LayoutGroup 3×3 锚点格（`frame.anchorX/Y` + `reanchorFrame`）
- [x] 旋转 / layout_type（`frame.rotation` + 容器 `props.layout_type`）
- [x] Tab 键盘焦点顺序（ARIA tablist + 方向键/Home/End + inactive `inert`）

### P1 — Post-MVP / D-07 生成物补齐

- [x] `custom/custom_func.h` + `custom_func.c`（首次创建、不覆盖用户区）
- [x] `image/` C 数组桩 + `image` 控件 `lv_image_set_src` 绑定（`imageMode: c_array`）
- [x] PNG → 真实 C 数组嵌入（内置 PNG 解码 → LVGL ARGB8888；非 PNG/失败时回退 stub）
- [x] `imagebutton` 双态图 + `animimg` frames 与 `image/` 联动
- [x] C Loader `forge_loader_apply` 实装（校验 assets/screens + weak `ui_init`/`ui_nav_load_screen`）
- [x] Emscripten 全 LVGL Wasm 预览（`wasm-emcc.ts` + emcmake 构建；失败/无工具链回退 IR shell）

### P1 — V1-C / M7 深化（Loop#49+）

- [x] `frame.rotation` → CodeGen `lv_obj_set_style_transform_rotation`（0.1° 单位 + 中心 pivot）
- [x] 容器 `layout_type` flex_row/column → LVGL flex 布局 CodeGen
- [x] 样式 `bg_image` → CodeGen + `image/` 联动
- [x] CodeGen 图片去重（`collectImageAssets` 按 path 唯一；同路径只 emit 一份 C）

### P1 — V1-B CodeGen 深化（Loop#52+）

- [x] `list` / `dropdown` extraData.items → `lv_list_add_text` / `lv_dropdown_set_options`
- [x] `tabview` extraData.tabs → `lv_tabview_add_tab` + `selectedTabIndex`
- [x] `buttonmatrix` extraData.items → `lv_buttonmatrix_set_map`（按 col_cnt 换行）
- [x] `table` extraData.cells → `lv_table_set_cell_value`
- [x] `chart` extraData.series → 序列数据 CodeGen
- [x] `keyboard` extraData.rows → `lv_keyboard_set_map`
- [x] `msgbox` extraData.buttons → `lv_msgbox_add_footer_button`

### P1 — M6 JSON 运行时 Loader（Loop#56+）

- [x] TypeScript `JsonRuntimeLoader.apply` — 校验 A2 包 + 解析 `ui/screens/*.json` 为运行时树
- [x] C `forge_loader_open_mem` 内存包格式
- [x] C JSON→LVGL 动态建树（widget 子集：label/button/container + `forge_loader_apply_json`）

### P1 — M6 / M7 深化（Loop#59+）

- [x] C JSON runtime 嵌套 container children 递归解析/建树
- [x] M7：`text_letter_space` / `text_line_space` → CodeGen
- [x] V1-C：屏幕根 `frame.rotation` → CodeGen transform_rotation

### P1 — M6 / M7 深化（Loop#60+）

- [x] C JSON runtime 扩展 widget：slider / switch / image
- [x] C JSON runtime 扩展 widget：checkbox / bar
- [x] C JSON runtime 扩展 widget：dropdown / list（extraData.items）
- [x] C JSON runtime 扩展 widget：led / spinner
- [x] C JSON runtime 扩展 widget：roller / arc
- [x] C JSON runtime 扩展 widget：textarea / line

### P1 — M7 深化（Loop#66+）

- [x] Part 映射扩展（tabbaritem/series/selected/cursor 等 → LVGL PART）
- [x] `roller` extraData.items → `lv_roller_set_options` CodeGen

### P1 — M7 深化（Loop#67+）

- [x] `text_align` → CodeGen + 属性面板字体子组 enum 字段

---

## Loop 运行说明

### 方式 A — 终端 tick（需 Chat 配合）

- **脚本：** `scripts\forgeui-loop.ps1 -IntervalSec 60`
- **行为：** 每隔 N 秒打印 `AGENT_LOOP_WAKE_FORGEUI {"prompt":"..."}` — **不会自动写代码**
- **限制：** Cursor Agent **不会**自动读取终端输出；须以下之一：
  1. 在 Chat 中说「继续 loop」（推荐，最稳）
  2. 让 Agent 用 **Monitored Shell + notify_on_output** 监听 `AGENT_LOOP_WAKE_FORGEUI`
  3. 使用 **Cursor Automations / Cloud Agent** 做真正无人值守（见 Automations 技能）

### 方式 B — 纯 Chat 驱动（当前默认）

- 每次说「继续 loop」→ Agent 读 `IMPLEMENTATION_PROGRESS.md` → 做下一项 → 更新文档
- 不依赖终端脚本；适合本机开发

**停止终端 loop：** Terminals 面板 → Ctrl+C

---

## 每轮 Loop 检查清单

1. 读本文件，取 **第一个** `[ ]` 或 `[~]` 的 P0/P1 项（硬件阻塞项跳过并标注）
2. 实现 + `npm test` + `npm run build`
3. 更新本文件对应项为 `[x]` 并刷新「总体完成度」
4. 同步更新相关设计文档版本记录（属性面板详设 §9 差距表、详设 §14 备注等）
5. 若 P0/P1 完成，继续 **Post-MVP / D-07** 队列
6. **收工停 loop：** 若已无任何可执行 `[ ]` / `[~]`（仅剩 `[-]` 暂缓），则：
   - 写入本文件「队列状态」为 idle / done
   - **停止** `scripts/forgeui-loop.ps1`（杀进程；脚本也会在下一 tick 自检退出）
   - **不要** 再 arm 下一轮 wake / heartbeat

### P2 — M8 收尾（Loop#85+）

- [x] MCP `batch_get` 全量：`get_editor_state` + `get_page_screenshot` 别名（§5.3 读路径 100%）
- [x] M5 Designer 工作台标记完成（六区 + Inspector + 历史/对齐/自定义控件等 P1 项均已 `[x]`）

### P2 — M8 收尾（Loop#84+）

- [x] MCP `batch_get` 扩展：`get_widget_spec` / `list_event_*` / `list_events`

### P2 — M8 收尾（Loop#83+）

- [x] MCP `batch_get` 扩展：`get_node` / `list_widget_types` / `list_assets`

### P2 — M8 收尾（Loop#82+）

- [x] MCP `forgeui_ping` 实装：包版本 + toolCount（去除 0.1.0-stub）

### P1 — M6/V1-C runtime 深化（Loop#81+）

- [x] C JSON runtime 容器 `layout_type` flex_row/column → LV_LAYOUT_FLEX + flex_flow

### P1 — M6/V1-C runtime 深化（Loop#80+）

- [x] C JSON runtime `frame.rotation` → transform pivot + rotation（0.1° 单位，与 CodeGen 一致）

### P1 — M6 runtime 深化（Loop#79+）

- [x] C JSON runtime chart **extraData.series** → `lv_chart_add_series` + `lv_chart_set_series_values`

### P1 — M6 runtime 深化（Loop#78+）

- [x] C JSON runtime 图片绑定：`props.src` → `lv_image_set_src`；imagebutton 双态；style `bg_image` → bg_image_src

### P1 — M6/M7 runtime 深化（Loop#77+）

- [x] C JSON runtime 样式：opacity（bg/text/border/shadow）+ text_letter/line_space

### P1 — M6 JSON runtime 深化（Loop#76+）

- [x] C JSON runtime 扩展 main/default 样式：radius、border、padding、shadow

### P1 — M6 JSON 运行时 Loader（Loop#75+）

- [x] C JSON runtime 补全剩余 11 控件（spinbox/canvas/qrcode/barcode/digitalclock/tileview/win/menu/spangroup/scale/calendar）→ **37/37 全量**

### P1 — M6 JSON 运行时 Loader（Loop#74+）

- [x] C JSON runtime 扩展 widget：**table**（row/col + cells）/ **chart** 系列（line/bar/scatter + point_count）

### P1 — M6 JSON 运行时 Loader（Loop#73+）

- [x] C JSON runtime 扩展 widget：**keyboard**（mode）/ **msgbox**（title/text + footer buttons）

### P1 — M6 JSON 运行时 Loader（Loop#72+）

- [x] C JSON runtime 扩展 widget：**tabview**（extraData.tabs + selectedTabIndex）/ **buttonmatrix**（items map + col_cnt）

### P1 — M6 JSON 运行时 Loader（Loop#71+）

- [x] C JSON runtime 扩展 widget：**imagebutton** / **animimg**

### P1 — M6 JSON 运行时 Loader（Loop#69+）

- [x] C JSON runtime：`style.main.default` 解析 + LVGL 样式应用（text_color/bg_color/text_align/text_font stub）

### P1 — M7 深化（Loop#68+）

- [x] M7：`text_font` 样式 → CodeGen `lv_obj_set_style_text_font` + screen font `#include` + 设计器 fontRef 字段

### P1 — M7 收尾（Loop#99+）

- [x] M7：`lv_font_conv` 管线强化（TTF 魔数校验、`npx -p lv_font_conv`、`.h` 生成、C 符号 alias）

### P1 — M7 收尾（Loop#98+）

- [x] M7：`text_decor` 样式 → CodeGen + 设计器 + C JSON runtime

### Post-MVP 维护（Loop#97+）

- [x] C JSON runtime：`cursor` / `series` Part 样式（spinbox/chart 等）

### Post-MVP 维护（Loop#159+）

- [x] C JSON runtime：`main`/`items` Part **checked/pressed/focused/disabled** State 样式（与 CodeGen 五态对齐）
- [x] FR-058 CLI validate 接线测试 + 设计器 production `vite build` 修复

### Post-MVP 维护（Loop#96+）

- [x] C JSON runtime：`selected` Part + `checked` State 样式（main/items）

### Post-MVP 维护（Loop#95+）

- [x] C JSON runtime：`items` / `scrollbar` Part 样式（含 main_list/scrollbar_list 别名）

### Post-MVP 维护（Loop#94+）

- [x] C JSON runtime：`knob` Part 样式（default/pressed bg_color/bg_opacity/radius）

### Post-MVP 维护（Loop#93+）

- [x] C JSON runtime：`indicator` Part 样式（default/pressed bg_color/bg_opacity/radius）

### Post-MVP 维护（Loop#92+）

- [x] M7：outline 样式（width/color/opacity）→ CodeGen + 设计器 + C JSON runtime

### Post-MVP 维护（Loop#91+）

- [x] C JSON runtime：keyboard `extraData.rows` → `lv_keyboard_set_map` + LV_SYMBOL 解析

### Post-MVP 维护（Loop#90+）

- [x] C JSON runtime：animimg `extraData.frames` → `lv_animimg_set_src` + repeat/start

### Post-MVP 维护（Loop#89+）

- [x] M7 CodeGen：spangroup `extraData.items` → `lv_spangroup_add_span` + `lv_span_set_text`

### Post-MVP 维护（Loop#88+）

- [x] C JSON runtime：spangroup `extraData.items` → `lv_spangroup_add_span` + `lv_span_set_text`

### Post-MVP 维护（Loop#87+）

- [x] C JSON runtime：line 子组样式（line_color/width/opacity）

### Post-MVP 维护（Loop#86+）

- [x] C JSON runtime：`clip_corner` 样式解析与应用

### Loop#100 里程碑（2026-08-03）

- [x] 全量测试 **234/234** 通过（Vitest）
- [x] M6 JSON runtime：37 widget + 全 Part/State 样式子集
- [x] M7：Part/State CodeGen + lv_font_conv 管线 + 样式键补齐
- [x] M8 / MVP AC：100%

### 维护 tick（Loop#103）

- [x] Core `validate.ts`：Ajv 类型补全 `addSchema`；`@forgeui/core` + `@forgeui/codegen` build 均通过

### 维护 tick（Loop#101–102）

- [x] CodeGen `tsc` 构建修复：`image-emit` diagnostic `warning`；`@forgeui/codegen` build 通过

### Loop#120 里程碑（2026-08-03）

- [x] 全量测试 **235/235** 通过（Vitest，较 Loop#100 +1）
- [x] Loop#100–119 维护期：四轮轮换冒烟均稳定
- [x] 构建链 / M6–M8 / MVP AC 无回归

### Loop#140 里程碑（2026-08-03）

- [x] 全量测试 **235/235** 通过（Vitest，与 Loop#120 持平）
- [x] Loop#120–139 维护期：四轮轮换冒烟均稳定
- [x] 构建链 / M6–M8 / MVP AC 无回归

### 队列状态（Loop#180）

FR-042 深化：画布按 `previewLocale` 换文 + 属性面板 i18n 键 + 顶栏预览语言切换；JSON+extraData 冒烟 **9/9**。

### 队列状态（Loop#179）

空闲 tick；M7 样式/字体冒烟 **6/6** 通过。

### 队列状态（Loop#178）

空闲 tick；G-01/G-02 黄金路径冒烟 **6/6** 通过。

### 队列状态（Loop#177）

空闲 tick；M6 packer + MCP 冒烟 **17/17** 通过（含 Loop#173～176 轮换：G-01/G-02、M7、JSON+extraData、i18n/anim CodeGen 均绿）。

### 队列状态（Loop#172）

V2 启动：FR-042/043 i18n+XLIFF、FR-071 动画时间轴首版落地（Core/Schema/设计器/CodeGen）。

### 队列状态（Loop#171）

空闲 tick；JSON runtime + extraData CodeGen 冒烟 **9/9** 通过。P1 收尾已清；FR-070 暂缓。

### 队列状态（Loop#170）

空闲 tick；M7 样式/字体冒烟 **6/6** 通过。

### 队列状态（Loop#169）

空闲 tick；G-01/G-02 黄金路径冒烟 **6/6** 通过。

### 队列状态（Loop#168）

空闲 tick；M6 packer + MCP 冒烟 **17/17** 通过。

### 队列状态（Loop#167）

空闲 tick；JSON runtime + extraData CodeGen 冒烟 **9/9** 通过（含 Loop#165 G-01/G-02 **6/6**、Loop#166 M7 样式/字体 **6/6**）。

### 队列状态（Loop#164）

P1 收尾：**lv_font_conv E2E** 修复（移除无效 `--lvgl-version`；`-r 0x20-0x7E` 替代 `--symbols` 避免 Windows shell 转义）；`tests/font_conv_e2e.test.ts` 通过。全量 **239/239**。

### 队列状态（Loop#163）

空闲 tick；M6 packer + MCP 冒烟 **17/17** 通过。

### 队列状态（Loop#162）

空闲 tick；JSON runtime + extraData CodeGen 冒烟 **9/9** 通过（含 Loop#160 G-01/G-02 **6/6**、Loop#161 M7 样式/字体 **6/6**）。

### 队列状态（Loop#159）

P1 收尾：C JSON runtime main/items **checked/pressed/focused/disabled** State 样式；设计器 production `vite build` 修复；FR-058 CLI validate 接线测试。全量 **238/238** 通过。

### P1/P2 收尾队列（Loop#159+）

- [x] C JSON runtime：`main`/`items` Part 下 **checked/pressed/focused/disabled** State 样式（与 CodeGen 对齐）
- [x] 设计器 production build：移除 renderer 对 `@forgeui/core` barrel 别名（避免 validate.ts Node 依赖）
- [x] FR-058：`forgeui validate` CLI 接线测试（`tests/cli_validate.test.ts`）
- [x] M7：真实 TTF → `lv_font_conv` E2E 生成 `.h`（`font_conv_e2e.test.ts`；Windows 系统字体 / `FORGEUI_TEST_TTF` / fixture）
- [x] 设计器 dev 空白窗：Electron 重连 Vite + wasm-emcc 构建修复（用户已重启 `dev:designer` 验证通过）
- [-] FR-070：macOS / Linux 打包与 CI 矩阵（P2，用户决定暂缓）
- [x] FR-042/043：i18n 模型 + XLIFF 导入导出 + 设计器对话框 + CodeGen `ui_i18n.*`（首版）
- [x] FR-071：动画时间轴模型 + 设计器编辑器 + CodeGen `ui_anim.*`（首版；目标绑定后续深化）
- [-] FR-075：CLI UI 截图对比（P3 远期）

### 文档对照缺口（2026-08-03，对照需求/详设/概要/立项/产品/属性面板/MCP/竞品）

> 依据：设计需求 FR/AC、详设、概要、立项/产品定义、控件属性面板详设差距表、MCP 详设、竞品差异化。Loop 取第一个 `[ ]`。

#### 总体快照

| 范围 | 状态 |
|------|------|
| MVP 门禁 AC-001～007 | ✅ |
| M1～M6、M8 | ✅ |
| M7 / V1-A/B/C | ✅ M7 完成；V1-A/B/C ✅（属性面板缺口队列已清） |
| V2 差异化 | ✅ 本批活跃队列 + 深化项已清（暂缓项除外） |

#### 部分完成（建议优先补齐）

- [x] FR-042 深化：画布/属性按 `previewLocale` 实时换文；文本 props 旁 i18n 键入口
- [x] FR-034：事件面板 + CodeGen 完整发射 `SWITCH_LANGUAGE`（`ui.c` → `ui_i18n_set_language`；需工程启用 i18n）
- [x] FR-071 深化：`ui_anim` 中 `nodeId` → 真实 `lv_obj_t*` 绑定；设计器播放预览
- [x] FR-043 深化：XLIFF 翻译进度/工作流（首版导入导出已有）
- [x] FR-064/065：Wasm 真 LVGL 嵌入预览与 SDL 黄金双跑（现有 IR shell / 可选 emcc）
- [x] FR-063：常驻仿真热替换 generated
- [-] FR-007 xv/xh：板端实机验收（**用户确认不做**；插件 + `boards/HELLO.md` 模板已交付；MVP 以 qm10xd AC-005 为准）
- [x] V1 属性面板 polish：分组折叠动画、控件类型图标（属性面板详设 §9）
- [x] MCP：`switch_language` / 时间轴动作；可选 Bridge token（MCP 详设后置项）
- [x] FR-057：生成文件清单与孤儿清理策略补全
- [x] FR-032：SET_PROP 动作设计器体验补齐
- [x] FR-036 深化：可拖拽逻辑图画布（当前只读列表）
- [x] FR-086 深化：装载结果可视化到画布（现已 JsonRuntime 校验装载）
#### V2 活跃队列（用户指定必须做完 — Loop#181+）

> 原先标为远期是因为 MVP/立项门禁优先；现已全部升为活跃并完成首版落地。Loop 下一优先：本队列「深化」项 + 上方「部分完成」。

- [x] FR-020：设计器 UI 中英切换（`ui-locale.ts` + 顶栏切换）
- [x] FR-035：事件-动作表变量读写增强（`SET_VAR`/`TOGGLE_VAR` + `ui_vars.*` + CodeGen 回调）
- [x] FR-036 / AR-050：逻辑图画布（可拖拽节点 + SVG 连线；事件仍只存工程模型）
- [x] FR-055：MicroPython 导出（`export.micropython` → `micropython/ui.py`）
- [x] FR-056：weak 符号事件桩（`export.eventStubStyle: weak|custom`）
- [x] FR-076：内存估算 / 多分辨率 Target（对话框 + `project.targets`）
- [x] FR-086：PC 用同一 UI 包装载预览（`tool:packPreview` → JsonRuntimeLoader → 画布只读叠加）
- [x] FR-090～093 / AC-013：包内 `package-logic.json` 白名单；`CALL_FUNCTION` 固件侧

**深化仍开：** 无（V1-B/C 缺口已清）；暂缓项见下方。

#### V1-B / V1-C 属性面板缺口（2026-08-03 对照详设 §6/§9/§10 + 手册 + 主详设 FR-017/018）

> **已对齐（不再列入）：** 38 控件注册、extraData 七类编辑器、Part/State、样式子组主体、样式库保存/应用拷贝、颜色库 @id、资源/imageSrc、锚点/旋转/flex、Tab 焦点、分组折叠动画与类型图标。  
> **Loop 取第一个 `[ ]`。**

##### V1-B（样式全量 + 行为落地）

- [x] V1-B：背景渐变 `bg_grad_dir`（+ `bg_grad_color`）→ StyleGroup + CodeGen `lv_obj_set_style_bg_grad_*`
- [x] V1-B：Image 专用样式 `img_recolor` / `img_opa` → 图片子组（image / imagebutton）+ CodeGen
- [x] V1-B：`props.lvgl_flags` → CodeGen `lv_obj_add_flag` / `clear_flag`（行为配置目前只写 JSON）
- [x] V1-B：`preview_state` → 画布按 STATE 预览样式（pressed/focused/disabled/checked）
- [x] V1-B：样式子组「眼睛」开关（手册 §2.3：子组是否参与渲染；需可序列化标记）
- [x] V1-B：`text_font` 从字体资源库选择（现为纯文本 fontRef；对标 AssetsDialog 图片选择）
- [x] V1-B：属性面板结构冒烟对照 `docs/beken界面/属性面板/`（关键分组/字段存在性测试，非像素 diff）

##### V1-C（主题引用深化）

- [x] V1-C / FR-018：节点持久 `styleRef`（主题变更可联动；当前「应用」仅为 props 拷贝）
- [x] V1-C：容器 `layout_type` 补 Grid（现仅 flex_row / flex_column；手册有布局类型扩展）

##### 明确不做 / 另册

- [-] 多语言 props 面板（详设 §9 → **V2**，已有 i18n 对话框）
- [-] FR-007 xv/xh 实机（用户确认仅模板）

#### 暂缓 / 仍远期

- [-] FR-007 xv/xh 板端实机（**明确不做**；仅保留模板交付）
- [-] FR-070：macOS / Linux 打包与 CI（**暂缓**）
- [-] FR-044：视频等高级媒体（P3）
- [-] FR-074：Online 只读/轻编辑（P3）
- [-] FR-075：CLI UI 截图对比（P3）
- [-] 竞品后置：Subjects 绑定、Online Viewer、多 Target 资源规划

### 队列状态（Loop#221）

画布工作台 P0（FR-021a～d、FR-010g）已落地。主队列无 `[ ]`（仅暂缓项）。

#### P0 — 画布工作台（需求 V2.18）

- [x] FR-021c：舞台网格（默认开）+ 设备框观感强化
- [x] FR-021b：画布缩放 % / 适应窗口 +「视图」菜单
- [x] FR-021a：标尺 + 屏区高亮
- [x] FR-021d：指针坐标（默认开）
- [x] FR-010g：底栏 Tab（日志 / 资源 / 配置）；事件不迁出右栏

---

## 变更日志

| 日期 | Loop# | 内容 |
|------|-------|------|
| 2026-08-06 | — | V1.32：设置页对齐 BK（四分类/工作台偏好/AI 自动检测无开关）；项目设置 Tab+i18n |
| 2026-08-06 | — | V1.31：AI设计对齐 BK（顶栏下拉/Cursor 一键 MCP+Skill/Skill 包） |
| 2026-08-06 | — | V1.30：资源管理三 Tab（图/字/多语言并入）+ 删除/引用计数；顶栏去独立多语言 |
| 2026-08-06 | — | V1.29：颜色库对齐 BK（颜色\|主题双 Tab + colorThemes 色板）；样式库保持独立 |
| 2026-08-07 | — | V1.32：画布坐标回归（去掉 screen 子节点 position:relative；screen-clip 裁屏外；拖/缩相对父框钳制） |
| 2026-08-07 | — | FR-013a：控件树拖拽改父/`moveNode`；`button.isContainer=false`；文档需求 V2.27 / 详设 V1.31 / MCP V1.2 / 映射表 / 03-button / 手册 §5.1 |
| 2026-08-06 | — | V1.28：全局细滚动条对齐 BK（6px / `#7a8a9e`）；`styles.css` + `designer_scrollbar_chrome` |
| 2026-08-06 | — | 修复 release：`canvas-chrome` 禁 barrel 改 `@forgeui/core/widgets`；详设 V1.27 §2；`designer_renderer_core_imports` |
| 2026-08-06 | — | V1.6k：`WidgetSpec.defaultStyle` 种子 + mutate/画布回退；详设 §5.4 + 分册 JSON/手册同步 |
| 2026-08-06 | — | CodeGen long_mode：改用产品 LVGL `LV_LABEL_LONG_*`（修复预览编译 C2065） |
| 2026-08-06 | — | V1.6j：旋转锚点补箭头图示（避免仅实心点无语义） |
| 2026-08-06 | — | V1.6i：对齐 BK selection 分层（外壳不裁切 + z-index）；修复手柄被 overflow 裁切 |
| 2026-08-05 | — | V1.6h：缩放手柄纯色；画布旋转锚点（顶边圆柄绕中心） |
| 2026-08-05 | — | V1.6g：画布选中 8 向缩放手柄（对标 Beken 四角+四边） |
| 2026-08-05 | — | V1.6f：画布默认 Montserrat + LVGL montserrat 行高（14→16），修正字号/文本框比例 |
| 2026-08-05 | — | V1.6e：long_mode 画布+模拟（按钮 `LV_PCT(100)`）；字号进 CodeGen（对标 BK）；文档 04-label/03-button/手册/属性面板详设/FR-016e-b |
| 2026-08-04 | — | BK 标签视图 43 属性项逐项画布可用：`tabview-chrome` + `designer_tabview_prop_display_bk`（48 用例） |
| 2026-08-04 | — | 修复预览链接：属性选背景图/字体后 `image/*.c`+`fonts/*.c` 未进 cmake GLOB；显式列表 + configure fingerprint；`codegen_asset_link_preview` 测试；E:/test01/001 预览链接通过 |
| 2026-08-04 | — | BK 按钮 38 属性项逐项画布可用测试 `designer_button_prop_display_bk`；补 long_mode |
| 2026-08-04 | — | FR-016e 收口落地：`assetDataUrl` 真图、字号、font-face、按钮满宽；测试 21/21；文档 V2.26/V1.24/§6.5 |
| 2026-08-04 | — | FR-016e 收口文档：需求 V2.26（真图/字号硬验收）、详设 V1.24、属性面板 §6.5；开始 `assetDataUrl` 实现 |
| 2026-08-04 | — | FR-016e：属性→画布 chrome（`canvas-chrome.ts` + `WidgetView`）；按钮全字段契约测试；需求 V2.25 / 详设 V1.23 |
| 2026-08-03 | 224 | FR-013c：画布控件右键菜单与树 ⋯ 同源；`WidgetContextMenu` + `widget-menu.ts`；需求 V2.21 / 详设 V1.19（补 Beken 画布漏项） |
| 2026-08-03 | 223 | FR-012a：Delete/Backspace 删除选中控件；`keyboard.ts` + DesignerWorkbench；`designer_delete_key` 测试；需求 V2.20 / 详设 V1.18 |
| 2026-08-03 | 222 | 画布交互：无滚动条；滚轮缩放；左键拖空白区平移（需求 V2.19 / FR-021b）；文档详设 V1.17 / 概要 V2.10 |
| 2026-08-03 | 221 | 画布工作台 P0：标尺/网格/缩放+视图/指针坐标/底栏 Tab；`canvasView` + `BottomAuxPanel`；`designer_canvas_workbench` 测试 |
| 2026-08-03 | — | 设计文档同步需求 V2.18：详设 V1.16、概要 V2.9、产品定义 V1.3、立项书 V1.3、竞品报告 §4.2.2 |
| 2026-08-03 | — | 需求 V2.18：画布工作台五项全部升为 **P0 必达**（标尺/设备框网格/缩放视图/指针坐标/底栏 Tab） |
| 2026-08-03 | 219 | FR-016c：StyleGroup `bg_image`/`imageSrc` → 资源库「库」+ 下拉；`designer_style_image_pick` 测试 |
| 2026-08-03 | — | 文档：FR-016c 样式 `bg_image` 资源库选择缺口与方案；更新 8 份设计文档；**待确认后实现** |
| 2026-08-03 | 218 | 队列清空 → 停止 forgeui-loop；脚本支持无 `[ ]` 时自动 STOP |
| 2026-08-03 | 217 | idle：无 `[ ]`；队列已清，仅暂缓项 |
| 2026-08-03 | 216 | V1-C：容器 `layout_type=grid` → LayoutGroup + CodeGen `LV_LAYOUT_GRID` + JSON runtime |
| 2026-08-03 | 215 | V1-C/FR-018：节点 `styleRef` 持久链接；themes 更新联动；IR 合并主题样式 |
| 2026-08-03 | 214 | V1-B：属性面板 Beken/手册结构冒烟（分组标题、样式子组、38 控件、截图目录） |
| 2026-08-03 | 213 | V1-B：`text_font` 字体库选择（AssetsDialog 拾取 + StyleGroup 下拉，写入 `@fontId`） |
| 2026-08-03 | 212 | V1-B：样式子组眼睛开关 → `disabledSubgroups` 序列化；CodeGen/画布跳过禁用子组键 |
| 2026-08-03 | 211 | V1-B：`preview_state` → 画布合并 `main[state]` 样式预览（`resolveCanvasStyleProps`） |
| 2026-08-03 | 210 | V1-B：`props.lvgl_flags` → CodeGen `lv_obj_add_flag`/`clear_flag`（仅当字段为数组时） |
| 2026-08-03 | 209 | V1-B：Image 子组 `img_recolor`/`img_opa` + CodeGen `lv_obj_set_style_image_*` |
| 2026-08-03 | 208 | V1-B：背景渐变 `bg_grad_dir`/`bg_grad_color` → StyleGroup + `lv_obj_set_style_bg_grad_*` |
| 2026-08-03 | 207 | 对照属性面板详设重扫 V1-B/C：写入 9 项可执行缺口队列（渐变/Image 样式/flags CodeGen/preview_state/眼睛开关/字体库选/beken 结构冒烟/styleRef/Grid） |
| 2026-08-03 | 206 | M7 闭合：xv/xh 仅模板不做实机（用户确认）；总表 M7 → ✅ 100% |
| 2026-08-03 | 204 | 空闲 tick：M6 packer + MCP 冒烟 21/21 |
| 2026-08-03 | 203 | 空闲 tick：i18n/anim 冒烟 7/7 |
| 2026-08-03 | 202 | 空闲 tick：JSON runtime + extraData 冒烟 16/16 |
| 2026-08-03 | 201 | 空闲 tick：M7 样式/字体冒烟 8/8 |
| 2026-08-03 | 200 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 |
| 2026-08-03 | 199 | 空闲 tick：M6 packer + MCP 冒烟 21/21 |
| 2026-08-03 | 198 | 空闲 tick：i18n/anim 冒烟 7/7 |
| 2026-08-03 | 197 | 空闲 tick：JSON runtime + extraData 冒烟 16/16 |
| 2026-08-03 | 196 | 空闲 tick：M7 样式/字体冒烟 8/8 |
| 2026-08-03 | 195 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 |
| 2026-08-03 | 194 | 空闲 tick：M6 packer + JsonRuntime + MCP 冒烟 26/26 |
| 2026-08-03 | 193 | 空闲 tick：V2 深化队列已清；FR-032/036/086/057 + V2 batch + D-08 回归 10/10 |
| 2026-08-03 | 192 | FR-086 深化：packPreview 返回运行时屏树 → 画布只读叠加；修复 widgetCount；`summarizePackRuntime` |
| 2026-08-03 | 191 | FR-036 深化：逻辑图可拖拽节点画布（控件→触发→动作链 + SVG 边；布局会话态；双击选中） |
| 2026-08-03 | 190 | FR-032：SET_PROP 控件/属性/值选择器 + CodeGen `event_set_prop_*`（text/hidden/geometry/value/state） |
| 2026-08-03 | 189 | FR-057：build-manifest 增强 + `generate --prune-orphans`（永不删 custom/） |
| 2026-08-03 | 188 | MCP：`forgeui_switch_language` + `list/upsert_animation`；事件动作枚举扩展 SET_PROP/SWITCH_LANGUAGE/… |
| 2026-08-03 | 187 | FR-007 暂缓（需硬件）；属性面板 polish：PropGroup 折叠动画 + 控件类型图标共用 widget-icons |
| 2026-08-03 | 186 | FR-063：Wasm IR 常驻热替换（hot-reload.stamp + generate 后自动刷新）；SDL 真二进制热换仍后续 |
| 2026-08-03 | 185 | D-08 落地：`platform` Schema/UI 可选；新建工程不再选芯片；exportToSdk 用交付适配器默认；无 platform 仍可 generate |
| 2026-08-03 | — | **D-08**：纠正 `platform` 理解——工具/CodeGen 平台无关，多板同一生成物；概要 V2.7 + 详设 §8 |
| 2026-08-03 | 183 | FR-043 深化：翻译进度条、仅缺失导出、target state、表内待译过滤 |
| 2026-08-03 | 182 | FR-071 深化：ui_anim nodeId→lv_obj_t*（screen_get/extern）；设计器播放预览驱动画布；旧 loop 进程已替换为 90s deepen 队列 |
| 2026-08-03 | 181 | V2 批次落地：FR-020/035/036/055/056/076/086/090～093；SWITCH_LANGUAGE/SET_VAR CodeGen；packPreview+JsonRuntime；normalizeExport 保留 micropython/weak |
| 2026-08-03 | 180 | FR-042 深化：画布预览语言换文、属性 i18n 键、顶栏 locale 切换；冒烟 12/12 |
| 2026-08-03 | — | 写入「文档对照缺口」：部分完成优先队列 + 未开始/暂缓/远期（对照 8 份设计文档） |
| 2026-08-03 | 179 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 178 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 177 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 176 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 通过 |
| 2026-08-03 | 175 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 174 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 173 | 空闲 tick：i18n/anim CodeGen 冒烟 + 轮换回归通过 |
| 2026-08-03 | 172 | V2：FR-042/043 i18n+XLIFF；FR-071 时间轴动画；设计器对话框 + ui_i18n/ui_anim CodeGen |
| 2026-08-03 | 171 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9；FR-070 暂缓 |
| 2026-08-03 | 170+ | 用户决定暂缓 FR-070 跨平台打包；设计器 dev 空白窗验收通过 |
| 2026-08-03 | 170 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 169 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 168 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 167 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 通过 |
| 2026-08-03 | 166 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 165 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 164 | P1：lv_font_conv E2E（fix CLI args + range glyphs）；font_conv_e2e 测试；全量 239/239 |
| 2026-08-03 | 163 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 162 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 通过 |
| 2026-08-03 | 161 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 160 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 159 | P1：C JSON runtime main/items checked+pressed+focused+disabled State；设计器 vite production build；FR-058 cli_validate 测试；全量 238/238 |
| 2026-08-03 | 158 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 157 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 156 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 153 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 152 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 151 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 150 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 149 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 148 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 147 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 146 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 145 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 144 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 143 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 142 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 141 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 140 | 里程碑：全量测试 235/235；Loop#120–139 维护期无回归 |
| 2026-08-03 | 139 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 138 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 137 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 136 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 135 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 134 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 133 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 132 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 131 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 130 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 129 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 128 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 127 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 126 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 125 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 124 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 123 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 122 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 121 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 120 | 里程碑：全量测试 235/235；Loop#100–119 维护期无回归 |
| 2026-08-03 | 119 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 118 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 117 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 116 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 115 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 114 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 113 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 112 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 111 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 110 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 109 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 108 | 空闲 tick：G-01/G-02 黄金路径冒烟 6/6 通过 |
| 2026-08-03 | 107 | 空闲 tick：M7 样式/字体冒烟 6/6 通过 |
| 2026-08-03 | 106 | 空闲 tick：JSON runtime + extraData CodeGen 冒烟 9/9 |
| 2026-08-03 | 105 | 空闲 tick：M6 packer + MCP 冒烟 17/17 通过 |
| 2026-08-03 | 104 | 空闲 tick：G-01/G-02 冒烟 8/8 通过 |
| 2026-08-03 | 103 | 维护：core validate.ts Ajv addSchema 类型；core+codegen build 通过 |
| 2026-08-03 | 102 | 维护：CodeGen tsc 构建修复（extraData 类型 + warning level） |
| 2026-08-03 | 101 | 维护：空闲 tick（无新功能项） |
| 2026-08-03 | 100 | 里程碑：全量测试 234/234；Loop 工作区阶段总结 |
| 2026-08-03 | 99 | M7：lv_font_conv 管线（魔数校验、.h、symbol alias、npx -p） |
| 2026-08-03 | 98 | M7：text_decor 样式 CodeGen + 设计器 + runtime |
| 2026-08-03 | 97 | M6 runtime：cursor/series Part 样式 |
| 2026-08-03 | 96 | M6 runtime：selected Part + main/items checked State 样式 |
| 2026-08-03 | 95 | M6 runtime：items/scrollbar Part 样式 + 设计器 Part 别名 |
| 2026-08-03 | 94 | M6 runtime：knob Part default/pressed 样式 |
| 2026-08-03 | 93 | M6 runtime：indicator Part default/pressed 样式 |
| 2026-08-03 | 92 | M7：outline 样式 CodeGen + 设计器 + runtime |
| 2026-08-03 | 91 | M6 runtime：keyboard extraData.rows keymap 绑定 |
| 2026-08-03 | 90 | M6 runtime：animimg extraData.frames + repeat/start |
| 2026-08-03 | 89 | M7 CodeGen：spangroup extraData.items span 文本生成 |
| 2026-08-03 | 88 | M6 runtime：spangroup extraData.items span 文本绑定 |
| 2026-08-03 | 87 | M6 runtime：line 样式（color/width/opacity） |
| 2026-08-03 | 86 | M6 runtime：clip_corner 样式支持 |
| 2026-08-03 | 85 | M8 batch_get 读路径 100%；M5/M8 里程碑标记完成 |
| 2026-08-03 | 84 | M8：batch_get widget spec + event metadata + list_events |
| 2026-08-03 | 83 | M8：batch_get get_node + list_widget_types + list_assets |
| 2026-08-03 | 82 | M8：forgeui_ping 返回真实版本与 toolCount |
| 2026-08-03 | 81 | M6/V1-C：C JSON runtime container flex layout |
| 2026-08-03 | 80 | M6/V1-C：C JSON runtime frame.rotation transform |
| 2026-08-03 | 79 | M6：C JSON runtime chart extraData.series 解析与 LVGL 绑定 |
| 2026-08-03 | 78 | M6：C JSON runtime image/imagebutton/bg_image path 绑定 |
| 2026-08-03 | 77 | M6：C JSON runtime opacity + text spacing 样式 |
| 2026-08-03 | 76 | M6：C JSON runtime 扩展 main/default 样式（radius/border/pad/shadow） |
| 2026-08-03 | 75 | M6：C JSON runtime 补全剩余 11 widget（全量 37） |
| 2026-08-03 | 74 | M6：C JSON runtime table + chart 系列 |
| 2026-08-03 | 73 | M6：C JSON runtime keyboard + msgbox |
| 2026-08-03 | 72 | M6：C JSON runtime tabview + buttonmatrix |
| 2026-08-03 | 71 | M6：C JSON runtime imagebutton + animimg widget |
| 2026-08-03 | 69 | M6：C JSON runtime parse_style_block + apply_main_default_style |
| 2026-08-03 | 68 | M7：text_font 样式 CodeGen + fontIncludes + 设计器 fontRef |
| 2026-08-03 | 66 | M7：widget Part 映射 + roller extraData CodeGen |
| 2026-08-03 | 65 | M6 JSON runtime：textarea/line widget 支持 |
| 2026-08-03 | 64 | M6 JSON runtime：roller/arc widget 支持 |
| 2026-08-03 | 63 | M6 JSON runtime：led/spinner widget 支持 |
| 2026-08-03 | 62 | M6 JSON runtime：dropdown/list + extraData.items 解析 |
| 2026-08-03 | 61 | M6 JSON runtime：checkbox/bar widget 支持 |
| 2026-08-03 | 60 | M6 JSON runtime：slider/switch/image widget 支持 |
| 2026-08-03 | 59 | M6 JSON runtime 嵌套 children；M7 text spacing；V1-C 屏幕 rotation CodeGen |
| 2026-08-03 | 58 | M6：C `forge_json_runtime` + `forge_loader_apply_json`（widget 子集） |
| 2026-08-03 | 57 | M6：C `forge_loader_open_mem` + TS `buildMemRefDescriptor` |
| 2026-08-03 | 56 | M6：`JsonRuntimeLoader.apply` 解析 A2 ui/screens JSON 运行时树 |
| 2026-08-03 | 55 | V1-B：keyboard keymap + msgbox footer buttons extraData CodeGen |
| 2026-08-03 | 54 | V1-B：chart extraData.series → lv_chart_add_series + set_series_values |
| 2026-08-03 | 53 | V1-B：buttonmatrix map + table cells extraData CodeGen |
| 2026-08-03 | 52 | V1-B CodeGen：list/dropdown/tabview extraData → LVGL API |
| 2026-08-03 | 51 | V1-C：`bg_image` style CodeGen + 属性面板字段；图片 path 去重 |
| 2026-08-03 | 50 | V1-C：容器/屏幕 `layout_type` → LV_LAYOUT_FLEX + flex_flow CodeGen |
| 2026-08-03 | 49 | V1-C：`frame.rotation` → CodeGen transform_rotation + pivot；新深化队列 |
| 2026-08-03 | 48 | Emscripten LVGL Wasm：`wasm-emcc.ts` + hal/lv_conf 模板 + preview-mode 跳转 |
| 2026-08-03 | 47 | C Loader `forge_loader_apply`：assets/screens 校验 + weak ui_init/ui_nav |
| 2026-08-03 | 46 | imagebutton 双态 + animimg frames CodeGen；`collectImageAssets` 扫描控件引用 |
| 2026-08-03 | 45 | PNG→C 数组：`png-decode.ts` 解码 PNG 嵌入 `image/`；失败回退 stub |
| 2026-08-03 | 44 | Post-MVP：`custom_func.h/c` + `image-emit.ts` 桩 + image 控件绑定；AC-005 标记完成 |
| 2026-08-03 | 43 | 空闲 tick（无队列项） |
| 2026-08-03 | 42 | 空闲 tick；确认 D-07 单目录生成物已实现 |
| 2026-08-01 | 0 | 创建本跟踪文件；启动动态 loop |
| 2026-08-03 | 28 | MVP GUI 验收清单 UI-01～03 + DocsView 入口 + 结构测试 |
| 2026-08-03 | 27 | Inspector Tab 键盘：`role=tablist` + 方向键切换 + `inert` 隐藏面板 |
| 2026-08-03 | 25 | LayoutGroup：`frame.rotation` + 容器 `layout_type`（none/flex_row/flex_column） |
| 2026-08-03 | 23 | LayoutGroup 3×3 锚点：`frame.anchorX/Y` + 切换锚点保持视觉位置 |
| 2026-08-03 | 21 | Figma 导入：`importFigmaJson` + 控件映射 + Home 导入入口 |
| 2026-08-03 | 19 | AI 设计面板：`ai-workspace.mjs` + Bridge 状态/MCP 工具表/复制配置 |
| 2026-08-03 | 15 | Wasm 预览：`WasmBackend` + `.forge/preview-wasm` IR 浏览器预览 + Designer 读 `previewBackend` |
| 2026-08-03 | 13 | `forgeui_batch_update`/`update_node`/`add_node_tree` + AI 事务栏 Save/Discard |
| 2026-08-03 | 12 | MCP：`stdio-server` + `bridge-client` + Designer Bridge 39201；`mcp_stdio_bridge` 测试 |
| 2026-08-03 | 11 | FR-041：`fonts.ts` + `font-emit.ts` + AssetsDialog 导入；Loader C 桩 |
| 2026-08-03 | 10 | FR-019：`custom-widgets.ts` + IPC + WidgetLibraryPanel/PageTreePanel；`designer_custom_widgets` 测试 |
| 2026-08-03 | 9 | 设计器导入 .forgeui：`project:importForgeui` IPC + Home/WorkspaceGate；`designer_forgeui_import` 测试 |
| 2026-08-03 | 8 | qm10xv/xh PlatformPlugin + HELLO 模板；去除 validate 警告 |
| 2026-08-03 | 7 | FR-013b 六向对齐 + 多选；Monitored loop 验证 |
| 2026-08-03 | 6 | FR-004 `.forge/history/` 快照 + HistoryDialog；存档自动写历史 |
| 2026-08-03 | 5 | Packer 实装 ui/ 树；ReferenceLoader 校验；CodeGen style-emit Part/State |
| 2026-08-03 | 4 | FR-018 ColorLibraryDialog；StyleGroup 保存/应用主题；project colors/themes |
| 2026-08-03 | 3 | 38/38 控件满注册（calendar + 4 charts）；widget_registry_38 测试 |
| 2026-08-03 | 2 | 间隔改 2min；+12 控件（spinbox…scale）；重启 Job#1 |
| 2026-08-01 | 1 | extraData 模型 + Items/Tabs/Buttons 编辑器 + 5 控件 defaultExtraData；更新属性面板详设 V1.1 |

---

## 文档同步索引

| 文档 | 需同步章节 |
|------|------------|
| `嵌入式UI工具_控件属性面板详细设计说明.md` | §9 差距表、§5.3 控件数、§10 里程碑 |
| `嵌入式UI工具_软件详细设计说明.md` | §14 里程碑备注 |
| `工具详细说明手册/控件属性面板使用说明.md` | ForgeUI 分期列（批量） |
| `嵌入式UI工具_MCP接口详细设计说明.md` | §7 分期表（MCP 实现后） |
