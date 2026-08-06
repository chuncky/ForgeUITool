# 中科世为 UI IDE 工具分析文档

> 基于《中科世为信息.txt》、官方网站（zkswe.com）、FlyThings 开发文档及公开技术资料整理。  
> 分析对象：**FlyThings IDE**（Linux/HMI 平台）与 **FlyThings Lite IDE**（MCU 平台）。

---

## 1. 背景与产品定位

深圳市中科世为科技有限公司成立于 2017 年，核心团队长期从事人机界面（HMI）开发。公司主打嵌入式界面系统 **FlyThings**，面向工业 HMI、串口屏、授权方案及 SOC 芯片厂商，提供「操作系统 + GUI 框架 + 可视化 IDE」一体化方案。

截至公开资料（约 2020 年底），使用 FlyThings OS 的企业用户已超 1000 家，出货量近千万级，覆盖工业自动化、医疗仪器、汽车仪表、充电桩、电梯、智能家电、军工等行业。产品卖点之一是国产可控，降低对进口 GUI/OS 方案的依赖。

中科世为的「UI IDE」并非单一编辑器，而是两套面向不同硬件层级的可视化开发工具链：

| 产品 | 目标平台 | 核心形态 |
|------|----------|----------|
| **FlyThings IDE** | 基于 Linux 的 HMI / 智能串口屏 / SOC | 所见即所得 UI + C/C++ 业务逻辑 + 编译下载调试一体 |
| **FlyThings Lite IDE** | M0 及以上 MCU（ST、GD、华芯微特、雅特力、博流等） | 所见即所得 UI + OpenCPU 二次开发 + PC 模拟器 |

二者共享「拖拽布局 + 代码生成 + 业务填空」的开发范式，运行底座不同：前者依赖裁剪 Linux + 自主 Framework，后者以极低资源占用运行在 MCU 上。

---

## 2. 实现原理

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                   FlyThings IDE / Lite IDE              │
│  项目资源管理 │ UI 编辑 │ 控件画板 │ 属性表 │ 大纲 │ 控制台   │
└───────────────────────────┬─────────────────────────────┘
                            │ 设计期：编辑 .ftu / .form
                            │ 编译前：增量生成 Logic / Activity
                            ▼
┌─────────────────────────────────────────────────────────┐
│              代码生成层（增量、非全量覆盖）                 │
│  UI 描述 ──► 控件指针声明（Activity）                     │
│           ──► 生命周期 / 事件回调骨架（Logic）              │
│           ──► 串口协议框架模板（ProtocolParser 等）        │
└───────────────────────────┬─────────────────────────────┘
                            │ 开发者填写业务逻辑
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    运行时 Framework                       │
│  Activity 栈 │ 控件树渲染 │ 定时器 │ 触摸分发 │ 协议通知   │
└───────────────────────────┬─────────────────────────────┘
                            ▼
        ┌───────────────────┴───────────────────┐
        │ FlyThings OS（Linux 3.4 裁剪）         │ Lite Runtime（MCU）
        │ GUI / 网络 / 多媒体 / OTA / 推送      │ 2K RAM / 16K Flash 级占用
        └───────────────────────────────────────┘
```

核心理念：**UI 与业务代码分离**。界面以可视化描述文件保存，编译链在真正编译源码前，根据 UI 文件自动生成/增量更新配套 C/C++ 骨架；开发者只在指定逻辑文件中写业务，通过控件指针操作界面。

---

### 2.2 UI 拖拽工具的实现原理（核心）

此前公开资料多描述「能拖控件、能预览」，较少说明**设计器本身如何工作**。结合官方文档行为、开源样例工程（含 `.project` / `.ftu`）与对 `.ftu` 文件的格式解析，可将拖拽工具拆成五层理解。

#### （1）IDE 宿主：Eclipse CDT + 自研 UI 编辑器插件

公开样例工程根目录存在 Eclipse 工程文件 `.project` / `.cproject`，工程 Nature 除标准 CDT（`org.eclipse.cdt.core.cnature` 等）外，还包含：

```text
com.zksw.ui.editor.core.nature
```

这基本可判定：**FlyThings IDE 以 Eclipse RCP/CDT 为壳**，中科世为自研插件（包名 `com.zksw.ui.editor.*`，zksw = 中科世为）负责：

| IDE 区域 | 对应 Eclipse 常见扩展点角色 | 职责 |
|----------|------------------------------|------|
| 项目资源管理器 | Navigator / Project Explorer | 管理 ui / resources / src |
| UI 编辑框 | 自定义 Editor（关联 `.ftu`） | 画布拖拽、选中、即时预览 |
| 控件画板 | Palette / View | 控件类型工厂入口 |
| 属性表 | PropertySheet | 绑定当前选中控件的属性字典 |
| 大纲视图 | Outline | 控件树层级、拖拽改父子、显隐 |
| 控制台 | Console | 编译与代码生成日志 |

也就是说，拖拽工具**不是**从零写的独立 GUI 程序，而是「Eclipse 工作台 + 自定义可视化编辑器 + CDT 编译链路」的组合；这解释了其界面布局与典型 Eclipse 插件 IDE 高度相似的原因。

#### （2）文档模型：内存中的「控件树」，而不是直接改 C++ 代码

拖拽过程操作的是**设计期文档对象模型（DOM）**，不是运行时代码：

```
Window（根页面，带 resolution）
 └─ ControlNode（type / caption / id / position / 样式 / 子节点…）
      └─ ControlNode
           └─ …
