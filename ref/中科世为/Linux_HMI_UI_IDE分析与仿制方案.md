# Linux HMI UI IDE：分析与仿制方案

> **范围**：仅面向 **Linux 系统上的 HMI / 智能串口屏 IDE**（对标中科世为 FlyThings IDE）。  
> **不含**：FlyThings Lite / MCU 平台相关内容。  
> 资料来源：`中科世为信息.txt`、官网、FlyThings 开发文档、公开样例工程及 `.ftu` 格式解析。

---

## 第一部分：原厂 Linux IDE 分析

### 1. 产品定位

FlyThings IDE 是中科世为面向 **裁剪 Linux + 自主 GUI Framework** 的一体化开发环境，提供：

- 所见即所得 UI 设计  
- C/C++ 业务逻辑编写  
- 交叉编译、下载调试  

典型场景：工业 HMI、智能串口屏、仪器面板等——功能相对聚焦，但对稳定性与成本敏感，用来替代 Android 或传统从机串口屏方案。

系统底座公开资料大致为：Linux 3.4 裁剪 + 自主 GUI（EasyUI / ZKGUI）+ 网络/多媒体/OTA 等能力。IDE 与板端运行时强绑定，形成「工具 + OS/框架 + 硬件/SOC」闭环。

---

### 2. 总体架构

```text
┌─────────────────────────────────────────────────────────┐
│              FlyThings IDE（Eclipse CDT + 自研插件）       │
│  项目资源 │ UI 编辑 │ 控件画板 │ 属性表 │ 大纲 │ 控制台      │
└───────────────────────────┬─────────────────────────────┘
                            │ 编辑 ui/*.ftu
                            │ 编译：预处理 UI + 生成代码 + 交叉编译
                            ▼
┌─────────────────────────────────────────────────────────┐
│  生成物：Activity / Logic / libzkgui.so / ui 资源 / 配置   │
└───────────────────────────┬─────────────────────────────┘
                            │ ADB / TF / update.img
                            ▼
┌─────────────────────────────────────────────────────────┐
│  板端：zkgui 宿主 + libeasyui.so + 加载 libzkgui.so       │
│       读 .ftu → 建 ZK* 控件树 → Activity 栈运行           │
└─────────────────────────────────────────────────────────┘
```

核心理念：**UI 文档与业务代码分离**；设计期改控件树，编译期生成骨架，运行期宿主加载应用动态库并 inflate UI。

---

### 2.5 主要功能（Linux IDE）

依据官网、developer.flythings.cn 入门/界面/编译/升级文档与分析文档 §3。完整双产品线表见分析文档；本节仅 Linux HMI IDE。

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| 工作台 | 六区：资源/画布/画板/属性/大纲/控制台 | Eclipse CDT + 自研插件 |
| 工程 | 新建向导（平台、分辨率、旋转、字体、输入法、屏保、串口） | 导入样例包 |
| 设计 | 拖拽、即时预览、绝对坐标、大纲层级 | 多态 color/pic；特殊字符集 |
| 控件 | Button、TextView、Slider、List、Window、滑动窗口、动画等 | 运行时 `ZK*`；可扩展自定义控件 |
| 生成 | `.ftu`→Activity/Logic 增量 | 指针 + `onXxx_ID` 钩子；不覆盖业务 |
| 框架 | Activity 堆栈、生命周期、Intent | 串口协议框架与样例 |
| 编译 | 生成代码 + 交叉编译出 `libzkgui.so` + `ui/*.ftu` | 控制台双击跳错 |
| 部署 | ADB 下载调试；TF 外置启动；**update.img** 固化 | 系统刷机卡另层 |
| 调试 | Log 为主；集成日志叙事 | 非图形断点主路径 |

闭环：**设计 `.ftu` → 写 Logic → 编译 → ADB/TF/update.img → EasyUI 宿主加载 so+ftu**。  
注意：与 LVGL「导出源码上板」不同，FlyThings 是 **专有宿主 + 应用插件** 模型。

---

### 3. UI 拖拽工具实现原理

#### 3.1 IDE 宿主

公开样例工程含 `.project` / `.cproject`，Nature 包括 CDT 与：

```text
com.zksw.ui.editor.core.nature
```

