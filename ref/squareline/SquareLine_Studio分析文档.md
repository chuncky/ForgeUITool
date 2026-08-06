# SquareLine Studio 分析报告

> 基于 `quareline/squareline信息.txt`、本地安装包 **SquareLine Studio 1.6.1**、示例工程 `quareline/example1`，以及官网、官方文档与社区公开资料整理。  
> 分析对象：**SquareLine Studio**（面向 **LVGL** 的商业可视化 UI 设计与代码导出工具）。  
> 范围：实现方案、功能特点、优缺点；并与同类 LVGL 工具简要对照。  
> 仿制方案：[`SquareLine_Studio_仿制方案.md`](./SquareLine_Studio_仿制方案.md)。  
> 综合稿（分析+仿制，推荐）：[`SquareLine_Studio_分析与仿制方案.md`](./SquareLine_Studio_分析与仿制方案.md)。  
> 竞品逆向 + 兼容重构设计说明：[`SquareLine_Studio_竞品逆向与重构设计说明.md`](./SquareLine_Studio_竞品逆向与重构设计说明.md)。

---

## 1. 产品定位

SquareLine Studio 是独立公司推出的 **跨平台（Windows / macOS / Linux）嵌入式 GUI 可视化 IDE**：在桌面端拖拽设计界面，导出 **平台无关的 LVGL C 或 MicroPython 代码**，再编入任意厂商 MCU/MPU 工程。

官网强调（https://squareline.io/）：

- **All in one**：设计、原型、开发同一软件完成  
- **Vendor agnostic**：导出普通 C / MicroPython，不绑单一芯片厂商  
- **Play 即时预览**：无需整包重编即可像素级试玩 UI  
- **Components**：用内置控件组合自定义组件（样式/动画/事件）  
- **商业订阅**：个人免费（有限额）；小企业 / 大企业按月收费  

官网声明：**LVGL 与 SquareLine 为相互独立公司，无官方隶属关系**（曾有合作叙事，后公开报道称合作愿景分歧、各自独立发展）。

| 项 | 内容 |
|----|------|
| 官网 | https://squareline.io/ |
| 文档 | http://docs.squareline.io/（如 1.5.x typical workflow） |
| 本地资料 | `quareline/squareline信息.txt`；安装包 `SquareLine_Studio_1.6.1_Setup.exe`；示例 `example1` |
| 本地版本线索 | 编辑器 **1.6.1**；示例工程锁定 **LVGL 8.3.11** |
| 平台 | Windows / macOS / Linux |
| 图形库 | **开源 LVGL**（导出代码运行于 LVGL） |
| 商业模式 | Personal 免费（屏数/控件数等限制）+ Business 订阅/买断；另有 Trial |

定位与 **BEKEN LVGL UI Designer、ArtInChip UIBuilder、NXP GUI Guider** 同赛道（设计器 → 导出 LVGL 源码）；与 **Persim Studio / FlyThings**（专有运行时 + 应用包解释）不同。

一句话：

> **桌面可视化工程（JSON 系 `.spj` 等）→ 编辑器内 Play 预览 → 导出 `ui_*.c` / MicroPython → 接入已有 LVGL port 交叉编译上板。**

---

## 2. 实现方案（原理）

### 2.1 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│  SquareLine Studio（桌面闭源 IDE）                           │
│  画布 / Hierarchy / Widgets / Inspector / Events            │
│  Font Manager / Assets / Console / Themes / Components      │
│  Play：内置像素级预览（无需重编整工程）                       │
└───────────────────────────┬────────────────────────────────┘
                            │ 读写工程目录
                            ▼
┌────────────────────────────────────────────────────────────┐
│  工程文件（本地 example1 可核对）                             │
│  .spj  UI 对象树（JSON）  .sll 工程/导出/板型等元数据         │
│  .slp  导出路径与 FS drive 配置  Themes.slt 主题             │
│  assets / components / backup / cache                       │
└───────────────────────────┬────────────────────────────────┘
                            │ Export UI Files
                            │ （可选 Create Template Project）
                            ▼
┌────────────────────────────────────────────────────────────┐
│  导出产物（官方文档典型结构）                                 │
│  ui.c / ui.h、ui_Screen*.c、ui_helpers.*、ui_events.*       │
│  字体/图片 C 数组或资源；filelist / CMakeLists 等            │
│  或 MicroPython：ui.py、ui_helpers.py、ui_events.py…        │
└───────────────┬────────────────────────────┬───────────────┘
                ▼                            ▼
     板端 / 任意 LVGL 工程            板级模板工程（Arduino/ESP-IDF 等）
     lv_init + 驱动后调用 ui_init()   Create Template Project 生成骨架
