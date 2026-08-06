# ArtInChip UIBuilder：分析与仿制方案

> 综合 `ArtInChip_UIBuilder分析文档.md`、`ArtInChip_UIBuilder_仿制方案.md`、本机 AiUIBuilder **2.0.2**、官方使用指南与公开资料。  
> 对象：**匠芯创 UIBuilder / AiUIBuilder**（面向 ArtInChip 平台的 LVGL 可视化 UI 工具）。  
> 结构：**上篇分析**（定位 / 原理 / 主要功能 / 优劣）+ **下篇仿制**（边界 / 目标 / 拆分 / 怎么做）。  
> **仿的是工程范式，不是品牌、安装包、`AicUI.dll` 或官方工程格式兼容。**

---

# 上篇：工具分析

## 1. 产品定位

ArtInChip（匠芯创）推出的 **嵌入式 GUI 可视化开发工具**，底层为开源 **LVGL**。PC 拖拽设计 → **生成 LVGL C** → 本机仿真 → 一键复制到 **Luban-Lite** 等 SDK 上板。定位接近 SquareLine / BEKEN Designer。

| 项 | 内容 |
|----|------|
| 产品名 | UIBuilder / **AiUIBuilder** |
| 版本线索 | **2.0.2**（`AiUIBuilder-2.0.2_setup.exe`） |
| 安装目录（实测） | `D:\ArtInChip\AiUIBuilder` |
| 文档 | https://aicdoc.artinchip.com/topics/tools/uibuilder/… |
| 系统 | **Windows 7+ 64 位** |
| LVGL | **V8.3 / V9.1**（仿真侧 8.3.11、9.1.0） |
| 生态 | Luban-Lite / D12x、D13x、D21x 等 |

一句话：

> **Qt 设计器编辑 XML 工程 → 生成标准 LVGL C（+ custom 隔离）→ MinGW/CMake + SDL 仿真 → 复制进 SDK。**

---

## 2. 实现原理

### 2.1 总体架构

```text
AiUIBuilder（Qt5 + AicUI.dll）
  画布 / 控件库 / 属性 / 样式 / 事件 / 资源
        │ .aicpro + .cfg + .snapshot（XML）
        ▼
CodeGen → ui_builder/（生成）+ custom/（用户，再生成不覆盖）
        ├─► PC：LVGL + SDL2 + 内置 MinGW/CMake
        └─► 板端：复制进 Luban-Lite 等交叉编译
```

### 2.2 技术栈（2.0.2 实测）

| 层级 | 技术 |
|------|------|
| 宿主 | **Qt5** Widgets（非 Electron） |
| 核心 | `AicUI.dll`；主程序约 250MB |
| 工程 | XML（`.cfg` / `.snapshot`）+ SQLite（`param_data.db`） |
| 仿真 | SDL2 + `tool/simulator/lvgl/{8.3.11,9.1.0}` |
| 编译 | 内置 MinGW + CMake |
| 其它 | QScintilla、FFmpeg、字体裁剪工具；安装树约 **1GB** |

### 2.3 工程与显示

| 文件 | 作用 |
|------|------|
| `*.aicpro` | 工程入口 |
| `*.cfg` | 分辨率、色深、多语言等 |
| `*.snapshot` | UI 权威树：Screen → Widget（数字 type）+ Style Part/State + Event |
| `resources/` | 图/字等 |
| `ui_builder/` / `custom/` | 生成区 / 用户区 |

设计期：**Qt 画布**按模型绘制；真效果靠 **生成 + SDL 仿真**。

### 2.4 代码生成与扩展

- 产出：`ui_init()`、`screen_*.c`、样式、事件回调、`lv_*` API  
- 自定义事件函数：生成 **weak** 空实现 → 用户在 `custom.c` 写强函数覆盖  
- 纪律：不改生成区；custom 资源放 `custom/assets`  
- 资源路径宏（如 `LVGL_IMAGE_PATH`）上板需 SDK 侧定义  

### 2.5 仿真与上板

```text
F5 →（必要时）生成 → CMake+MinGW → SDL 窗口 → ui_init / lv_timer_handler
```

上板：复制 `ui_builder` → 补宏与编译脚本 → 调 `ui_init()` → 烧录。  
**aicp、视频管线、SDK 目录**体现厂商绑定。

### 2.6 主要功能

