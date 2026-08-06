# FlyThings 风格 UI IDE 仿制方案

> 目标：在合法前提下，参考中科世为 FlyThings IDE 的**架构范式**（可视化控件树 + 代码生成 + 宿主加载应用），设计一套可自研落地的仿制方案。  
> 非目标：复制其闭源二进制、加密库、授权体系或专有文件魔数；不建议二进制兼容其 `.ftu` / `libeasyui.so`。

---

## 0. 原厂主要功能清单（对标用）

依据分析文档 §3、官网与 developer.flythings.cn。仿制时按**能力**对齐，**格式与运行时自有**。

| 类别 | 原厂主要功能 | 仿制建议落点 |
|------|--------------|--------------|
| IDE 壳 | Eclipse 六区工作台 | MVP：Electron/VS Code 五～六区；勿搬 Eclipse 插件 |
| 工程向导 | 平台/分辨率/旋转/字体/输入法/屏保/串口 | MVP：分辨率+平台；其余 V1 |
| 可视化 | 拖拽、属性表、大纲、即时预览 | MVP 必做 |
| 控件 | Button/Text/Slider/List/Window/动画等 ZK* | MVP：6～8 类；V1 扩 List/Window |
| 样式 | 多态 color/pic；特殊字符集 | MVP：基础态；V1 多态 |
| UI 文档 | `.ftu`（ZKSW+zlib+JSON） | **自有明文 JSON**；禁止兼容 `.ftu` |
| 代码生成 | Activity + Logic 增量钩子 | MVP：骨架+事件钩子，保护用户区 |
| 事件 | 约定函数名；列表三回调 | MVP：点击/滑条；V1：列表 |
| Activity | 多页堆栈、生命周期、Intent | MVP：多页切换；V1：传参/返回栈 |
| 串口 | 协议框架与样例 | V1 可选；或文档化用户自写 |
| 部署 | ADB 下载调试、TF 外置、update.img | MVP：打包+一种推送；V1：镜像固化 |
| 调试 | Log + 控制台跳转 | MVP：日志面板 |
| OS 能力 | 网络/视频/物联/支付/OTA | **不做整机 OS**；按客户方案选配 |
| Lite | PC 模拟、OpenCPU、图压 | 二期；或改挂 LVGL |

闭环主路径（Linux）：**拖拽 `.ftu` → 写 Logic → 编译 so → ADB/TF/update.img → 宿主加载**。  
仿制闭环：**拖拽自有 UI → 写 Logic → 打包 app → 自研 loader/LVGL 运行**。

---

## 1. 仿制目标与边界

### 1.1 要对齐的能力（MVP）

| 能力 | 说明 |
|------|------|
| 拖拽式 UI 设计 | 画板 + 属性表 + 大纲，绝对坐标布局 |
| 文档模型持久化 | 明文/可选压缩的 JSON（或 MessagePack）控件树 |
| 增量代码生成 | 由 UI 生成 Activity 式骨架 + 事件钩子，保护用户业务区 |
| C/C++ 业务开放 | 用户在 Logic 中写逻辑，通过控件句柄改 UI |
| PC 预览 | 设计期画布预览；可选主机模拟器 |
| 一键部署 | 打包「应用库 + UI 资源 + 配置」并下载到板端 |
| 基础控件集 | Button / Label / Image / Slider / Panel / List（模板项） |

完整原厂功能对标见 **§0** / 分析文档 §3。

### 1.2 明确不做或后置

- 不仿制其 Linux 3.4 整机 OS、支付/物联网云平台、芯片授权水印体系  
- 首期不做完整 MCU Lite 极致压缩栈（可二期挂 LVGL）  
- 不追求与 FlyThings 工程/文件格式互通  
- 法律上：自研模型、自研运行时或基于 **LVGL / Dear ImGui / Qt Embedded / Slint** 等开源协议清晰的底座

### 1.3 产品定位建议

做成 **「嵌入式 HMI 可视化工具链」**，而非完整 OS：