```

### 2.2 工程数据模型（本地示例）

`example1` 在编辑器 **1.6.1** 下创建/保存，主要文件：

| 文件 | 作用（据内容与社区用法） |
|------|--------------------------|
| **`SquareLine_Project.spj`** | UI 权威树：JSON；`root.children[]`，页面 `isPage`，控件 `guid` + `properties[]`（`strtype` 如 `OBJECT/Name`、`OBJECT/Layout`、`SCREEN/Style_main`） |
| **`SquareLine_Project.sll`** | 工程元数据：分辨率、板型、编辑器版本、**LVGL 版本**、导出选项（扁平导出、图片导出模式、命名规则、主题色等）；可含预览缩略图 |
| **`SquareLine_Project.slp`** | 导出目录与 LVGL FS drive 路径（stdio/posix/win32/fatfs 等） |
| **`Themes.slt`** | 主题列表（示例为 Default 空主题） |
| **`assets/` / `components/`** | 资源与自定义组件 |
| **`backup/`** | 自动备份 zip |

本地 `.sll` 关键字段摘录：

- `width`/`height`：800×480  
- `board`：`Eclipse with SDL for development on PC`  
- `editor_version`：`1.6.1`  
- `lvgl_version`：`8.3.11`  
- `flat_export`、`imageexport`：`SOURCE`、`callfuncsexport`：`C_FILE` 等  

打开工程通常需要 **同目录下 `.spj` + `.sll`**（社区 Issue 多次确认缺 `.sll` 会导入失败）。

设计器对属性的命名高度贴合 **LVGL 概念**（Layout、Scroll、Style_main/scrollbar、States），便于 CodeGen 映射到 `lv_*` API。

### 2.3 代码生成与上板集成

官方 typical workflow（docs.squareline.io）：

1. **Export → Export UI Files**（或 Export Files）：导出 UI 源码到设定目录  
2. 可选 **Create Template Project**：按板型/OBP 生成可编译模板工程，再反复只导出 UI  
3. 应用侧：`lv_init()` → 显示/输入驱动 → `#include "ui.h"` → **`ui_init()`**  

C 导出常见文件：

- `ui.c` / `ui.h`：初始化、主题、加载默认屏；可有 `ui_Destroy()`（较新文档）  
- `ui_ScreenN.c`：分屏控件创建  
- `ui_helpers.c/.h`：切屏、动画、属性辅助  
- `ui_events.c`：**Call function** 事件骨架，用户填业务  
- `ui_comp_hook.c`：组件创建末尾钩子，可定制  
- `filelist.txt` / `CMakeLists.txt`：便于接入构建系统  
- 图片/字体：可编进源码数组，或按 FS drive 外部加载  

MicroPython 路径类似：`ui.py` + helpers/events/images/fonts。

上板 **不依赖** SquareLine 闭源运行时：图形栈是开源 **LVGL**；工具只负责设计与 CodeGen。与 Persim「装 `.prc` 到柿饼宿主」本质不同。

### 2.4 预览（Play）与仿真

官网卖点：点 **Play** 即可像素级试 UI，**不必为预览重编整个固件工程**。

社区描述：顶部 Play 启动模拟器，可验证控件动作、动画、切屏等。  
板型可选「PC + SDL」类（本地示例即 Eclipse/SDL），与「导出后本机再编 LVGL」互补：

| 路径 | 作用 |
|------|------|
| 编辑器内 Play | 快速迭代交互与观感 |
| 导出 + 板级/SDL 工程 | 与真实驱动、色深、`LV_COLOR_*` 配置对齐验收 |

导出代码常带色深等编译期检查（社区示例中有 `#error` 要求与 Studio 设置的 `LV_COLOR_DEPTH` 一致）。

### 2.5 事件与业务扩展

- Inspector 中为控件添加事件（点击、手势等）  
- 动作类型包括改属性、切屏（含过渡）、调用函数等  
- **Call function** → 生成 `ui_events.c`（或 `.py`）空实现，用户写业务，避免每次全量覆盖手写逻辑（类似「generated + user」边界）  
- Components：组合控件复用；可有数量限制（视许可证）

### 2.6 宿主技术形态（说明）