可判定：**Eclipse RCP/CDT 为壳**，中科世为插件 `com.zksw.ui.editor.*` 提供 UI 编辑器。六区对应典型 Eclipse 扩展：资源管理器、自定义 Editor、Palette、PropertySheet、Outline、Console。

#### 3.2 文档模型（设计期真正编辑的对象）

拖拽操作的是内存中的 **控件树**，不是直接改 C++：

```text
Window（分辨率、背景…）
 └─ Control（type / caption / id / position / 样式 / 子节点）
      └─ …
```

- 画板拖入 = 新建节点 + 写 `position`  
- 属性表修改 = 改节点属性 → 画布重绘  
- 大纲拖拽 = 改父子与层级  

**所见即所得** = 画布 / 属性表 / 大纲是同一模型的三个视图。

#### 3.3 持久化：`.ftu` 格式

对公开 `ui/*.ftu` 解析结果：

1. 魔数 **`ZKSW`**  
2. 短二进制头  
3. **zlib 压缩**的 UTF-8 **JSON** 控件树  

JSON 要点（提炼自真实样例）：

| 约定 | 作用 |
|------|------|
| 根对象 | 一页 UI（一个 Activity） |
| `button__1` 等 key | 编码控件类型 + 序号 |
| `caption` | 逻辑名（如 `Button1`），用于生成指针/函数名 |
| `id` | 数值 ID → 编译出宏 |
| `position` | 相对父控件的矩形 |
| `colorTab` / `picTab` | 五态颜色/图片 |

保存：控件树 → JSON → zlib → 加头写 `.ftu`。  
打开：逆过程 → 驱动三视图。

#### 3.4 画布预览

设计期按模型在 Eclipse 画布上近似绘制（坐标、文字、背景图缩略）；列表等数据控件通常只显示模板。真机一致性靠同一套属性语义与资源路径约定。

#### 3.5 编译期：文档 → 代码

「编译」= UI 预处理 + 模板代码生成 + 源码编译：

| 输入 | 输出 |
|------|------|
| `main.ftu` | `mainActivity.h/.cpp`（控件指针、初始化，勿手改） |
| 同上 | `mainLogic.cc`（**增量**生成事件/生命周期钩子，业务写这里） |
| 工程 | 交叉编译得到 `libzkgui.so` 等 |

增量规则：新增控件补钩子；删除控件**保留**旧钩子（防丢代码）；改名当新增。  
事件靠约定：`caption` → `onButtonClick_Button1`，不是可视化连线。

运行时控件继承 **`ZKBase`**（`ZKButton` 等），设计期属性与运行期 API 同构。

---

### 4. 界面运行模型（Linux 板端）

- **Activity 栈**：`openActivity` / `goBack` / `goHome`；生命周期 `onUI_init/show/hide/quit`、`onUI_intent`、定时器、触摸拦截等  
- **串口模型**：屏端常作**主机**（带逻辑），区别于传统从机串口屏；工程生成协议框架，解析后回调 `onProtocolDataUpdate`  
- **调试**：以 Log 为主；ADB（USB 或 Wi‑Fi IP）下载  

---

### 5. IDE 生成物

#### 5.1 工程内（源码侧）

| 产物 | 路径（典型） | 手改 | 作用 |
|------|----------------|------|------|
| Activity | `src/activity/*` | 否 | 指针声明、控件创建与初始化 |
| Logic | `src/logic/*Logic.cc` | **是** | 业务与事件 |
| 串口框架 | `src/uart/*` | 按协议改 | 通讯模板 |
| 入口 | `Main.cpp` | 可 | `onEasyUIInit` / `onStartupApp` |
| 中间文件 | `obj/`、`libs/` | 否 | 增量编译缓存 |

#### 5.2 可部署运行包（下到设备）

```text
EasyUI.cfg
ui/                 ← *.ftu + 图片等资源
lib/libzkgui.so     ← 用户应用（逻辑+界面绑定）
font/               ← 可选
```

量产还可打成 **`update.img`**。

分工：

- `.ftu` + 图片 → 界面数据  
- `libzkgui.so` → 你的 C/C++ 应用  
- 机内 `zkgui` + `libeasyui.so` → 宿主与 GUI 框架  

---

### 6. 下载与运行原理

#### 6.1 板端启动