```text
自研 IDE（设计器 + 工程管理 + 代码生成 + 打包下载）
        +
可选运行时底座（优先 LVGL 或自研轻量 GUI）
        +
板端 Loader（加载 app.so / 固件 + ui 资源）
```

相对 FlyThings 的差异化卖点可主动选择：

- UI 文件 **明文 JSON + Git 友好**  
- 运行时可选 **开源 LVGL**，降低锁定  
- 工具链现代化：**VS Code 插件 / Electron / Tauri**，而非 Eclipse  

---

## 2. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                         Host IDE                             │
│  ProjectSvc │ Designer(Canvas/Palette/Props/Outline)         │
│  CodeGen │ BuildOrchestrator │ Deploy(ADB/Serial/TF) │ Log   │
└─────────────┬─────────────────────────────┬──────────────────┘
              │ 读写 .hmui (JSON)            │ 生成/调用工具链
              ▼                             ▼
┌─────────────────────┐         ┌─────────────────────────────┐
│  UI Document Model  │         │  App Sources + Generated    │
│  Page / ControlTree │         │  activity_*, logic_*, main  │
└─────────────────────┘         └──────────────┬──────────────┘
                                               │ cross-compile
                                               ▼
                                ┌─────────────────────────────┐
                                │  Deploy Bundle              │
                                │  app.so / firmware          │
                                │  ui/*.hmui + assets         │
                                │  runtime.cfg                │
                                └──────────────┬──────────────┘
                                               │ download
                                               ▼
                                ┌─────────────────────────────┐
                                │  Board Runtime              │
                                │  loader + GUI engine        │
                                │  load app → inflate UI tree │
                                └─────────────────────────────┘
```

**核心不变量（与 FlyThings 同构、实现自研）：**

1. 设计期只编辑 **控件树文档**  
2. 编译期 **文档 → 代码骨架 + 资源包**  
3. 运行期 **Loader 加载应用 + 按文档建控件树**

---

## 3. 技术选型（推荐路线）

### 3.1 三条宿主路线对比

| 方案 | 优点 | 缺点 | 建议 |
|------|------|------|------|
| **A. Eclipse RCP + CDT** | 最像原厂；C/C++ 工程成熟 | 技术栈老、招人难、UI 土 | 仅当团队已有 Eclipse 经验 |
| **B. VS Code 扩展 + 独立 Designer Webview** | 现代、易分发、扩展生态好 | 需自管工程/编译编排 | **推荐中小团队** |
| **C. Electron/Tauri 独立 IDE** | 体验可控、品牌完整 | 自建一切，成本最高 | 做商业产品时选 |

**推荐：B 起步，产品化后再迁 C。**  
Designer 用 **React + Canvas/SVG**（或 Konva/Fabric）实现拖拽；扩展负责工程、codegen、调用 `cmake`/`ninja`、ADB。

### 3.2 运行时底座选型

| 底座 | 适用 | 说明 |
|------|------|------|
| **LVGL 8/9** | Linux fb/drm、MCU | 生态最大；仿制「控件+事件」最省；可对接 SquareLine 思路但自研设计器 |
| 自研 ZK 风格轻量 GUI | 要强绑定自有 OS | 成本高，仅在要深度锁定时做 |
| Slint / Qt | 高端 HMI | 授权与体积需评估 |

**推荐 MVP：LVGL。** 设计器属性映射到 LVGL 对象创建参数；生成 C 代码调用 `lv_obj_*`，或生成「描述表 + 薄运行时解释器」（更接近 FlyThings：运行时读 JSON 建树，逻辑仍在用户 C 里）。

### 3.3 两种「设计器→运行」策略（关键分叉）

| 策略 | 做法 | 像不像 FlyThings | 利弊 |
|------|------|------------------|------|
| **S1 导出源码** | 设计器直接生成 `ui_screen_main.c` 布局代码 | 偏 SquareLine/UIBuilder | 简单；难增量保护用户改动 |
| **S2 文档+解释器（推荐）** | 板上加载 `.hmui`，运行时建树；只生成 Logic 钩子与控件句柄表 | **最像 FlyThings** | 需写轻量 UI Inflater；Git 友好、热更新 UI 方便 |

**仿制方案默认采用 S2。**

---

## 4. 模块设计

### 4.1 UI 文档模型（Document Model）

```ts
type Rect = { left: number; top: number; width: number; height: number };

type ControlNode = {
  type: "button" | "label" | "image" | "slider" | "panel" | "list" | ...;
  name: string;          // 对应 FlyThings caption，C 标识符
  id: number;            // 数值 ID
  position: Rect;        // 相对父
  visible: boolean;
  touchable: boolean;
  props: Record<string, unknown>;  // text, colors, images, states...
  children?: ControlNode[];
};

type PageDoc = {
  version: 1;
  name: string;          // main
  resolution: { width: number; height: number };
  root: ControlNode;     // 根 panel/window
};
```

与原厂差异（刻意做得更好）：

- 使用 **`children` 数组**，不用 `button__1` 这种 key（更易解析、排序、diff）  
- 文件扩展名建议 **`.hmui`**（Human Machine UI），**明文 JSON**；可选 gzip 仅用于量产包  
- `name` 唯一性在页面内校验；自动生成 `Button1`、`Button2`…

### 4.2 设计器（Designer）

**单一数据源 + 三视图：**

```text
          ┌── CanvasView（拖拽、缩放、对齐线、选中框）
Model ────┼── PropertyGrid（按控件 schema 渲染表单）
          └── OutlineTree（层级、显隐、重排）
```

实现要点：

1. **控件注册表（Palette Registry）**  
   - 每类控件：`type`、默认 props、设计期绘制器、属性 schema、代码生成元数据（事件列表）  
2. **命令模式**  
   - `AddControl` / `Move` / `SetProp` / `Reparent` / `Delete` 全部走 Command + Undo栈  
3. **即时预览**  
   - 设计期用近似皮肤绘制（不必链真 LVGL）；列表只画 Item 模板  
4. **吸附与网格**  
   - 工控屏刚需：网格、对齐、相同间距  

### 4.3 工程结构（建议）

```text
MyHmiApp/
├── project.json          # 平台、分辨率、串口、工具链路径
├── ui/
│   ├── main.hmui
│   └── settings.hmui
├── assets/               # 图片字体（原 resources）
├── src/
│   ├── generated/        # 自动生成，勿手改
│   │   ├── main_activity.c/.h
│   │   └── ui_ids.h
│   ├── logic/            # 用户业务（增量生成钩子）
│   │   └── main_logic.c
│   ├── protocol/         # 串口/总线
│   └── main.c            # on_app_init / on_startup_screen
├── build/                # 中间产物
└── out/                  # 部署包
    ├── runtime.cfg
    ├── libapphmi.so      # 或 app.bin
    └── ui/...
```

### 4.4 代码生成器（CodeGen）

输入：所有 `.hmui`  
输出：

1. **`ui_ids.h`**：`ID_MAIN_BUTTON1` 等宏  
2. **`*_activity.c`**：控件句柄表、`on_create` 里调用 `ui_inflate("main.hmui")` 或按节点 API 建树，并绑定事件到用户符号  
3. **`*_logic.c`（增量）**：

```c
/* === GENERATED BEGIN: hooks === */
void on_button_click_Button1(HmiButton* btn);
/* === GENERATED END === */