Studio 本体为 **闭源桌面程序**（本地仅有 Setup 安装包，未展开 asar/Unity 资源树做二次逆向）。  
公开信息可确认：**非**「导出后必须依赖 SquareLine 运行时」；量产链路是 **标准 LVGL 源码**。编辑器内预览实现细节属厂商闭源，分析以 **行为与产物** 为准。

---

## 3. 主要功能特点

### 3.1 功能总览

| 类别 | 功能 | 说明 |
|------|------|------|
| **工程** | 新建/打开、板型选择、分辨率/色深、LVGL 版本、备份 | `.spj/.sll/.slp`；多板模板（Arduino、ESP、SDL PC 等） |
| **可视化设计** | 拖拽控件、Hierarchy、多屏画布 | 覆盖 LVGL 常用控件（非 100% 全量控件） |
| **属性检查** | Inspector：外观、布局、滚动、状态等 | 属性模型贴近 LVGL |
| **事件** | 触发 + 动作（切屏、改属性、Call function…） | 导出事件骨架 |
| **资源** | 图片导入、Assets 面板 | 可 SOURCE 进 C 或走 FS |
| **字体** | Font Manager：TTF → LVGL 字体，可裁字符 | 省 Flash |
| **主题** | Themes（`.slt`） | 简化主题/深浅色等选项（见 `.sll`） |
| **组件** | Custom Components | 复用；许可证限制组件数量 |
| **预览** | Play 即时预览 | 无需重编整包固件 |
| **导出** | Export UI Files；C / MicroPython | 可选扁平导出到单目录 |
| **模板工程** | Create Template Project | 厂商/板级骨架 + 反复只更 UI |
| **构建辅助** | CMakeLists、filelist | 接入已有工程 |
| **多语言** | multilang 开关（工程元数据） | 视版本与配置 |
| **许可分级** | Personal / Business / Enterprise | 屏数、控件数、组件数、商用权限不同 |

### 3.2 工作流特点

1. 选板型与分辨率创建工程  
2. 拖控件、配 Inspector、加事件  
3. Play 验证  
4. 配导出路径 / LVGL include  
5. Export UI → 拷入 Arduino / ESP-IDF / RT-Thread / 自有 CMake  
6. 驱动就绪后 `ui_init()`；业务写在 `ui_events.*`  

生态上与 Espressif、NXP、Seeed、Elecrow、Waveshare 等板卡教程结合紧密，是业界认知度很高的 **LVGL 可视化入口**。

### 3.3 与本地示例的对应关系

`example1` 体现「最小工程骨架」：单屏 `Screen1`、默认主题、SDL PC 板型、LVGL 8.3.11、导出选项已写入 `.sll`，适合作为格式与版本对照样本（未必含丰富控件，以结构为准）。

---

## 4. 优点

| 维度 | 说明 |
|------|------|
| **标准 LVGL 产出** | 导出可读 C/MP，可移植到 Arduino、ESP-IDF、Zephyr、RT-Thread、NuttX 等；板上无专有 UI 解释器 |
| **厂商中立** | 不绑单一芯片 SDK；「Vendor agnostic」成立 |
| **上手快** | 拖拽 + Inspector + Play，降低手写 `lv_obj_*` 成本；教程与板卡文档极多 |
| **设计与开发同文件** | 美工/固件可共用 SquareLine 工程，减少「设计稿无法落地」 |
| **事件与用户代码边界清晰** | `ui_events` / hooks 承接业务，利于迭代导出 |
| **板级模板** | Create Template Project 缩短「空工程 + 驱动 + UI」搭建时间 |
| **跨桌面 OS** | Win/macOS/Linux 均有客户端 |
| **资源工具全** | 字体裁剪、图片导出模式、FS drive 配置覆盖常见嵌入式约束 |
| **个人可用免费档** | 降低试用与爱好者门槛（有功能/规模限制） |

---

## 5. 缺点与局限

| 维度 | 说明 |
|------|------|
| **商业订阅成本** | 商用需付费；公开报道称价格上调后小企业年费/月费压力明显，是团队弃用或改用 Beken/EEZ 等的常见原因 |
| **Personal 限额** | 屏数、控件数、组件数受限，复杂 HMI 很快触及天花板 |
| **闭源 IDE** | 工程格式虽可读 JSON，但编辑器/预览/导出器闭源；自动化、二次开发、私有化部署受限 |
| **控件覆盖不全** | 社区指出并非 LVGL 全部控件都进设计器；复杂控件仍可能手写 |
| **导出源码维护成本** | 大项目生成文件多；需纪律区分生成区与 `ui_events`；合并冲突常见 |
| **版本与 LVGL 对齐摩擦** | 工程锁定 `lvgl_version`；Studio/LVGL 大版本迁移需跟工具发布；公开对比称部分版本策略与生态预期不一致 |
| **与 LVGL 官方 Pro 分流** | 双方独立；若团队要官方 XML/Pro 工作流，SquareLine 不是同一产品 |
| **预览 ≠ 真机** | Play 很快，但色深、swap、性能、驱动差异仍需真机/板级仿真验收 |
| **授权合规** | 商用项目需核对许可证条款，避免 Personal 用于商业产品 |

