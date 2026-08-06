# FlyThings 竞品逆向分析与兼容软件重构设计说明

> **文档类型：** 设计说明（竞品逆向 + 兼容重构）  
> **竞品对象：** 中科世为 **FlyThings IDE**（Linux HMI / 智能串口屏；主线）及配套 **FlyThings Lite**（MCU；二线）  
> **输入材料：** `中科世为/中科世为信息.txt`、官网 zkswe.com、developer.flythings.cn / docs.flythings.cn、公开 SampleUI（`.ftu` 解析）；既有分析/仿制/Linux 综合文档  
> **关联文档：** `中科世为UI_IDE分析文档.md`、`FlyThings风格UI_IDE仿制方案.md`、`Linux_HMI_UI_IDE分析与仿制方案.md`  
> **体例参考：** `rt-thread/Persim_Studio_竞品逆向与重构设计说明.md`、`beken/BEKEN_LVGL_UI_Designer_竞品逆向与重构设计说明.md`、`quareline/SquareLine_Studio_竞品逆向与重构设计说明.md`  
> **重构产品暂名：** **ForgeHMI Studio**（可替换）；CLI 暂名 **`fh-codegen` / `fh-build` / `fh-deploy` / `fh-sim`**；UI 格式暂名 **`.hmui`（明文 JSON）**；应用包暂名 **`libapphmi.so` + ui/**  

---

## 1. 概述

### 1.1 项目背景

在「先逆向弄清竞品，再做兼容级重构」策略下，对 FlyThings 所代表的 **Eclipse 可视化设计 + 专有 UI 文档（`.ftu`）+ 增量生成 C/C++ Logic + 专有 EasyUI/ZKGUI 宿主加载应用 so** 范式做结构化拆解，并设计一套 **功能兼容、格式与运行时自有** 的替代工具链。

竞品与 SquareLine / Beken / UIBuilder / LVGL Pro（**导出 LVGL 源码**）不同：板上是 **闭源 GUI 宿主 + 应用插件**，更接近 Persim「宿主 + 包」叙事，但业务语言是 **C/C++ Activity**，不是 JS 轻应用。  
护城河在 **串口屏/HMI 行业闭环（IDE + OS + SOC 授权 + 样例）** 与 **组态效率 + 源码开放** 的组合，而非开源图形库本身。

### 1.2 项目目标

| 目标 | 说明 |
|------|------|
| **逆向摸清** | 厘清六区 IDE、`.ftu`、增量 CodeGen、宿主加载、ADB/TF/`update.img`、功能面与绑定 |
| **功能兼容** | 覆盖主路径：工程 → 拖拽 → Logic → 编译 → 部署 → 板上可点选运行 |
| **格式自有** | 自有 `.hmui` Schema；**默认不**读写官方 `.ftu` / EasyUI 配置魔数 |
| **可落地** | 模块、接口、数据模型、分期与验收可直接指导研发 |
| **可授权** | 运行时优先 **开源 LVGL（或自研轻量 GUI）**；不搬运 `libeasyui.so` / 闭源授权库 |

### 1.3 「兼容」定义（本设计锁定）

| 兼容层级 | 含义 | 本方案 |
|----------|------|--------|
| **L1 体验兼容** | 六区工作台 / 属性大纲 / 编译部署工作流接近 | ✅ 目标 |
| **L2 功能兼容** | 主功能清单对齐（见分析文档 §3 / 仿制方案 §0） | ✅ 目标（Linux 主线；Lite 分期） |
| **L3 API 形似** | Logic 钩子命名、控件指针操作风格可形似 | ✅ 可选形似，**非**官方 `ZK*` API 全集兼容 |
| **L4 工程兼容** | 直接打开官方 `.ftu` / Eclipse 工程 | ❌ 默认不做 |
| **L5 运行时兼容** | 官方 so 在自研宿主跑，或自研包在 EasyUI 跑 | ❌ 默认不做 |

> **结论：** 本设计是 **功能兼容型重构（L1+L2，部分 L3）**，不是 FlyThings 工程/二进制兼容器。若必须 L4/L5 → **采购/授权官方 FlyThings**。

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **先运行时/Loader 后花哨 IDE** | Schema → Inflater → sim → CodeGen → Designer → Deploy |
| **单一权威模型** | `.hmui` JSON 同时服务设计器、校验、CodeGen、Inflater |
| **Logic 用户区保护** | 增量生成钩子；已填业务不覆盖；孤儿钩子可告警 |
| **Backend 可替换** | 控件 API 不写死某一 GUI；推荐 LVGL 实现 |
| **只做工具链 + loader，不做整机 OS** | 网络/支付/OTA 等留给芯片方案或后期选配 |
| **合规优先** | 禁止 `ZKSW` 魔数兼容宣传、反编译 EasyUI、冒用中科世为/FlyThings 商标 |

### 1.5 逆向范围与方法

| 方法 | 内容 | 边界 |
|------|------|------|
| 结构逆向 | Eclipse nature、工程目录、`.ftu` 解压 JSON、部署包组成 | 读公开样例/文档；解析文件头与 JSON |
| 行为逆向 | 增量生成规则、ADB/TF/`update.img`、Activity 生命周期 | 官方开发文档 |
| 功能逆向 | 六区、控件、串口、升级、Lite 能力 | 分析文档 §3 |
| 不做 | 反汇编 `libeasyui.so`/`libzkgui`、破解授权、复制品牌资源 | — |

### 1.6 本设计默认范围

| 纳入 | 默认不纳入（可二期） |
|------|----------------------|
| **Linux HMI IDE + loader + 部署闭环** | 完整 FlyThings OS 克隆 |
| 可选 LVGL Backend | 支付/物联云平台原样 |
| Lite 仅作路线图 | MCU 极致 2K/16K 与专有图压算法照搬 |

---

## 2. 竞品逆向分析

### 2.1 竞品画像

| 项 | 结论 |
|----|------|
| 产品名 | FlyThings IDE / FlyThings Lite IDE；公司中科世为（zkswe） |
| 形态 | **Windows Eclipse CDT + 自研 UI 插件** 一体化 IDE |
| 定位 | 工业 HMI / 智能串口屏可视化开发；「组态 + 开放 C/C++」 |
| 运行时 | Linux：**EasyUI/ZKGUI 宿主 + `libzkgui.so`**；MCU：**Lite Runtime** |
| 商业 | SOC/方案授权 + 专用工具链；行业出货叙事强 |
| 与 LVGL 工具差异 | **不导出 LVGL C**；专有控件树在专有宿主上 inflate |

### 2.2 分层逆向模型

```text
┌─────────────────────────────────────────────────────────────┐
│ L5 方案层  FlyThings OS（网络/多媒体/OTA/物联…）+ SOC 授权   │
├─────────────────────────────────────────────────────────────┤
│ L4 工具层  Eclipse CDT + com.zksw.ui.editor.*（六区）         │
├─────────────────────────────────────────────────────────────┤
│ L3 工程层  ui/*.ftu + Logic/Activity 源码 + resources        │
├─────────────────────────────────────────────────────────────┤
│ L2 应用层  libzkgui.so + ui 资源 + EasyUI.cfg（部署包）       │
├─────────────────────────────────────────────────────────────┤
│ L1 运行层  zkgui 宿主 + libeasyui.so → ZK* 控件树 + Activity │
└─────────────────────────────────────────────────────────────┘
```

**关键发现：**

1. **L1/L2 是真正护城河**（闭源宿主与加载约定）；只仿六区画布而无 Loader/Runtime，无法形成兼容级产品。  
2. IDE（L4）可替换为现代壳；业务价值在 **文档模型 + 增量 CodeGen + 部署闭环**。  
3. `.ftu` 虽内含 JSON，但是 **压缩 + `ZKSW` 魔数** 的厂商方言；兼容它等于格式债 + 潜在合规风险。  
4. 与 Persim 同属「宿主加载应用」；与 Beken/SquareLine 赛道不同——选型勿用 LVGL 导出假设理解 FlyThings。  
5. OS 能力（支付/云）是方案层，**不应**作为 IDE 仿制 MVP 范围。

### 2.3 数据流逆向

```text
六区编辑控件树 → 保存 .ftu（ZKSW + zlib(JSON)）
    → 编译预处理：遍历 UI → 增量写 Activity 指针 + Logic 钩子
    → 交叉编译 → libzkgui.so + ui/*.ftu + EasyUI.cfg (+ 图字)
    → 部署：
         · ADB 下载调试（临时，优先 TF）
         · TF 外置启动
         · update.img 固化量产
    → 板端：宿主 dlopen so → 读 ftu inflate ZK* → Activity 栈运行
```

Lite 线：同源设计范式 → 生成资源/接口进用户 MCU 工程 → PC 模拟器 / 串口烧录；无 so+ADB 模型。

### 2.4 工程与文件逆向

| 文件/结构 | 职责 | 重构对应 |
|-----------|------|----------|
| `.project` / CDT | Eclipse 工程 | `project.json` / CMake |
| `ui/*.ftu` | 页级 UI 权威描述 | `ui/*.hmui`（明文 JSON） |
| `logic/*Logic.cc` | 业务钩子（增量） | `logic/*_logic.c` |
| `*Activity.*` | 指针声明与 inflate（建议勿手改） | `generated/*_activity.*` |
| `resources/` | 图片字体等 | `assets/` |
| `EasyUI.cfg` | 宿主启动配置 | `runtime.cfg` |
| `libzkgui.so` | 应用动态库 | `libapphmi.so` |
| `update.img` | 固化升级包 | 自有升级包格式（V1） |

`.ftu` 内部：根窗口 + `type__n` 子节点、`position`、`colorTab`/`picTab`、嵌套容器。重构用 **`children[]` + 字符串 type**，禁止对外 `ZKSW` 魔数。

### 2.5 代码生成与事件逆向

| 规则 | 说明 | 重构对应 |
|------|------|----------|
| `main.ftu` → `mainLogic.cc` | 同前缀配对 | 同构命名约定 |
| 增量非覆盖 | 已有用户代码保留 | GENERATED 标记区 / AST 合并 |
| `onButtonClick_ID` | caption→函数名 | 可形似钩子名（L3） |
| List 三回调 | count / obtain / click | V1 实现 |
| 删控件残留钩子 | 官方不删旧函数 | 告警孤儿；可选清理命令 |

### 2.6 部署逆向（Linux）

| 方式 | 行为 | 重构 |
|------|------|------|
| 下载调试 | ADB push 运行包；默认不固化 | `fh-deploy adb` |
| TF 外置 | 卡内程序优先于机内固化版 | `fh-deploy tf` |
| update.img | 固化，上电默认启动 | `fh-pack image`（V1） |
| SD 刷机卡 | 整机系统 | **不做**（OS 层） |

### 2.7 功能面逆向摘要

双产品线 · 六区 IDE · 向导（分辨率/旋转/字体/输入法/屏保/串口）· 拖拽与多态样式 · ZK* 控件 · `.ftu` · 增量 Activity/Logic · Activity 栈 · 串口框架 · 编译 · ADB/TF/update.img · Log · Lite 模拟器/OpenCPU/图压 · OS 方案能力。  
详见分析文档 §3。

### 2.8 竞品优劣对重构的启示

| 启示 | 行动 |
|------|------|
| 组态+源码是体验锚点 | 必须保留拖拽 + Logic 开放 |
| 宿主锁定是最大代价 | 重构用开源 Backend（LVGL）降绑定 |
| `.ftu` 不友好 Git | 明文 `.hmui` 作差异化 |
| 增量生成有残留问题 | 孤儿钩子告警 + 可选清理 |
| 调试偏 Log | MVP 日志面板；V1 可加强模拟器 |
| 勿做成小 OS | 范围锁工具链+loader |
| 可与 Persim 重构对照 | 同为宿主模型；API 与包形态不同 |

### 2.9 赛道选择

| 若真实目标是… | 应重构的对象 |
|----------------|--------------|
| 智能串口屏/HMI 组态+C++、宿主加载应用 | **本文（ForgeHMI）** |
| 导出 LVGL C、厂商中立 | Beken / SquareLine / UIBuilder / LVGL Pro |
| JS 轻应用包 + 解释执行 | Persim / LiteApp |
| 必须官方 FlyThings 硬件与 so | **买官方授权**，非本文 |

---

## 3. 兼容软件重构：总体设计

### 3.1 重构范围

| 在范围 | 不在范围（默认） |
|--------|------------------|
| 现代 IDE 壳（VS Code / Electron / Tauri）六区能力 | Eclipse 插件搬迁、官方 nature |
| 自有 `.hmui` + 增量 CodeGen | `.ftu` / `ZKSW` 兼容 |
| PC 模拟器 + 板端 loader + `libapphmi.so` | EasyUI / `libeasyui.so` |
| ADB/TF 类部署；V1 升级包 | 整机 OS、刷机卡、支付云 |
| MVP 基础控件；V1 List/Window/串口骨架 | Lite 极致资源栈（二期） |

### 3.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│  ForgeHMI Studio（VS Code 插件 或 Electron/Tauri）             │
│  Project / Designer / CodeGen / Build / Deploy / Log         │
└──────────────────────────────┬───────────────────────────────┘
                               │ .hmui JSON
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  fh-codegen → generated/* + logic（用户区保护）                 │
│  fh-build   → libapphmi.so + ui/ + assets + runtime.cfg      │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
     fh-sim（主机模拟器）              fh-deploy → 板端
     Inflater + LVGL/SDL               hmi_loader dlopen so
```

### 3.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| IDE 壳 | **VS Code Extension** 或 **Electron/Tauri** | 现代化；对齐仿制方案；勿首期 Eclipse |
| 设计器 | Vue3/React + 绝对定位画布 | 实现快；三视图绑定同一 JSON |
| UI 格式 | **明文 `.hmui` JSON**（可打包时压缩） | Git 友好；与官方差异化 |
| CodeGen | Python/Node + 模板；增量合并 | 可测试 |
| GUI Backend | **LVGL**（推荐）或自研 | 可授权、可移植 |
| 模拟器 | SDL + 同一 Inflater | 预览≈板端 |
| 部署 | ADB / 拷卡；V1 自有升级包 | 对齐闭环，格式自有 |
| 工具链 | CMake + 板级交叉编译器 | 替代 Eclipse CDT 黑盒 |

### 3.4 逻辑模块

| 模块 | 职责 |
|------|------|
| **Schema** | page/control `.hmui` Schema 与校验 |
| **ProjectService** | 向导、样例、目录约定 |
| **Designer** | 画布、画板、属性表、大纲、撤销 |
| **CodeGen** | Activity/Logic 增量生成；孤儿告警 |
| **BuildOrchestrator** | 调交叉编译，产出 so + 资源包 |
| **Inflater** | 读 `.hmui` 建控件树（sim 与板端共用） |
| **WidgetRegistry** | 控件元数据；设计器与 Runtime 同源 |
| **ActivityRuntime** | 多页栈、生命周期、简单 Intent（V1） |
| **ProtocolStub** | 串口协议骨架（V1 可选） |
| **SimHost** | PC 窗口 + 输入循环 |
| **Loader** | 板端读 cfg、dlopen、启动页 |
| **Deploy** | ADB / TF / pack image |
| **Cli** | `validate \| generate \| build \| sim \| deploy` |

---

## 4. 数据与接口设计

### 4.1 工程目录

```text
MyHmi/
  project.json
  ui/
    home.hmui
    settings.hmui
  assets/images|fonts/
  logic/
    home_logic.c          # 用户业务（保护）
  generated/              # 可清
    home_activity.c
    home_activity.h
    ui_ids.h
  runtime.cfg
  out/                    # build 输出
    libapphmi.so
    ui/
    assets/
```

### 4.2 `.hmui` 节点（示意）

```json
{
  "schemaVersion": 1,
  "type": "window",
  "id": "home",
  "frame": { "w": 800, "h": 480 },
  "children": [
    {
      "type": "button",
      "name": "Button1",
      "frame": { "x": 40, "y": 40, "w": 120, "h": 48 },
      "props": { "text": "Next" },
      "states": {
        "normal": { "bg_color": "#2563EB" },
        "pressed": { "bg_color": "#1D4ED8" }
      }
    }
  ]
}
```

**禁止**产品格式使用 `ZKSW` 魔数或官方 `button__1` 键风格作为兼容承诺。

### 4.3 CodeGen 接口

```text
fh-codegen validate <projectDir>
fh-codegen generate <projectDir>
fh-build            <projectDir>
fh-sim              <projectDir>
fh-deploy adb|tf    <projectDir> [--ip ...]
fh-pack image       <projectDir>   # V1
```

生成规则：

- 覆盖 `generated/**`  
- `logic/*`：若钩子不存在则追加空实现；**已存在则不改函数体**  
- 删除控件：默认保留旧钩子并告警孤儿；提供显式清理命令  
- 产出 `ui_ids.h`、句柄表、inflate 代码  

### 4.4 运行时集成（板端）

```text
hmi_loader
  → 读 runtime.cfg
  → dlopen libapphmi.so
  → app_on_init()
  → inflate ui/home.hmui
  → 输入/刷新循环
```

用户 Logic：

```c
bool onButtonClick_Button1(HmiButton *btn)
{
    /* 改文本、切页、写串口… */
    return true;
}
```

钩子命名可 L3 形似官方，以降低迁移心智；实现绑定自有控件类型。

### 4.5 部署包

```text
bundle/
  runtime.cfg
  libapphmi.so
  ui/*.hmui
  assets/
```

与官方 `EasyUI.cfg + libzkgui.so + ui/*.ftu` **同构流程、异构格式**。

---

## 5. 模块详细设计（要点）

### 5.1 Designer

- 三视图绑定同一 `.hmui`  
- 绝对坐标；多态 states  
- 大纲改父子/显隐；撤销快照  
- 设计期列表显示 Item 模板（动态数据靠 Runtime 回调）  

### 5.2 CodeGen / Activity

- 每页：activity（inflate + 指针）+ logic（钩子）  
- 生命周期：`onCreate` / `onResume` / …（V1 对齐必要子集）  
- 切页 API：`open_page` / `back`（形似 Activity 栈）  

### 5.3 Inflater + WidgetRegistry

```json
{
  "id": "button",
  "backend": { "lvgl": "lv_button_create" },
  "events": ["click"],
  "hook": "onButtonClick_{name}"
}
```

设计器、CodeGen、Inflater 共读；缺映射则 generate/ inflate 报错。

### 5.4 SimHost

与板端共用 Inflater + 事件分发；SDL 窗体；日志打印对齐官方 Log 习惯。

### 5.5 Deploy

- ADB：push bundle 到可写目录（优先外置存储约定）并重启 loader  
- TF：写整包到卡根约定目录  
- Image：打自有升级包（V1）；**不**仿官方 update.img 二进制布局  

### 5.6 ProtocolStub（V1）

生成串口收发骨架与注册表；协议正文由用户填写——对齐「框架有、协议仍手写」的现实。

---

## 6. 分期与工作拆分

| 阶段 | 内容 | 周期参考 | 退出标准 |
|------|------|----------|----------|
| **P0** | 本文评审 + 合规 + Backend 选定（LVGL） | 2～3 天 | 决策通过 |
| **P1** | `.hmui` Schema + Hello 双页手写工程 | 3～5 天 | validate 通过 |
| **P2** | Inflater + fh-sim（可点选） | 1～2 周 | 模拟器双页切换 |
| **P3** | fh-codegen 增量钩子 | 1～2 周 | 改 UI 不丢 Logic |
| **P4** | Designer 六区 MVP | 6～10 周 | 拖完即可 sim |
| **P5** | fh-build + loader + ADB/TF 部署 | 2～3 周 | 板端行为与 sim 一致 |
| **P6** | V1：List/Window、Activity 栈增强、升级包、串口骨架 | 1～2 月 | V1 验收 |
| **P7** | V2：Lite/MCU 线或更多系统能力选配 | 按需 | 产品化项 |

原则：**P1→P2→P3→P4→P5**。禁止先堆 OS/云/支付。

人力：嵌入式 2、前端 1～2、工具链 1。  
MVP（至 P5）约 **5～9 人月**；到 V1 约 **12～16 人月**。  
若已有 Persim 类 loader 经验，可复用「包+宿主」工程方法，但 API/格式仍自有。

---

## 7. 兼容迁移策略（可选）

| 策略 | 说明 |
|------|------|
| **人工重建** | 提供控件/钩子对照表；在 ForgeHMI 重拖并重填 Logic |
| **单向实验导入** | 内部脚本解压 `.ftu` JSON 子集→`.hmui`（**不承诺、不宣传**） |
| **禁止** | 「兼容 FlyThings 工程 / EasyUI so」作为售卖点 |

心智迁移：文档说明 `.ftu`↔`.hmui`、`libzkgui.so`↔`libapphmi.so`、`onButtonClick_*` 命名对应（L3）。

---

## 8. 质量、安全与合规

### 8.1 验收（功能兼容）

1. 设计器拖出开机页：背景 + 2 按钮 + 1 文本  
2. `fh-sim` 可点击改文本、切页  
3. 交叉编译并 ADB/TF 部署到 Linux HMI 板，行为一致  
4. 再改 UI 样式/位置，Logic 用户计数逻辑不丢  
5. （V1）打升级包，重启后仍为新应用  
6. 工程格式检测 **不是** `ZKSW` `.ftu`  

### 8.2 合规清单

- [ ] 无 EasyUI/`libeasyui`/`libzkgui` 原样分发  
- [ ] 无 `ZKSW` 兼容宣传与官方商标冒用  
- [ ] 未承诺 L4/L5  
- [ ] LVGL 及第三方许可证台账齐全  
- [ ] 法务确认商业模式与商标策略  

### 8.3 风险

| 风险 | 对策 |
|------|------|
| 预览 ≠ 真机 | sim 与板端共用 Inflater；关键页强制板测 |
| CodeGen 破坏业务 | 用户区保护；孤儿告警；备份 |
| 绑死某一 GUI | Backend 接口隔离 |
| 做成小 OS | 范围锁工具链+loader |
| 被要求兼容 `.ftu` | 引导购正版或签单独迁移项目 |
| 与 Persim 重构混淆 | 文档明确 C++/so vs JS/prc |

---

## 9. 目录与交付物建议

```text
forgehmi/
  docs/                 # 本设计说明、上板指南、对照表、合规
  schema/
  codegen/              # fh-codegen
  runtime/              # Inflater + Activity + LVGL backend
  loader/               # 板端 hmi_loader
  simulator/            # fh-sim
  designer/             # VS Code 或 Electron 应用
  deploy/               # fh-deploy / fh-pack
  templates/
  examples/hello/
```

交付物：可安装设计器、CLI、模拟器、板端 loader、Hello 示例、部署文档、测试用例、本设计说明。

---

## 10. 总结论

| 维度 | 结论 |
|------|------|
| 竞品本质 | Eclipse 编辑 `.ftu` → 增量 Logic → `libzkgui.so` → EasyUI 宿主；ADB/TF/`update.img` |
| 逆向重点 | L1 宿主加载模型 + L3 文档/CodeGen；IDE 壳可换；OS 层勿进 MVP |
| 兼容策略 | **L1+L2 功能兼容**；格式与运行时自有；拒绝默认 L4/L5 |
| 重构抓手 | **`.hmui` → Inflater/sim → CodeGen → Designer → build/deploy`** |
| 与 LVGL 工具重构差异 | 核心是 **宿主+应用包**，不是导出 `ui_init` C |
| 与 Persim 重构差异 | C++/so/Activity，而非 JS/`.prc` |
| 成功标准 | 同套应用在 sim 与板端可点选；Logic 可迭代；无 `.ftu`/EasyUI 依赖 |

FlyThings 公开卖点是 **拖拽快 + C/C++ 开放 + 智能屏主机 + 量产部署闭环**。ForgeHMI 应用工程闭环兑现这些能力，并用明文 UI 与开源 Backend 降低锁定，而不是兼容器或闭源宿主克隆。若团队已绑定官方屏与 so 生态，应直接采购授权，而不是走本文重构主线。

---

## 11. 参考资料

1. `中科世为/中科世为信息.txt`  
2. `中科世为/中科世为UI_IDE分析文档.md`（§2 原理、§3 主要功能）  
3. `中科世为/FlyThings风格UI_IDE仿制方案.md`（§0 功能对标）  
4. `中科世为/Linux_HMI_UI_IDE分析与仿制方案.md`（§2.5）  
5. http://www.zkswe.com/  
6. https://developer.flythings.cn/zh-hans/docs_brief.html  
7. 界面概览 / UI 与源码对应 / ADB / TF / update.img / Activity / 串口 / 控件文档  
8. 样例 [SampleUI](https://github.com/3guoyangyang7/SampleUI)  
9. 体例参考：`rt-thread/Persim_Studio_竞品逆向与重构设计说明.md`；`beken/…`；`quareline/…`  

---

*本文为设计说明，不构成对中科世为 / FlyThings 的授权或工程兼容承诺；商标与许可以官方为准。默认范围以 Linux HMI 为主；Lite/MCU 见分期 V2。*