```

用户在画板上拖入「按键」时，编辑器实际执行的是：

1. 根据控件类型（Button / TextView / List…）**实例化节点**，写入默认属性；
2. 按落点坐标写入 `position{left,top,width,height}`（相对**父控件**左上角）；
3. 分配设计名 `caption`（如 `Button1`，须符合 C 标识符，供代码生成）与数值 `id`（如 `20001`）；
4. 把节点挂到当前父节点（默认根窗口，或大纲里指定的容器）；
5. **刷新画布重绘** + **刷新大纲树** + 若已选中则刷新属性表。

属性表修改（文字、颜色、背景图、五态图等）= 改节点属性字典 → 触发画布重绘。  
大纲拖拽改层级 = 改树的父子关系与 z-order。  
双击大纲显隐 = 改 `visible` 标志。

因此「所见即所得」的本质是：**画布是文档模型的渲染视图（View），属性表/大纲是同一模型的另外两个视图；拖拽只是对模型的编辑命令。**

#### （3）持久化格式：`.ftu` = `ZKSW` 头 + zlib 压缩的 JSON 控件树

对公开样例中的 `ui/*.ftu` 解析可得（事实证据）：

1. 文件以魔数 **`ZKSW`** 开头（中科世为拼音缩写）；
2. 其后为短二进制头；
3. 主体为 **zlib 压缩**数据；
4. 解压后是 **UTF-8 JSON**，描述整页 UI。

解压后的结构示意（来自真实 `testButton.ftu` 提炼）：

```json
{
  "resolution": { "width": 800, "height": 480 },
  "position": { "left": 0, "top": 0, "width": 800, "height": 480 },
  "backgroundColor": -1,
  "backgroundPic": "welcom.png",
  "visible": true,
  "button__1": {
    "caption": "Buttonbg",
    "id": 20004,
    "text": "ON",
    "position": { "left": 202, "top": 94, "width": 50, "height": 50 },
    "colorTab": { "color0": 16777215, "color1": -1, "...": "五态文字色" },
    "picTab":   { "pic0": "buttonnormal.png", "pic1": "select.png", "...": "五态图片" },
    "touchable": true,
    "visible": true
  },
  "textview__4": {
    "caption": "Textsw",
    "id": 50000,
    "text": "OFF",
    "position": { "left": 279, "top": 172, "width": 80, "height": 32 }
  }
}
```

关键约定：

| 字段/约定 | 作用 |
|-----------|------|
| 根对象 | 一页 UI（一个 Activity / 一个窗口） |
| `类型名__序号` 作为子节点 key | 如 `button__1`、`textview__4`、`slidewindow__1`，编码控件类型 |
| `caption` | 逻辑名（`Button1`），用于生成 `mButton1Ptr`、`onButtonClick_Button1` |
| `id` | 数值 ID，编译后生成 `ID_MAIN_Button1` 等宏 |
| `position` | 矩形布局；子控件相对父控件 |
| `colorTab` / `picTab` | 对应正常/按下/选中/选中按下/无效等**五态**资源 |
| 嵌套对象 | 容器控件（Window / List Item 等）继续挂子节点 |

**保存路径**：内存控件树 → JSON 序列化 → zlib 压缩 → 加 `ZKSW` 头写入 `.ftu`。  
**打开路径**：读 `.ftu` → 解压 → 反序列化为控件树 → 驱动画布/大纲/属性表。

Lite 线使用 `.form` 后缀，交互模型与分区一致（画板/属性/大纲/模拟器），可视为同一设计器范式在 MCU 工具链上的变体；运行时打包方式不同（生成烧录资源 + 用户 `src`），但「拖拽编辑文档模型」的原理同类。

#### （4）画布「即时预览」如何画出来

设计期预览**不必**在 PC 上跑完整 Linux GUI 栈，常见实现路径（与文档行为吻合）是：

```
控件树模型
   → 按类型查「设计期绘制器 / 控件元数据」
   → 在 Eclipse 画布（SWT/GC 或等价）上按 position 画矩形、文字、背景图缩略
   → 选中态画焦点框；拖拽时更新 position 并重绘
```

与真机一致性来自：

- 同一套属性语义（坐标、五态图、对齐、字体大小等）；
- 资源路径约定（`resources/` 下图片在设计期与运行期共用相对名）；
- 页面 `resolution` 决定画布逻辑分辨率。

差异点：列表等数据驱动控件在设计期往往只显示 Item 模板；真实条目内容要等运行时 `getListItemCount` / `obtainListItemData` 回调填充——这也是「预览近似所见即所得、动态数据非完全模拟」的原因。Lite 的 **PC 模拟器**则更进一步，在主机上跑接近运行时的渲染/事件循环，用于减少刷机次数。

#### （5）从拖拽文档到可运行程序：编译器式流水线

官方明确：所谓「编译」= **UI 预处理 + 模板代码生成 + 源码编译**。对应拖拽工具的后端流水线：

```
.ftu (ZKSW+zlib+JSON)
        │
        ▼
   解析控件树（遍历所有 type__n 节点）
        │
        ├─► Activity.h/cpp（建议勿手改）
        │     · 声明 mCaptionPtr 控件指针
        │     · onCreate 中按 JSON 属性创建/初始化 ZK* 控件
        │     · 生成 ID_xxx 宏；#include "logic/xxxLogic.cc"
        │
        ├─► Logic.cc（增量合并，保留用户代码）
        │     · 生命周期钩子骨架
        │     · 按控件类型追加事件函数
        │       Button → onButtonClick_Caption
        │       SeekBar → onProgressChanged_Caption
        │       List → getListItemCount / obtainListItemData / onListItemClick
        │
        └─► 运行时资源
              · build/*.ftu、图片资源打包
              · 链入 libzkgui.so / EasyUI（样例工程可见）
              · 下载到屏或生成 update.img
```

运行时控件统一继承基类 **`ZKBase`**（`ZKButton`、`ZKTextView`、`ZKListView`…），设计期 JSON 属性与运行期 `setPosition` / `setBackgroundPic` / `setSelected` 等 API **同构**，保证「属性表里填的」和「代码里改的」是同一套对象模型。

事件绑定不是在设计器里画连线，而是：

> **约定优于配置**：控件类型 + `caption` → 固定函数名；编译器生成空函数，开发者往里面填业务。

这与纯组态屏「属性里绑指令」不同，也与 LVGL UIBuilder「导出大段布局 C 代码」不同——FlyThings 选择 **文档模型持久化 + 增量钩子生成**。

#### （6）拖拽工具原理一句话总结

> **Eclipse 插件提供画板/属性/大纲三视图；内存控件树为单一数据源；以 `ZKSW`+zlib+JSON 的 `.ftu` 持久化；编译期遍历该树生成 Activity/Logic 与运行时资源；设备上由 EasyUI/ZKGUI 按同一模型实例化 `ZK*` 控件树并响应事件。**

```
[控件画板] --create--> [控件树模型] <--edit-- [属性表/大纲/拖拽]
                            │
                     save .ftu / open
                            │
                     compile & codegen
                            ▼
                   [ZK* 运行时控件树]
```

---

### 2.3 FlyThings IDE（Linux/HMI 线）实现机制（业务与运行时）

#### （1）UI 描述与工程结构

- 界面文件位于工程 `ui` 目录，扩展名为 **`.ftu`**（格式见上一节）。
- 每个 UI 页面对应一套生成物，命名前缀一致，例如：
  - `main.ftu` → `mainActivity.cpp` / `mainLogic.cc`
- IDE 布局典型分为六区：项目资源管理器、UI 编辑预览区、控件画板、属性表、大纲视图、控制台。

#### （2）编译前代码生成（关键路径）

真正源码编译前，工具会：

1. 遍历所有 `.ftu`，解析其中控件；
2. 在对应 `Activity.cpp` 中声明**静态全局控件指针**（如 `mButton1Ptr`），并在 `onCreate` 中完成初始化；
3. 增量生成/更新 `Logic.cc`：生命周期回调、定时器表、串口回调、触摸回调，以及按控件 ID 生成的事件函数（如 `onButtonClick_Button1`）；
4. `Activity.cpp` 通过 `#include "logic/mainLogic.cc"` 把业务逻辑编入 Activity。

要点：**Logic.cc 采用增量修改，而非每次全量覆盖**，以保护开发者已写业务代码。

| UI 变更 | 工具行为 |
|---------|----------|
| 新增控件 | 按 ID 生成关联函数；若已存在则跳过 |
| 删除控件 | **保留**旧关联函数（避免误删业务代码） |
| 改属性（非 ID） | 不影响关联函数 |
| 改控件 ID | 按「新增」处理，旧函数保留 |

控件 ID 必须符合 C 语言标识符规范，因为会直接进入函数名与指针名。

#### （3）Activity 栈与界面生命周期

运行时借鉴移动端 Activity 模型：

- `openActivity` 打开界面，后开的界面在栈顶；
- `goBack` / `goHome` / `closeActivity` 管理回退与关闭；
- 逻辑侧典型回调：
  - `onUI_init`：首次创建并初始化控件后调用
  - `onUI_intent`：接收打开界面时传入的数据
  - `onUI_show` / `onUI_hide`：显示/隐藏
  - `onUI_quit`：退出并释放资源
  - `onUI_Timer`：定时器
  - `onProtocolDataUpdate`：串口协议数据更新
  - 全局触摸拦截回调

这使多页面导航、参数传递、资源回收有统一约定，而不是散落的全局状态机。

#### （4）串口通讯模型（与传统串口屏的本质差异）

传统串口屏多为**从机**：MCU 发指令，屏只负责显示。  
FlyThings 智能屏侧具备完整逻辑，通常作为**主机端**：屏端实现交互与协议解析，通过串口与外设/从 MCU 协同。

新建工程时 IDE 自动生成串口通讯框架；协议解析（如 `ProtocolParser.cpp`）需按项目协议改写，解析结果通过监听器分发到各界面的 `onProtocolDataUpdate`。业务侧更多关心「数据如何刷新到 UI」，而非底层收发细节。

#### （5）系统底座

- 内核：开源 **Linux 3.4** 裁剪优化，面向物联网/HMI；
- 自主 GUI Framework、网络 API、多媒体、物联网/支付接入、远程更新与消息推送；
- 调试：以 **Log 日志**为主（文档明确目前主要通过加日志调试）；WiFi 机型可通过配置 ADB IP 下载运行；
- 发布：普通下载调试 vs 制作 `update.img` 固化镜像 vs SD 刷机卡升级系统。

### 2.4 FlyThings Lite IDE（MCU 线）实现机制

Lite 面向资源极度受限的 MCU，实现路径与 Linux 版同构但更轻：

1. **所见即所得**：同一套「控件树 + 画板/属性/大纲」拖拽模型；UI 文件多为 `.form`；
2. **PC 模拟器**：在主机跑接近运行时的渲染与事件，减少反复烧录 Flash；
3. **OpenCPU**：开放 MCU 代码给用户，可直接操作硬件外设，相对传统「外挂 MCU + 从机串口屏」可省掉一颗控制 MCU；
4. **资源目标**：约 **2K RAM、16K Flash** 级框架占用；
5. **图片压缩**：自有 BITMAP 编解码，公开宣传压缩率可达约 **90%**，缓解 Flash 压力；
6. **跨平台移植**：同一套 IDE/UI 流程适配多家 MCU（ST、GD、华芯微特、雅特力、博流等）；部分芯片厂提供适配包（UI 生成产物拷贝进工程 `uifun` 等目录，再配合 Keil/GCC 编译）。

Lite 的本质是：**把同一套可视化文档模型下沉到 MCU 图形栈**，用压缩资源与模拟器换取可量产的低成本彩色界面。

### 2.5 开发闭环（两套 IDE 共性）

```
拖拽/改属性设计 UI
        ↓
编译触发：增量生成控件指针 + 事件/生命周期骨架
        ↓
在 Logic（或等价用户代码区）填写业务、改协议解析
        ↓
PC 模拟（Lite）或下载到屏/板（IDE + ADB/串口）
        ↓
Log 观察 → 迭代 UI / 逻辑 → 固化镜像或量产烧录
```

业务 API 风格面向对象指针调用，例如：

```cpp
mTextTimePtr->setText("00:00");
mTextTimePtr->setTextColor(0x00FF00);
mButtonbgPtr->setSelected(false);

static bool onButtonClick_Buttonsw(ZKButton *pButton) {
    return true;
}
```

### 2.6 IDE 生成物与「下载运行」原理

#### （1）编译一次，实际产出两类东西

FlyThings 的「编译」= **UI 预处理 / 代码生成** + **交叉编译链接**。产物可分成「工程内源码生成物」和「可部署运行包」。

**A. 工程内生成物（给人改 / 给编译器用）**

| 产物 | 路径（典型） | 是否手改 | 作用 |
|------|----------------|----------|------|
| Activity 源码 | `src/activity/*Activity.h/.cpp` | 否（自动覆盖） | 按 `.ftu` 声明控件指针、在 `onCreate` 里创建/初始化控件、挂生命周期 |
| Logic 骨架 | `src/logic/*Logic.cc` | **是（业务写这里）** | 增量生成事件/定时器/串口等钩子；已有函数不覆盖 |
| 串口框架 | `src/uart/*` | 按协议改 | 收发与解析模板 |
| 入口 | `src/Main.cpp` | 可改 | 导出 `onEasyUIInit` / `onStartupApp`，指定启动 Activity |
| 中间目标文件 | `obj/`、`libs/` | 否 | CDT 增量编译缓存 |

**B. 可部署运行包（真正下载到设备上的）**

样例工程的打包脚本与官方「TF 卡启动」文档一致，部署目录大致为：

```text
<部署根>/
├── EasyUI.cfg          # 运行配置（调试包常用 EasyUIdebug.cfg 改名）
├── ui/                 # UI 描述 + 资源
│   ├── *.ftu           # 编译输出的界面文件（来自 build/*.ftu）
│   └── ...             # resources/ 下的图片等资源被拷到此处
├── lib/
│   └── libzkgui.so     # ★ 用户应用：UI 逻辑 + Activity/Logic 编成的动态库
└── font/               # 可选字体
```

对应关系一句话：

> **`.ftu` + 图片 = 界面数据；`libzkgui.so` = 你的 C/C++ 业务；系统里的 `zkgui` + `libeasyui.so` = 加载器与 GUI 框架。**

部分 SOC/方案文档还会区分：

- **评估版** `libeasyui.so`：可跑，界面带 FlyThings 水印；
- **授权版** `libeasyui.so`：加密，需按设备 UUID 授权后量产使用。

制作量产包时，IDE 还可把上述编译结果打成 **`update.img`** 升级镜像。

#### （2）设备上如何跑起来（Linux / 智能屏线）

运行模型是 **「宿主进程 + 插件 so + UI 资源」**，不是把整个应用编成一个独立 ELF 替换系统：

```text
上电 / 启动
    │
    ▼
系统启动 zkgui（或同类宿主，厂商预置在 /customer/bin 等）
    │
    ├─ 加载 libeasyui.so（EasyUI 框架：控件、Activity 栈、渲染、输入…）
    ├─ 读 EasyUI.cfg（资源路径、调试/正式配置等）
    ├─ dlopen 加载 libzkgui.so（你的应用）
    │     · 调用 onEasyUIInit()     → 如开串口
    │     · 调用 onStartupApp()     → 返回 "mainActivity"
    ├─ 从 ui/ 加载对应 *.ftu + 图片资源
    └─ 创建 Activity / ZK* 控件树，进入界面循环
```

因此：

- 改界面/逻辑后，多数时候只需更新 **`libzkgui.so` + `ui/`**，宿主 `zkgui` 可不变；
- 设计期 JSON 控件树与运行期加载的 `.ftu` 同源，Activity 里按属性建控件，Logic 里填事件。

#### （3）「下载调试」在传什么、写到哪里

IDE 菜单 **下载调试**（快捷键 `Ctrl+Alt+R`）流程：

1. 先自动编译（代码生成 + 出 `libzkgui.so` / `build/*.ftu` 等）；
2. 通过 **ADB**（USB 或 Wi‑Fi/以太网填 IP）把运行包推到设备；
3. 设备侧重启/刷新应用进程，加载新 so 与 ui 资源。

官方要点：

| 项 | 说明 |
|----|------|
| 连接 | USB（识别为 Android/ADB 设备）或网络 ADB（同一网段，IDE 填设备 IP） |
| 推送内容 | `resources` 及必要文件（即 ui 资源 + 库等运行包） |
| 落盘位置 | **优先 TF 卡**（如 `/mnt/extsd`）；无卡则进机器内存，易 OOM |
| 持久性 | **下载调试默认不固化**；拔卡或断电重启后往往恢复成机内原程序 |
| 只读分区 | ext4 只读时需改 ADB 下载目录到 `/tmp`，或 `remount` 后再推 |

所以「下载运行」≈ **ADB 热替换应用插件与资源，让当前会话跑上新版本**，不是刷整机系统。

#### （4）三种把程序弄到设备上的方式（对比）

```text
① 下载调试（ADB）
   IDE → adb push 运行包 → 临时目录/TF → 立即跑
   特点：快；默认不固化

② TF/U 盘启动
   IDE 把 EasyUI.cfg + ui + lib(+font) 输出到卡盘符
   插卡上电 → 系统发现卡内程序 → 优先跑卡里的，而不是机内固化版
   特点：无 ADB 也能验；仍偏「外置启动」

③ 制作 update.img 升级（固化）
   IDE 打包 → update.img
   · TF 卡升级界面勾选升级，或
   · ADB：push img → setprop sys.zkupgrade.* → ctl.restart zkswe
   特点：写入设备内部；上电默认启动该程序（量产路径）
```

系统级大版本/开不了机等场景，另有官方 **SD 刷机卡**（整机系统镜像），与「只升级应用 update.img」不同层。

#### （5）FlyThings Lite（MCU）生成物与运行差异

Lite 不是 `libzkgui.so` 模型，大致是：

| 产物 | 作用 |
|------|------|
| `.form` 等 UI 描述 + 生成的 UI 资源/烧录数据 | 给 MCU 图形库显示 |
| 生成/导出的 `src`（控件访问与逻辑接口） | 拷入用户 Keil/GCC 工程 |
| PC 模拟器可执行结果 | 本机预览，少刷 Flash |
| 串口下载的固件/资源 | 经 IDE 配置的串口烧到 MCU |

运行原理：**MCU 上电跑用户固件**；固件内链 Lite 运行时，加载已生成的 UI 资源并回调用户逻辑。无 Linux、`zkgui`、ADB 这一套。

#### （6）小结

| 问题 | 答案 |
|------|------|
| IDE 生成什么？ | ① Activity/Logic 等源码；② **`libzkgui.so`（应用）+ `ui/*.ftu`/图片 + `EasyUI.cfg`**；③ 可选 **`update.img`** |
| 下载运行原理？ | 设备预置 **EasyUI 宿主**；ADB/TF 把 **so+资源** 推上去；宿主 **加载 so、读 ftu、建控件树** 后进入界面 |
| 调试 vs 量产？ | 下载调试/TF 启动多为临时或外置；**update.img 升级才固化** |

## 3. 主要功能

依据官网产品页、[入门须知](https://developer.flythings.cn/zh-hans/docs_brief.html)、界面概览/新建工程/编译与 UI 对应、ADB/TF/update.img、控件与串口文档，以及 `中科世为信息.txt` 与本地分析整理。覆盖 **FlyThings IDE（Linux HMI）** 与 **FlyThings Lite（MCU）**。

### 3.1 功能总览

| 类别 | 主要功能 | 说明 |
|------|----------|------|
| **产品线** | FlyThings IDE（Linux）+ FlyThings Lite（MCU） | 同一「可视化 + 源码」范式；运行时底座不同 |
| **IDE 形态** | Eclipse CDT + 自研 UI 编辑插件 | Windows 安装包（如 `FlyThings LiteIDE.exe`）；所见即所得 + 编译调试一体 |
| **工程管理** | 新建向导、导入样例、项目资源树 | 选平台类型、分辨率、旋转、字体、输入法、屏保、串口/波特率等 |
| **六区工作台** | 资源管理器 / UI 编辑预览 / 控件画板 / 属性表 / 大纲 / 控制台 | 官方界面概览标准布局 |
| **可视化设计** | 拖拽控件、即时预览、绝对坐标布局 | 画布/属性/大纲共享同一控件树 |
| **大纲编辑** | 层级树、拖拽改父子、双击显隐 | 复杂界面时关键 |
| **控件库** | 按钮、文本、滑动条、列表、滑动窗口、窗口、动画背景等 | 运行时 `ZK*`（如 `ZKButton`/`ZKTextView`/`ZKListView`）；可自定义控件/依赖包（官方宣传） |
| **样式与状态** | 颜色/图片多状态表（正常/按下/选中等） | 设计期配齐五态外观；特殊字符集（字→图） |
| **UI 持久化** | `.ftu`（Linux）/ `.form` 等（Lite） | `.ftu`≈`ZKSW`+zlib(JSON)；与运行时加载同源 |
| **代码生成** | 按 UI 增量生成 Activity / Logic | `main.ftu`→`mainActivity`+`mainLogic.cc`；控件指针 + 事件钩子；**不覆盖**用户已填业务 |
| **事件契约** | 约定式函数名（如 `onButtonClick_ID`） | 非可视化连线；列表另有 count/obtain/click 三件套 |
| **C/C++ 业务** | Logic 中写逻辑；控件指针改 UI | 官方强调「无需单片机参与」的屏端主机模型（Linux 线） |
| **Activity 框架** | 多界面堆栈、生命周期、Intent 传参 | `sys_back` / `sys_home` 等系统约定 |
| **串口通讯** | 工程配置串口/波特率；协议框架与样例 | 屏作主机与 MCU/设备通讯；文档专设「串口篇」 |
| **系统能力（Linux OS）** | 网络（WiFi/以太网/2G/4G）、多媒体/视频、物联网与支付接入、远程更新/推送 | 属 FlyThings OS / 方案能力，IDE 配套使用 |
| **编译** | 编译 FlyThings：生成代码 + 交叉编译 | 控制台日志；双击错误跳转源码 |
| **下载调试** | ADB（USB/IP）推送运行包 | 默认不固化；优先 TF；`Ctrl+Alt+R` |
| **外置启动** | TF/U 盘放置 EasyUI.cfg + ui + lib | 插卡优先跑外置程序 |
| **量产固化** | 制作 **update.img** 升级 | TF 升级界面或 ADB 触发；掉电仍在 |
| **系统刷机** | 官方 SD 刷机卡 | 整机系统大版本/救砖；与应用 update.img 不同层 |
| **调试** | Log 日志为主 | 文档明确；集成 Log、异常分析（官网宣传） |
| **第三方代码** | 可接入开源库直接编译（宣传） | 依赖包扩展 |
| **Lite 专属** | PC 模拟器、OpenCPU、极致图压、跨 MCU 移植 | 约 2K RAM / 16K Flash 占用叙事；适配 ST/GD/雅特力/博流等 |
| **样例与生态** | 大量样例工程、平台尺寸包、QQ 群/文档 | 授权 SOC/方案商；行业出货叙事 |

官方入门路径（工具→规则→控件→串口→升级→调试）与上表一致；Linux 线闭环是 **设计 `.ftu` → 生成 Logic → 编 so → ADB/TF/update.img → EasyUI 宿主加载**。

### 3.2 分模块要点

**（1）工程与工作台**  
向导定平台与屏参；六区编辑；样例导入加速上手。

**（2）设计器（核心）**  
控件画板拖入；属性表改布局/文案/多态图色；大纲管层级；画布即时预览（动态列表等设计期多为模板近似）。

**（3）代码生成与业务**  
编译前按 UI 增量生成指针与钩子；业务写在 Logic；Activity 建议少改。列表等复杂控件按文档生成多回调。

**（4）通讯与系统**  
串口协议框架服务「智能屏主机」；Linux OS 侧提供网络/多媒体/物联/OTA 等（方案层）。

**（5）部署闭环（Linux）**  
下载调试（快、不固化）→ TF 外置验 → update.img 固化量产；系统级另用刷机卡。

**（6）Lite（MCU）**  
同源可视化范式；产物进用户 Keil/GCC；PC 模拟减刷机；OpenCPU 开放 MCU 侧代码。

### 3.3 主要特点（归纳）

- **工具形态：** Eclipse 系一体化 IDE（设计 + 源码 + 编译下载）  
- **开发模型：** 专有 UI 文档 → 增量生成 C/C++ → **专有 EasyUI/ZKGUI 宿主**解释执行（非 LVGL 源码导出）  
- **隔离模型：** `.ftu` 管界面；Logic 管业务；增量生成保护用户代码  
- **产品叙事：** 组态效率 + 源码开放；Linux 体验线 + MCU 成本线  
- **闭环叙事：** 拖拽 → 写 Logic → 编译 → ADB/TF/镜像上屏（与 SquareLine/Beken「导出 LVGL C」赛道不同）

---

## 4. 优点

| 维度 | 说明 |
|------|------|
| **开发效率** | 拖拽布局 + 自动生成事件/生命周期骨架，显著减少手写 UI 布局与样板代码的时间。 |
| **设计器架构清晰** | 单一控件树文档模型 + 三视图编辑；`.ftu` 与运行时同构，减少「设计稿 ≠ 真机」的鸿沟。 |
| **学习曲线（相对手写 GUI）** | 属性表 + 样例工程 + 文档控件篇，嵌入式工程师可较快上手；业务仍用熟悉的 C/C++。 |
| **UI 与业务边界清晰** | `.ftu`/`.form` 管界面，Logic 管逻辑；增量生成降低「工具改 UI 冲掉业务代码」的风险。 |
| **适合串口屏/HMI 业务形态** | 自带协议框架与界面分发回调，贴合工业显示、仪表、设备面板等主流需求。 |
| **智能屏可减负 MCU** | 屏端主机逻辑 + Lite OpenCPU，相对「双 MCU / 传统从机串口屏」可降低 BOM 或简化架构。 |
| **资源与成本（Lite）** | 极低 RAM/Flash 占用 + 高压缩图片，利于超低成本彩色 UI。 |
| **模拟器（Lite）** | PC 上预览交互，缩短烧录迭代周期。 |
| **生态与交付** | 芯片厂/方案商适配包、行业出货案例多，偏「可量产方案」而非纯实验性框架。 |
| **国产供应链可控** | 对需规避进口 OS/工具链不确定性的项目有额外价值。 |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **生态封闭、绑定强** | 自主 GUI Framework + 专用 IDE/`.ftu` 格式，迁移到 LVGL、Qt、TouchGFX 等需重做 UI 与大量逻辑适配；平台锁定风险高于开源图形库。 |
| **`.ftu` 非人类可读** | 落盘为二进制头+压缩 JSON，脱离 IDE 难 diff/合并，不利于纯文本 Git 工作流与 Code Review。 |
| **调试手段偏弱** | 官方文档称目前主要靠日志调试，缺少完善的图形断点/UI 检查器体验；复杂时序与渲染问题排查成本偏高。 |
| **增量生成的「代码残留」** | 删除控件不删除旧回调，长期迭代易产生死函数、命名混乱；改 ID 会留下旧函数，需人工清理纪律。 |
| **内核与技术栈偏旧（Linux 线）** | 公开资料基于 Linux 3.4 裁剪，现代安全特性、驱动与工具链相对新内核生态落后；深度定制 OS 能力依赖厂商。 |
| **开放程度有边界** | 逻辑开放，但渲染内核、部分系统服务多为闭源/授权；底层渲染算法、性能调优空间不如完全开源方案透明。 |
| **复杂 UI / 动效上限** | 定位中低复杂度 HMI，抗锯齿、滑动等有能力，但相对 Android/Qt/现代 Web 技术，复杂动画、矢量、多语言大型应用、高定制度 UI 可能吃力。 |
| **协议仍需人工落地** | 框架生成通讯骨架，具体协议解析必须改代码；并非「完全免协议编程」的纯组态屏。 |
| **工具与平台依赖 Windows IDE 习惯** | 公开安装包形态（如 LiteIDE.exe）偏 Windows 桌面工作流；跨 OS 开发体验、CI 友好度通常弱于纯文本 + CMake/开源工具链。 |
| **社区与资料相对小众** | 文档与 QQ 群驱动，GitHub/Gitee 样例有限；问题排查对厂商支持依赖度高于 LVGL 等大社区项目。 |
| **授权与商业模式** | SOC/方案授权、专用工具链意味着商务与版本配套成本；芯片适配往往依赖厂商发布的 lib/基础包。 |

---

## 6. 与常见方案的对比（简表）

| 对比项 | FlyThings IDE/Lite | 传统从机串口屏 | LVGL 等开源 GUI |
|--------|--------------------|----------------|-----------------|
| UI 构建 | 专用可视化 IDE | 厂商组态工具 | 多为手写或第三方 Builder |
| 逻辑位置 | 屏端/MCU 端 C/C++ 开放 | 多在外部 MCU | 完全自有工程 |
| 迁移性 | 弱（专有框架） | 弱（厂商协议） | 强（开源可移植） |
| 资源占用 | Lite 极低；Linux 线中等 | 视方案 | 可裁剪，需自控 |
| 调试 | 日志为主 | 有限 | 依赖通用嵌入式调试 |
| 适用 | 工业 HMI、智能串口屏快速量产 | 简单显示从控 | 自研硬件、要深度定制/开源 |

---

## 7. 适用与不适用建议

**较适合：**

- 工业设备面板、仪器、充电桩、电梯屏、家电 HMI 等中等复杂度界面；
- 希望快速出 Demo/量产、接受厂商工具链与授权的团队；
- 需要「屏带逻辑」减轻主控负担，或 MCU 上要极低成本彩屏的产品；
- 重视供应链可控、已有 FlyThings 硬件/SOC 授权的项目。

**不太适合：**

- 需要长期跨芯片自由移植、避免供应商锁定的平台型产品；
- 强依赖现代调试器、自动化测试、开源社区插件生态的团队；
- 高复杂度动效、大应用框架、强安全合规需新内核/完整 SELinux 等能力的场景；
- 希望 UI 技术栈与消费电子 Android/Flutter/Qt 完全统一的研发体系。

---

## 8. 结论

中科世为 UI IDE（FlyThings IDE / FlyThings Lite）的实现本质，是一套面向嵌入式 HMI 的**「可视化文档模型 → 专有 `.ftu` 持久化 → 增量代码生成 → Activity/`ZK*` 控件树运行」**工具链。

**主要功能面**覆盖：六区工作台、拖拽与多态样式、丰富 ZK* 控件、增量 Logic/Activity 生成、Activity 堆栈、串口协议框架、ADB/TF/update.img 部署、Log 调试，以及 Lite 线的 PC 模拟器/OpenCPU/图压；Linux OS 侧另含网络/多媒体/物联等方案能力。

就**拖拽工具本身**而言：它建立在 **Eclipse CDT + `com.zksw.ui.editor` 插件**上，以内存控件树为单一数据源，用画板/属性表/大纲编辑，落盘为 **`ZKSW` + zlib 压缩 JSON**；编译期再遍历该树生成指针、事件钩子与运行时资源。设计器并不直接「画」最终像素指令，而是编辑一份与运行时同构的 UI 文档。

- **Linux 线**把裁剪 Linux、自主 GUI、串口主机模型与 IDE 绑成可量产的智能屏/OS 方案；  
- **Lite 线**把同一文档模型压到 MCU，用模拟器、OpenCPU 与强力图片压缩打超低成本市场。

其核心优势是**提效、贴合串口屏/工业 HMI、双层级覆盖与量产闭环**；核心代价是**平台绑定（含专有 `.ftu`）、调试与生态相对封闭、生成代码需人工治理、深度定制与迁移成本高**。

若团队目标是「在既定硬件生态内尽快交付稳定人机界面」，该工具链是强匹配；若目标是「构建可长期演进的通用 GUI 技术中台」，则更宜将其视为**垂直领域方案**，并与 LVGL/Qt 等开源或跨平台方案做战略对比后再选型。

---

## 9. 参考资料

1. 本地资料：`中科世为/中科世为信息.txt`
2. 公司官网：http://www.zkswe.com/ （FlyThings IDE / Lite 产品页）
3. FlyThings 开发文档：https://developer.flythings.cn/zh-hans/docs_brief.html
4. 系统介绍：https://docs.flythings.cn/zh-hans/system_introdoction.html
5. UI 与源码对应关系：https://developer.flythings.cn/zh-hans/ftu_and_source_relationships.html
6. 界面活动周期：https://docs.flythings.cn/zh-hans/activity_life_cycle.html
7. 串口简介：https://developer.flythings.cn/zh-hans/serial_introduction.html
8. 通用属性 / 控件基类 ZKBase：https://docs.flythings.cn/zh-hans/ctrl_common.html
9. 项目结构：https://developer.flythings.cn/zh-hans/project_structure.html
10. 样例工程 [SampleUI](https://github.com/3guoyangyang7/SampleUI)：`.project` 含 `com.zksw.ui.editor.core.nature`；`ui/*.ftu` 可解析为 `ZKSW`+zlib+JSON；`gencode-debug.bat` 展示部署包（`EasyUI.cfg` + `ui/` + `libzkgui.so`）
11. ADB 下载调试：https://developer.flythings.cn/zh-hans/adb_debug.html
12. TF 卡启动：https://docs.flythings.cn/zh-hans/start_from_sdcard.html
13. 制作升级镜像 update.img：https://docs.flythings.cn/zh-hans/make_image.html
14. 公开技术帖：基于 STM32 的 FlyThings Lite 介绍（OpenCPU、模拟器、图片压缩等）  
15. 姊妹文档：`FlyThings风格UI_IDE仿制方案.md`、`Linux_HMI_UI_IDE分析与仿制方案.md`  
16. 竞品逆向与重构设计：`FlyThings_竞品逆向与重构设计说明.md`

---

*文档性质：基于公开资料与样例文件格式解析的技术分析，非官方白皮书；`.ftu` 头字段细节可能随版本变化，具体以中科世为现行文档与商务授权说明为准。*