---

## 6. 与同类方案对比（简表）

| 对比项 | SquareLine Studio | BEKEN LVGL UI Designer | LVGL Pro | Persim Studio |
|--------|-------------------|------------------------|----------|---------------|
| 图形库 | LVGL | LVGL | LVGL | Persimmon |
| 产出 | C / MicroPython 源码 | C / MP 源码 | C 或运行时 XML | `.prc` 应用包 |
| 工程格式 | `.spj` 等 JSON | `.bkprj` JSON | 官方 XML | XML+JS |
| 预览 | 编辑器内 Play | 生成后本机编译仿真 | 真 LVGL Runtime/Wasm | simulator.exe |
| 商业 | 订阅为主 | 宣传免费 | Community/商用分层 | 偏生态授权 |
| 平台锁定 | 弱（LVGL） | 弱 | 弱 | 强 |
| 典型用户 | 广泛 LVGL 生态 | 成本敏感 / Beken 方案 | 要官方 Pro 工具链 | RTT 柿饼/湃心 |

---

## 7. 适用与不适用

**较适合**

- 已选定 **LVGL**，需要可视化快速出多屏 HMI  
- 目标平台多样（ESP32、STM32、Linux 等），希望 **一份 UI 多板复用**  
- 接受订阅费用，或个人/评估在 Personal/Trial 限额内  
- 需要丰富板级教程与社区案例  

**不太适合**

- 要 **零订阅** 商用大规模 UI → 更可能看 Beken / EEZ Studio 等  
- 要 **官方 LVGL Pro XML / Figma Flow** 工作流 → 看 LVGL Pro  
- 要 **JS 轻应用包热更新**（非 LVGL 源码）→ 看 Persim / FlyThings  
- 强依赖未进设计器的冷门 LVGL 控件，且不愿手写补充  

---

## 8. 结论

SquareLine Studio 的实现本质是：

> **闭源跨平台设计器编辑 JSON 系工程（`.spj` 对象树 + `.sll` 元数据）→ 内置 Play 预览 → 导出标准 LVGL C/MicroPython（`ui_init` + 分屏 + helpers + events 骨架）→ 任意已移植 LVGL 的固件工程编译运行。**

它是全球认知度很高的 **LVGL「设计器 → 源码」范式标杆**：强在易用、中立导出、生态教程与板级模板；弱在 **订阅成本、闭源与限额、生成代码工作流固有维护成本**，以及与 LVGL 官方 Pro 路线分流后的定位选择问题。

对内选型建议：若对标「要付费的成熟 LVGL 可视化」，SquareLine 仍是基准；若对标「同等范式但控成本」，应重点对照 Beken Designer / UIBuilder / EEZ；若对标「应用包解释执行」，则不要用 SquareLine 的架构假设去理解 Persim。

---

## 9. 参考资料

**本地**

1. `quareline/squareline信息.txt`（官网、安装包 1.6.1、example1）  
2. `quareline/SquareLine_Studio_Windows_v1_6_1/SquareLine_Studio_1.6.1_Setup.exe`  
3. `quareline/example1/`（`.spj` / `.sll` / `.slp` / `Themes.slt` / assets / components / backup）  

**网上**

4. 官网：https://squareline.io/  
5. 文档：http://docs.squareline.io/docs/1.5.2/introduction/typical_dev/（导出文件结构与 `ui_init` 流程）  
6. 社区/板卡教程：Elecrow、Waveshare Wiki、ESP32 + SquareLine 实践博文等  
7. 许可与价格讨论：公开博客对 Personal/Business 限额与涨价的整理（以官网定价页为准）  
8. 竞品对比线索：PicoPixel 等对 SquareLine / EEZ / 官方编辑器的公开对比（LVGL 版本策略等，需随时间复核）  

---

*文档基于本地 1.6.1 工程样本与公开资料静态分析；具体许可条款与最新定价以 SquareLine 官网为准。*