依据官方简介、基本操作 / 事件文档、厂商介绍、立创对接与 2.0.2 实测。完整表见分析文档 §3；此处为压缩版。

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| 环境 / LVGL | Win7+ 64 位；**V8.3 / V9.1** | 自带仿真工具链 |
| 工程 | 向导（Empty/模板）、打开 `.aicpro`、项目导出 | 可去 `simulator` 减体积 |
| 设计 | 拖拽 **30+** 控件；属性；对齐/层级/撤销 | 跨工程全局复制粘贴 |
| 样式 | Part/State；预设样式 | 对齐 LVGL 样式思维 |
| 事件 | 切页、改属性、动画、自定义函数 | weak → `custom.c` 强函数 |
| 组件 | 容器另存为组件 | 可再拖入复用 |
| 资源 | 字体裁剪；图转 png/jpg/**aicp**；视频/APNG；外置图/字 | 芯片平台能力有差异 |
| 多语言 | 变量表 + 按语言字体 | 新建工程可开开关 |
| 生成 / 查看 | `ui_builder` + `ui_init()`；代码查看器 | 勿改生成区 |
| 仿真 | **F5** 生成→CMake→SDL | 真效果以仿真为准 |
| SDK | 配路径、一键复制 `ui_builder` | Luban-Lite / 立创路径 |
| 其它 | 设计器中/英；多套模板；导出可 VS Code 调试 | — |

闭环：**设计 → 生成 → F5 仿真 → 复制 SDK → `ui_init()` 上板**。

---

## 3. 特点、优劣与对比

### 3.1 优点

贴近 LVGL 产出；上手快；仿真闭环；`custom`/weak 隔离清晰；双 LVGL 版本；厂商资源与 SDK 链路完整；XML 工程可备份；自带 Windows 工具链。

### 3.2 缺点

仅 Windows；生态偏垂直；安装体积大；画布≠真 LVGL；导出源码需守纪律；type 数字化可读性差；无 Pro 级 Figma/在线/Wasm 预览；公开 AI/MCP 弱。

### 3.3 对比

| | UIBuilder | LVGL Pro | BEKEN Designer |
|--|-----------|----------|----------------|
| 壳 | Qt5 | Theia+Electron | Electron |
| 工程 | XML snapshot | 官方 Pro XML | `.bkprj` JSON |
| 预览 | 生成后 SDL | 编辑器内 Wasm | DOM+SDL |
| 生态 | 强绑 ArtInChip | 通用 LVGL | 偏 Beken |

### 3.4 分析结论

> **Qt + XML 工程 + LVGL C 生成 + SDL 仿真 + SDK 复制。**  
> 主要功能面覆盖设计、事件、资源、生成、仿真与一键进 SDK；已锁定匠芯创平台时优先用官方工具；要自控可发则走下文仿制（自有格式）。

---

# 下篇：仿制方案

## 4. 边界与合规

| 应对齐 | 不要做 |
|--------|--------|
| 自研设计器 + **自有工程格式** + 标准 LVGL C + SDL 仿真 | 破解/重打包官方包、搬 `AicUI.dll` |
| 拖拽、Part/State、事件、custom/weak、仿真与拷 SDK 的**能力** | 对外宣称兼容官方 `.aicpro`/`.snapshot`（除非授权） |
| 开源 LVGL + 自备/精简工具链 | 抄 aicp 闭源实现、冒用商标 |

格式建议：**自有 JSON**（语义可参考 Screen/Widget/Style/Event，扩展名与标签独立）。

原厂功能对标与分期落点见仿制方案 **§0.4**（完整能力表见分析文档 §3）；本节只定合规边界。

---

## 5. 仿制目标：仿范式

> **自有 IR ↔ 设计器 ↔ CodeGen（generated + custom/weak）↔ SDL 仿真 ↔ SDK/CMake**

| 原能力 | 对齐 | 不对齐 |
|--------|------|--------|
| 官方 XML 工程 | 自有 Schema 多文件 | 官方后缀/数字 type 兼容层 |
| Qt + AicUI | 五区工作台 | 必须 Qt 且逆向 DLL |
| F5 仿真 | 生成→CMake→SDL | 首期 Wasm（可 V2） |
| 双 LVGL | MVP **单版本**；V1 可选双版本 | 首期两套撑到 1GB |
| aicp/视频 | V2 / 有授权再做 | MVP 必做 |

### 5.1 目标架构

```text
Designer（Qt 或 Electron/Tauri）
        │ 自有 JSON
        ▼
project + screens + assets
        ├─► CodeGen → generated/* + custom/*（weak）
        └─► Simulator：LVGL+SDL+CMake（F5）
                    │
                    ▼
            最小 CMake / 复制到 SDK
```

### 5.2 宿主选型

| 路径 | 适用 |
|------|------|
| **A. Qt5/6** | 求形似、C++ 团队强 |
| **B. Electron/Tauri + Vue** | 求快出 MVP |

**共用** Schema + CodeGen + 仿真，壳可替换。

### 5.3 分期

**MVP：** Schema；8～12 控件；基础样式；切屏+custom 事件；CodeGen+weak；F5 仿真；CMake/SDK 文档。  
不做：官方兼容、aicp、视频、30+ 控件、双 LVGL、Figma。

**V1：** 20+ 控件；多 Part/State；组件；字体裁剪；图转；i18n；复制 SDK；可选第二 LVGL。

**V2：** 视频；授权下的专有图格式；动画增强；模板；MCP；可选 Wasm 预览。

---

## 6. 工作拆分

**顺序：Schema → CodeGen → 仿真 → Designer → SDK。禁止先堆界面。**

| 序号 | 工作 | 周期 | 交付 |
|------|------|------|------|
| 0 | 范围冻结 | 2～3 天 | 自有格式；MVP 控件清单；合规备忘 |
| 1 | Schema+示例 | 1～2 周 | 可校验 IR；双页 Hello |
| 2 | CodeGen CLI | 2～3 周 | generated+custom+weak+cmake |
| 3 | 仿真模板 | 1～2 周 | 单版本 LVGL+SDL |
| 4 | Designer MVP | 6～10 周 | 拖完即可生成仿真 |
| 5 | SDK 接入包 | 1～2 周 | 最小工程+复制脚本+文档 |
| 6 | V1 | 1～2 月 | 样式/字体/i18n/更多控件 |
| 7 | V2 | 按需 | 视频/专有格式/AI/Wasm |

粗算：MVP **4～7 人月**；V1 **10～14 人月**；近原厂密度 **18～25 人月**。

---

## 7. 关键落地

### 7.1 自有工程（JSON 示意）

```text
my_ui/
├── project.json
├── screens/*.json
├── assets/
├── generated/     # 覆盖
└── custom/        # 不覆盖
```

控件用字符串 `type`（如 `"label"`），勿对外用官方数字枚举。

### 7.2 CodeGen

遍历 IR → 模板生成 `ui_init` / `screen_*` / 样式 / 事件；自定义名 → weak 桩；禁止手改 generated。

### 7.3 仿真

```text
CodeGen → CMake → MinGW → SDL → ui_init
```

锁一个 LVGL 小版本；**以仿真窗口为验收**，不以画布为准。

### 7.4 Designer 模块

工程 / 库 / 画布 / 树 / 属性样式 / 事件 / 资源 / 生成·仿真·复制 SDK。  
顺序：读写 → 只读画布 → 属性 → 拖入 → 树/撤销 → 接生成仿真 → 事件。

### 7.5 SDK

最小 `lvgl-cmake-min`；复制脚本；路径宏与 `ui_init` 文档。服务匠芯创客户时自写 Luban 目录说明。

### 7.6 仓库建议

```text
aic-ui-toolkit/
├── docs/（schema、codegen、compliance）
├── packages/（schema、codegen、simulator、designer）
├── templates/hello_two_screens/
└── examples/lvgl-cmake-min/
```

---

## 8. 选型、验收与风险

### 8.1 选型

| 诉求 | 建议 |
|------|------|
| 匠芯创芯片 + 官方 aicp/视频/支持 | **用 AiUIBuilder** |
| 同类能力且自控可发 | **按本文仿制** |
| 轻量 Electron 路线 | 亦可参考 Beken 方案，能力向 UIBuilder 对齐 |
| Figma / Wasm / 官方 XML | **LVGL Pro** 或其仿制路线 |

### 8.2 验收

**MVP：** 拖出双页基础 UI；切页；custom 改文案；F5 正确；再生成 custom 不丢；可进最小 CMake；声明不兼容官方工程。  
**V1：** Part/State+组件；字体裁剪可见；复制 SDK 可编过。

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 画布≠板端 | 强制仿真验收；锁 LVGL 版本 |
| 生成冲掉手写 | 严分 generated/custom |
| 体积膨胀 | MVP 单 LVGL；视频放后 |
| 官方格式兼容 | 合规禁止（除非授权） |
| 范围膨胀 | 按分期砍 |
| Qt vs Electron | 后端先行，壳可换 |

---

## 9. 总结论

| 维度 | 结论 |
|------|------|
| 原工具本质 | Qt + XML + LVGL C + SDL 仿真 + SDK 复制 |
| 仿制精髓 | **自有 IR + 设计器 + generated/custom(weak) + SDL** |
| 不可仿 | 品牌、AicUI.dll、未授权专有转换器、安装包再分发 |
| 落地顺序 | **Schema → CodeGen → 仿真 → Designer → SDK** |
| MVP 关键 | 仿真正确 + custom 不丢 + 可上板 |
| 壳 | 形似用 Qt；速度用 Electron——**后端共用** |

公开能力对标见仿制方案 **§0.4** / 分析文档 **§3**。

一句话：

> **分析上，UIBuilder 是厂商垂直的 Qt+XML→LVGL C→SDL 工具链；仿制上用自有 JSON 对齐该范式，先打通生成与仿真，再补设计器与资源工具，不兼容官方工程格式。**

---

## 参考资料

1. `artinchip/ArtInChip_UIBuilder分析文档.md`  
2. `artinchip/ArtInChip_UIBuilder_仿制方案.md`  
3. `artinchip/ArtInChip_UIBuilder_竞品逆向与重构设计说明.md`  
4. `artinchip/UIBuilder简介.txt`；使用指南 PDF/MD  
5. 本机：`D:\ArtInChip\AiUIBuilder`（2.0.2）  
6. https://aicdoc.artinchip.com/topics/tools/uibuilder/uibuilder_user_guide.html  
7. 对照：`beken/博通集成_LVGL_UI工具_分析与仿制方案.md`；`lvgl_pro/LVGL_Pro官方UI工具_分析与仿制方案.md`  
8. 可选细读：`report/UIBuilder实现方案分析文档.md`、`report/仿制UIBuilder需求文档.md`  

---

*综合技术分析与落地建议，不构成法律意见；对外发布前请确认商标与格式策略。*