```text
上电 → 启动 zkgui
  → 加载 libeasyui.so
  → 读 EasyUI.cfg
  → dlopen libzkgui.so
  → onEasyUIInit() / onStartupApp() → "mainActivity"
  → 加载 ui/*.ftu，建控件树，进入界面循环
```

形态是 **宿主进程 + 插件 so + UI 资源**，不是整包替换 Linux。

#### 6.2 三种部署方式

| 方式 | 做法 | 特点 |
|------|------|------|
| **下载调试（ADB）** | IDE 编译后 push 运行包；优先落到 TF（如 `/mnt/extsd`） | 快；**默认不固化**，断电/拔卡常恢复原程序 |
| **TF/U 盘启动** | 输出 `EasyUI.cfg`+`ui`+`lib` 到卡 | 无 ADB 可验；外置优先启动 |
| **update.img 升级** | 打包镜像，TF 升级界面或 ADB `setprop` 触发 | **固化**到设备内部，量产路径 |

---

### 7. 特点与优劣（Linux 线）

**特点**

- 模型驱动三视图；专有 `.ftu`；绝对坐标 + 五态资源；约定式事件生成  
- UI/逻辑解耦；智能屏主机逻辑；国产框架闭环  

**优点**

- 工控 UI 开发效率高  
- 文档与运行时同构，设计≈真机路径清晰  
- so 插件模型便于只更新应用层  

**缺点**

- 专有格式与闭源 GUI，平台锁定强；`.ftu` 不利于 Git diff  
- 调试偏日志；删除控件残留钩子需人工治理  
- 内核/生态相对小众；深度定制与迁移成本高  

---

## 第二部分：Linux 仿制方案（自研设计）

> 仿的是**架构范式**，不是闭源二进制、加密库或 `ZKSW` 格式兼容。

### 8. 目标与边界

#### 8.1 MVP 能力

| 能力 | 说明 |
|------|------|
| 拖拽设计 | 画板 + 属性表 + 大纲，绝对坐标 |
| 文档持久化 | 明文 `.hmui` JSON（量产包可再压缩） |
| 增量 CodeGen | Activity 骨架 + Logic 钩子，保护用户代码 |
| C/C++ 业务 | 控件句柄 API |
| 主机预览/模拟 | 设计期画布 + 桌面模拟器 |
| 一键部署 | 打包 `app.so` + ui + 配置，ADB/TF 下载 |
| 基础控件 | Button / Label / Image / Slider / Panel / List（模板） |

#### 8.2 不做

- 不仿整机 OS、云平台、芯片授权水印  
- 不做 MCU 线  
- 不追求与 FlyThings 工程互通  
- 运行时优先开源 **LVGL**（或协议清晰的替代），避免闭源锁定  

#### 8.3 产品形态

```text
自研 IDE（设计器 + 工程 + CodeGen + 打包下载）
    + 板端 Loader（dlopen app.so）
    + GUI 引擎（推荐 LVGL）
```

差异化建议：明文 JSON、Git 友好、现代 IDE 壳（VS Code / Tauri）、开源运行时可选。

---

### 9. 仿制总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│  Host IDE：工程管理 │ Designer │ CodeGen │ Build │ Deploy│Log │
└─────────────┬──────────────────────────────┬─────────────────┘
              │ .hmui                        │ cmake 交叉编译
              ▼                              ▼
     UI Document Model              generated/ + logic/ + main
                                             │
                                             ▼
                                out/: runtime.cfg + libapphmi.so + ui/
                                             │ ADB / TF / 升级包
                                             ▼
                                Board: hmi_loader + GUI + inflate
```

**三条不变量：**

1. 设计期只编辑控件树文档  
2. 编译期文档 → 代码骨架 + 资源包  
3. 运行期 Loader 加载 so + 按文档建树  

---

### 10. 技术选型（仅 Linux）

| 层 | 推荐 | 备选 |
|----|------|------|
| IDE 壳 | VS Code 扩展 + Webview 设计器 | Tauri/Electron 独立 IDE；Eclipse（不推荐除非已有积累） |
| 设计器 UI | React + Canvas/Konva | — |
| UI 文件 | 明文 `.hmui` JSON | MessagePack（次选） |
| 运行策略 | **文档 + Inflater（S2）** | 纯导出 LVGL C 代码（更不像原厂，增量难） |
| GUI 引擎 | **LVGL**（fb/drm 等） | 自研轻量 GUI；Qt/Slint（授权与体积另评） |
| 应用形态 | `libapphmi.so` + `hmi_loader` | 静态链单个可执行（调试简单，热更弱） |
| 部署 | ADB push / TF 目录 / 自研升级包 | — |

---

### 11. 模块设计

#### 11.1 文档模型

```ts
type Rect = { left: number; top: number; width: number; height: number };