/* 用户代码写在 GENERATED 块外；增量合并时按 name 增补缺失钩子，删除不自动擦除 */
void on_button_click_Button1(HmiButton* btn) {
    /* user */
}
```

增量合并算法（对齐原厂经验）：

| UI 变更 | CodeGen 行为 |
|---------|----------------|
| 新增控件 | 追加钩子声明/空实现（若不存在） |
| 删控件 | **保留**旧钩子（防丢业务），可告警「孤儿函数」 |
| 改 name | 视为新增；旧钩子保留并告警 |
| 仅改样式 | 不改 Logic |

可选增强（超越原厂）：提供「清理孤儿钩子」显式命令。

### 4.5 运行时（Runtime）

拆三层，便于换底座：

```text
HmiApp API（用户看见的 Button/Label 指针风格）
        ↓
Inflater（读 .hmui → 建控件树）
        ↓
Backend（LVGL / 自研 / 模拟器后端）
```

**Loader 启动序（仿 FlyThings so 模型）：**

```text
1. 启动 hmi_loader
2. 读 runtime.cfg（资源根路径、启动页）
3. dlopen libapphmi.so（静态链固件则跳过）
4. 调 app_on_init()
5. 调 app_startup_screen() → "main"
6. inflate ui/main.hmui
7. 进入输入/刷新循环
```

Linux 板：`libapphmi.so` + 资源目录。  
MCU：把 Inflater + 资源编进固件，或资源放外部 Flash。

### 4.6 构建与部署

| 环节 | 设计 |
|------|------|
| 构建 | IDE 调 `cmake --build`；工具链来自 `project.json`（arm-linux-gnueabihf / 芯片 SDK） |
| 调试部署 | ADB `push` 到 `/mnt/udisk/hmi` 或 `/tmp/hmi`，`kill -HUP` / 重启 loader |
| 外置启动 | 输出完整 out/ 到 TF；loader 优先检测外置目录 |
| 固化 | 打 `update.tar`/`update.img`（自研格式即可）；板端升级守护进程解压替换 |

**不要**在 MVP 做 Android 式复杂属性系统；一个目录同步协议足够。

### 4.7 模拟器（强烈建议 MVP 就做简化版）

- 用同一套 Inflater + **SDL2/桌面 LVGL 端口** 跑 `libapphmi` 的主机编译版本  
- 价值：对齐 Lite「少烧录」体验，也验证 S2 文档模型  

---

## 5. 控件与事件契约（最小集）

### 5.1 通用属性

`name, id, position, visible, touchable, bg_color, bg_image`

### 5.2 状态（可选五态，对齐工控习惯）

`normal / pressed / selected / selected_pressed / disabled` → 颜色与图片表

### 5.3 事件生成约定

| 控件 | 生成钩子 |
|------|----------|
| button | `on_button_click_<Name>` |
| slider | `on_slider_changed_<Name>` |
| list | `on_list_bind_<Name>` / `on_list_item_click_<Name>` |
| page | `on_page_init/show/hide/quit_<Page>` |

用户 API 风格保持「指针操作」以贴近原厂心智：

```c
hmi_label_set_text(g_main.TextValue, "90");
hmi_button_set_selected(g_main.BtnPower, true);
```

---

## 6. 实施分期路线图

### Phase 0 — 骨架（2–3 周）

- 定 `.hmui` schema、工程模板  
- 无 IDE：命令行 `hmui-codegen` + 手写 1 个 Demo 页  
- LVGL 桌面模拟跑通 Inflater  

### Phase 1 — 设计器 MVP（4–8 周）

- VS Code 扩展或 Tauri：Canvas 拖拽、属性、大纲、保存  
- 控件：Panel/Button/Label/Image  
- CodeGen 增量钩子  
- 主机模拟一键运行  

### Phase 2 — 板端闭环（4–6 周）

- 交叉编译出 `libapphmi.so`  
- Loader + ADB/脚本部署  
- 串口协议模板 + 日志  

### Phase 3 — 控件与工程化（持续）

- List/Slider/Keyboard/多媒体占位  
- 多页面栈（open/back/home）  
- 资源打包、字体裁剪、多语言表  
- CI：schema 校验、孤儿钩子检查、截图回归（模拟器）  

### Phase 4 — MCU Lite 线（可选）

- 同一 `.hmui` → 生成 LVGL-MCU 工程或资源镜像  
- 串口下载；图片压缩（可接 LVGL 官方或自研 tile 压缩）  
- OpenCPU：用户 `main` 与 UI 同固件  

---

## 7. 团队与工作量粗估

| 角色 | 人数（建议） | 职责 |
|------|--------------|------|
| 工具前端 | 1–2 | 设计器、VS Code/Electron |
| 工具后端/CodeGen | 1 | schema、增量生成、工程模板 |
| 嵌入式 GUI | 1–2 | Inflater、Loader、LVGL 适配、模拟器 |
| 嵌入式系统 | 1 | 部署、ADB/升级、板级 BSP 对接 |

**到「可卖的内测工具」**：大约 **4–6 人月**（MVP 单平台）。  
**到「可对标工业串口屏工具链」**：大约 **12–18 人月**（多控件、多平台、稳定升级）。

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 设计期预览 ≠ 真机 | 尽早上同一 Inflater；关键页面强制模拟器回归 |
| 增量 CodeGen 弄坏用户代码 | 严格 GENERATED 标记；合并前备份；提供格式化无关的 AST/标记合并 |
| 运行时绑定过死 | Backend 接口隔离；文档不写死 LVGL 类型名 |
| 知识产权 | 自研格式与品牌；勿用 ZKSW 魔数/水印/逆向授权库；法务审依赖许可证 |
| 范围膨胀（做成 OS） | 坚持「工具链 + 可选运行时」，OS/驱动交给芯片 SDK |

---

## 9. 与原厂方案的「同构 / 异构」对照

| 维度 | FlyThings | 本仿制方案 |
|------|-----------|------------|
| IDE 壳 | Eclipse CDT | VS Code / Tauri（可后期独立 IDE） |
| UI 文件 | `ZKSW`+zlib+JSON | 明文 `.hmui` JSON（可压缩打包） |
| 设计模型 | 控件树 | 同构，children 数组更清晰 |
| 业务代码 | Logic.cc 增量钩子 | 同构 |
| 应用形态 | `libzkgui.so` + EasyUI | `libapphmi.so` + 自研 loader |
| GUI 引擎 | 闭源 EasyUI | **LVGL（推荐）** 或自研 |
| 部署 | ADB / TF / update.img | 同构流程，格式自研 |
| 兼容原厂工程 | — | **不兼容（刻意）** |

---

## 10. 建议的最小可行 Demo 定义（验收）

1. 设计器拖出开机页：背景图 + 2 按钮 + 1 文本  
2. 生成工程，主机模拟器可点按钮改文本  
3. 交叉编译并 ADB 推到一块 Linux HMI 板，行为一致  
4. 再改 UI 颜色/位置，不丢 Logic 里用户写的计数逻辑  
5. 打出升级包，重启后仍运行新应用  

达成以上五点，即证明「FlyThings 范式」已被仿制打通；其后只是控件库与平台覆盖的扩张。

---

## 11. 结论

仿制 FlyThings UI IDE，**不必仿 Eclipse，更不必仿闭源 GUI**；要仿的是这条链路：

> **控件树文档 ↔ 可视化三视图 ↔ 增量 Logic 生成 ↔ 宿主加载 app + inflate UI ↔ ADB/卡/镜像部署**

落地时优先：**明文 `.hmui` + LVGL Backend + VS Code/独立设计器 + so/固件插件模型**。  
先打通单页 Demo 闭环，再堆控件与 MCU 线，是成本与风险最可控的路径。

原厂功能对标见 **§0** / 分析文档 **§3**；落地总设计见 **`FlyThings_竞品逆向与重构设计说明.md`**。

---

## 参考资料

1. `中科世为/中科世为UI_IDE分析文档.md`（§3 主要功能）  
2. `中科世为/Linux_HMI_UI_IDE分析与仿制方案.md`  
3. `中科世为/FlyThings_竞品逆向与重构设计说明.md`（L1+L2 兼容重构总设计）  
4. `中科世为/中科世为信息.txt`  
5. https://developer.flythings.cn/zh-hans/docs_brief.html  
6. http://www.zkswe.com/  

---

*本方案为技术架构设计，实施前请结合目标芯片、团队栈与法务要求裁剪。*