type ControlNode = {
  type: "button" | "label" | "image" | "slider" | "panel" | "list" | string;
  name: string;       // C 标识符，对应原 caption
  id: number;
  position: Rect;
  visible: boolean;
  touchable: boolean;
  props: Record<string, unknown>;
  children?: ControlNode[];
};

type PageDoc = {
  version: 1;
  name: string;
  resolution: { width: number; height: number };
  root: ControlNode;
};
```

相对原厂改进：用 `children` 数组，不用 `button__1` 这种 key；扩展名 `.hmui`；默认明文便于 diff。

#### 11.2 设计器

- 单一模型 + Canvas / PropertyGrid / Outline  
- 控件注册表：默认属性、设计期绘制器、属性 schema、事件元数据  
- 命令模式 + Undo  
- 网格/对齐（工控刚需）  

#### 11.3 工程模板

```text
MyHmiApp/
├── project.json
├── ui/*.hmui
├── assets/
├── src/
│   ├── generated/     # 勿手改
│   ├── logic/         # 用户业务
│   ├── protocol/
│   └── main.c
├── build/
└── out/
    ├── runtime.cfg
    ├── libapphmi.so
    └── ui/
```

#### 11.4 CodeGen 与增量规则

生成：`ui_ids.h`、`*_activity.*`（inflate + 句柄表）、`*_logic.c`（钩子）。

| UI 变更 | 行为 |
|---------|------|
| 新增 | 补钩子（若不存在） |
| 删除 | 保留旧钩子，告警孤儿函数 |
| 改名 | 当新增；旧钩子保留并告警 |
| 仅样式 | 不动 Logic |

可选增强：显式「清理孤儿钩子」命令。

#### 11.5 运行时分层

```text
用户 API（button/label 指针风格）
    → Inflater（读 .hmui 建树）
    → Backend（LVGL / 模拟器 SDL）
```

启动序：

```text
hmi_loader → 读 runtime.cfg → dlopen libapphmi.so
  → app_on_init() → app_startup_screen()
  → inflate ui/xxx.hmui → 输入/刷新循环
```

#### 11.6 构建与部署

- IDE 调用 cmake/ninja + 板级工具链（`project.json` 配置）  
- 调试：ADB 推到 `/mnt/extsd/hmi` 或 `/tmp/hmi`，重启 loader  
- 外置启动：整包写 TF，loader 优先外置目录  
- 固化：自研 `update.tar`/`img` + 板端升级服务  

#### 11.7 桌面模拟器（建议 MVP 就做）

同一 Inflater + LVGL 桌面端口编译主机版 `libapphmi`，减少刷机次数，并验证文档模型。

---

### 12. 控件与事件（最小集）

通用属性：`name, id, position, visible, touchable, bg_color, bg_image`  
可选五态：`normal / pressed / selected / selected_pressed / disabled`

| 控件 | 钩子 |
|------|------|
| button | `on_button_click_<Name>` |
| slider | `on_slider_changed_<Name>` |
| list | `on_list_bind_<Name>` / `on_list_item_click_<Name>` |
| page | `on_page_init/show/hide/quit_<Page>` |

---

### 13. 实施分期（仅 Linux）

| 阶段 | 周期（参考） | 交付 |
|------|----------------|------|
| **P0 骨架** | 2–3 周 | `.hmui` schema、CLI codegen、LVGL 桌面 Inflater Demo |
| **P1 设计器** | 4–8 周 | 拖拽三视图、Button/Label/Image/Panel、增量 Logic、主机一键模拟 |
| **P2 板端闭环** | 4–6 周 | 交叉编译 `libapphmi.so`、loader、ADB/脚本部署、串口模板与日志 |
| **P3 工程化** | 持续 | List/Slider、多页面栈、字体/多语言、升级包、CI 与模拟器截图回归 |

**不做 P4 MCU。**

人员粗估：工具前端 1–2、CodeGen/工程 1、嵌入式 GUI 1–2、板级/部署 1。  
到可内测：**约 4–6 人月**；到工业可用：**约 10–14 人月**（无 MCU 线，略低于双产品线估算）。

---

### 14. 验收 Demo（Linux）

1. 设计器做出开机页：背景 + 2 按钮 + 1 文本  
2. 主机模拟器可点击改文本  
3. ADB 部署到 Linux HMI 板，行为一致  
4. 再改 UI 样式/位置，Logic 中用户计数逻辑不丢失  
5. 打升级包，重启后仍为新应用  

---

### 15. 风险

| 风险 | 对策 |
|------|------|
| 预览 ≠ 真机 | 设计期与板端共用 Inflater；关键页强制模拟器回归 |
| CodeGen 破坏业务代码 | GENERATED 标记区；合并前备份；孤儿钩子告警 |
| 运行时绑死某一 GUI | Backend 接口隔离 |
| IP | 自研格式与品牌；非法务审过的依赖不进产品 |
| 做成「小 OS」失控 | 只做工具链 + loader + GUI，驱动/BSP 交给芯片 SDK |

---

### 16. 与原厂对照（Linux）

| 维度 | FlyThings IDE | 本仿制方案 |
|------|---------------|------------|
| IDE 壳 | Eclipse CDT | VS Code / Tauri |
| UI 文件 | `ZKSW`+zlib+JSON `.ftu` | 明文 `.hmui` JSON |
| 设计模型 | 控件树 | 同构（children 更清晰） |
| 业务代码 | Logic 增量钩子 | 同构 |
| 应用形态 | `libzkgui.so` + EasyUI | `libapphmi.so` + 自研 loader |
| GUI | 闭源 EasyUI | LVGL（推荐） |
| 部署 | ADB / TF / update.img | 同构流程，格式自研 |
| 原厂工程兼容 | — | **不兼容** |

---

## 17. 总结

**原厂 Linux IDE 本质：**

> Eclipse 上编辑 zlib+JSON 的控件树（`.ftu`）→ 增量生成 Activity/Logic → 交叉编译为 `libzkgui.so` → 板端 `zkgui` 加载 so 并 inflate UI；ADB/TF 调试，`update.img` 固化。

**主要功能面**见 **§2.5** / 分析文档 **§3**（六区设计、ZK* 控件、增量生成、Activity、串口、三级部署等）。

**自研仿制应抓住的链路：**

> **控件树文档 ↔ 可视化三视图 ↔ 增量 Logic ↔ Loader+so+Inflater ↔ ADB/卡/升级包**

推荐落地组合：**明文 `.hmui` + LVGL + VS Code/独立设计器 + `libapphmi.so` 插件模型**，只做 Linux HMI，先打通单页 Demo 闭环，再扩展控件与多页面。公开能力应用工程闭环兑现，**不兼容** `.ftu`/EasyUI。落地总设计见 **`FlyThings_竞品逆向与重构设计说明.md`**。

---

## 参考资料

1. `中科世为/中科世为信息.txt`  
2. `中科世为/中科世为UI_IDE分析文档.md`（§3 主要功能）  
3. `中科世为/FlyThings风格UI_IDE仿制方案.md`（§0 功能对标）  
4. `中科世为/FlyThings_竞品逆向与重构设计说明.md`  
5. http://www.zkswe.com/  
6. https://developer.flythings.cn/zh-hans/docs_brief.html  
7. https://developer.flythings.cn/zh-hans/flythings_ide_layout_introduce.html  
8. https://developer.flythings.cn/zh-hans/ftu_and_source_relationships.html  
9. https://developer.flythings.cn/zh-hans/project_structure.html  
10. https://developer.flythings.cn/zh-hans/adb_debug.html  
11. https://docs.flythings.cn/zh-hans/start_from_sdcard.html  
12. https://docs.flythings.cn/zh-hans/make_image.html  
13. https://docs.flythings.cn/zh-hans/ctrl_common.html  
14. https://docs.flythings.cn/zh-hans/activity_life_cycle.html  
15. 样例 [SampleUI](https://github.com/3guoyangyang7/SampleUI)（Eclipse nature、`.ftu`、部署脚本）  

---

*本文仅覆盖 Linux HMI IDE；MCU/Lite 不在范围内。实施前请结合目标芯片、团队技术栈与法务要求裁剪。*
