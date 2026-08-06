# LVGL Pro 官方 UI 工具：仿制方案

> 依据分析文档、综合稿、**本机 2.0.1 安装包实测**与官网整理。  
> **格式已锁定：** 自有 JSON；不兼容 Pro XML。  
> **功能已锁定：** 对齐 Pro（含 Figma 等）。  
> **官方宿主实测：** Theia 1.69 + Electron 40 + `lved-runtime.wasm`（v9.4/v9.5）+ 内置 Figma Flow（本机 HTTP/WS，默认 9111/9112）+ `code-export.jsc`。  
> 仿制对齐能力与架构，**不**复用官方 XML / 闭源字节码 / Flow 扩展。

---

## 0. 路线与合规

### 0.1 双锁定

| 维度 | 约定 |
|------|------|
| **格式** | 自有 Schema；磁盘优先 JSON；可选 YAML；方言须与 Pro XML 不同构 |
| **功能** | **对齐 Pro 公开能力面**（含 Figma、Online、CLI、专业能力） |
| **量产** | 导出标准 LVGL C（`generated`/`user`） |
| **Figma 落点** | 插件/导入 **只写自有 JSON**，禁止输出官方 Pro XML |

若必须官方 Pro XML + 官方支持 → **买 Pro**。本方案是「功能对齐、格式自有」。

### 0.2 XML 规范边界

固件可用官方 XML；**对外发布读写官方 XML 规范的编辑器/生成器需许可**。本工具与 Figma 插件均不读写官方 Pro XML。

### 0.4 原厂主要功能清单（对标用）

依据官网、GitHub README Features、Pro 文档与分析文档 §3。仿制时按能力对齐，**格式与二进制自有**。

| 类别 | 原厂主要功能 | 仿制建议落点 |
|------|--------------|--------------|
| 套件 | Editor + Online Viewer + Figma + CLI | MVP：Editor+CodeGen+Preview；V1：CLI；V1～V2：Figma/Online |
| 环境 | Win/macOS/Linux；Theia+Electron | MVP：轻量 Electron/Tauri；不必首期 Theia |
| 工程 | 多文件明文声明式 | 自有 JSON 多文件；**禁止** Pro XML |
| 编辑 | XML Mode + Design Mode | Monaco(JSON)+Design 双模 |
| 预览 | Wasm 真 LVGL + Inspector | 自有 loader→Wasm 或 SDL；以真 LVGL 验收 |
| 组件 / 表达式 | Component API、`$`/`#`、表达式 | 自有 Schema 等价能力 |
| 绑定 / 动画 / i18n | Subjects、Timeline、翻译 | V1 起按优先级 |
| 资源 / 多 Target | 图字、内存估算、多分辨率 | V1 |
| 导出 C | gen + user wrapper | MVP 必做 |
| 运行时 XML | 板上装载 | V2/可选；勿抄官方 Engine |
| 测试 / 调试 | UI Test、Editor 内调试 C | V1～V2 |
| Figma Flow | 本机桥写 XML | **自研插件→自有 JSON** |
| Online | viewer.lvgl.io | 自建 Web 读自有工程 |
| CLI / CI | validate/generate/test | 自有 CLI；勿用官方 token 体系 |
| AI | 官方 MCP（XML） | 自有 MCP 读自有 JSON（V2） |
| 脚手架 / 示例 | Zephyr/VS Code 等 + Learn by Examples | V1 起提供自有模板 |

闭环主路径（原厂）：**组件/屏 → 真预览 →（可选）Figma/在线 → 导出 C 或 CI → 上板**。

---

## 1. 目标：功能对齐，格式自有

> **Pro 级功能面 + 自有 JSON 工程 → 真 LVGL 预览 → generated/user 导出 C → CLI / Figma / Online。**

| Pro 能力 | 对齐方式 | 不要 |
|----------|----------|------|
| 声明式工程 | 自有 JSON 多文件 | Pro XML |
| 双模编辑 | Monaco(JSON)+Design | 必须 VS Code 壳 |
| 真预览+Inspector | 自有 loader→真 LVGL | DOM 唯一验收 |
| 导出 C | `*_gen`/user | 官方导出兼容层 |
| **Figma Flow** | **自研插件读 Figma→自有 JSON** | 输出 Pro XML；绑官方 Flow |
| Online Viewer | 自建 Web 读自有工程 | 抄品牌域名 |
| CLI/Test/MCP | 自有工程 | 官方 token/XML MCP |
| Subjects/动画/i18n | 自有 Schema 字段 | — |

---

## 2. 架构（含 Figma）

```text
Figma 插件 ──本机桥──► Designer（JSON+Design+Inspector+连 Figma）
                            │
                     自有 JSON 工程
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   CodeGen→C          Preview(真LVGL)         CLI
        │
   Online 预览 ◄── Git/打包 ──┘
```

**Figma 数据流：**

```text
Figma 文件/选区
 → 读结构、Auto Layout、token、资源
 → 可选：控件类型标注、原型跳转、subject 绑定
 → Editor 本机服务
 → globals.json + components/ + screens/ + assets/
 → 真 LVGL 预览校验 → generate C
```

补充路径：Figma REST/导出包只读导入（弱于插件）；Inspect 单层样式复制进 JSON。

---

## 3. 分期（功能对齐）

### 3.1 MVP（可上板）

Schema；8～12 控件；多页事件；CodeGen；真预览；Design 基础；SDK 文档。  
Figma/Online/Test 已列入总目标，本阶段可暂缓交付。

### 3.2 V1（专业 Editor + Figma MVP）

Component `api`；样式/资源；双模+Inspector；CLI；  
**Figma 插件 MVP：样式 + Frame/组件/资源 → 自有 JSON，本机连 Editor，预览正确。**

### 3.3 V2（对齐 Pro 余下能力）

Figma 增强（标注类型、导航、variants、绑定）；Subjects/Timeline/i18n；UI Test；Online；自定义 Widget；自有 MCP。

**永不做：** Pro XML 兼容。

---

## 4. 工作拆分

| 序号 | 工作包 | 周期 | 交付 |
|------|--------|------|------|
| 0 | 合规+**功能对齐清单** | 2～3 天 | 对照 Pro 的 checklist |
| 1 | Schema+示例 | 1～2 周 | JSON Schema；Hello |
| 2 | CodeGen | 2～3 周 | generated/user/cmake |
| 3 | Preview | 2～4 周 | 自有格式→lv_obj |
| 4 | Designer MVP | 6～10 周 | 五区+预览 |
| 5 | SDK 文档 | 1～2 周 | 上板说明 |
| 6 | V1 编辑增强+CLI | 1～2 月 | api/样式/Inspector/CLI |
| **7** | **Figma 插件+本机桥** | **1.5～3 月** | **读 Figma→写 JSON** |
| 8 | V2 专业能力 | 2～4 月 | 绑定/动画/Test/i18n |
| 9 | Online+MCP+Widget | 按需 | 协作与扩展 |

到 V1+Figma MVP 约 **12～18 人月**；接近 Pro 套件约 **22～30 人月**。  
需 **Figma 插件开发（TypeScript）** 编制。

---

## 5. 自有工程格式

同综合稿：`project.json` / `globals.json` / `screens/` / `components/` / `assets/` / `generated/` / `user/`。  
Figma 导入只写该树。禁止 Pro 式 `project.xml` 工作流。

---

## 6. CodeGen / 预览 / Designer

- CodeGen：只吃自有工程。  
- Preview：SDL→Wasm；工具条含「连接 Figma」。  
- Designer：Electron/Tauri + Monaco(JSON Schema) + Design。

---

## 7. Figma 怎么做（对齐 Flow，落点 JSON）

官方安装包：`plugins/lvgl.flow`（Express+WS；端口预设 Alpha **9111/9112** 等；写出 XML）。仿制：**同模型，写自有 JSON**。

| 能力 | 实现要点 |
|------|----------|
| 本机桥 | 插件↔本地 HTTP/WS；多端口预设 |
| 读屏/组件/token/资源 | → screens/components/globals/assets |
| 意图标注 / 原型导航 | 控件类型、`load_screen` |
| Inspect | 单层样式进 JSON |
| 禁止 | 输出 Pro XML；复用官方 Flow/`code-export.jsc` |

---

## 7.1 预览怎么做（对齐 Wasm）

官方：`preview-bin/lved-runtime.wasm`（按 LVGL 9.4/9.5 分套）。仿制：MVP 用 SDL；V1 自研 Wasm runtime 吃自有 JSON；勿依赖官方 `liblv_xml` 预览包。

---

## 8. Designer 壳

| 路径 | 说明 |
|------|------|
| 轻量 Electron/Tauri + 自研 UI | **推荐起步**（官方是重 Theia，首期不必等价） |
| Theia/Code-OSS 二次分发 | 外形更像，工期/体积接近官方，慎选 |

预览条含「连接 Figma」；声明式用 Monaco+自有 JSON Schema。

---

## 9. CLI / Online / 仓库

```text
ui-cli validate | generate | preview-build | test
```

```text
packages/
  schema/ codegen/ preview-host/ designer/
  figma-plugin/
  online-viewer/
```

---

## 10. 选型

| 诉求 | 建议 |
|------|------|
| 官方 Pro XML + 官方支持 | 买 Pro |
| Pro 级功能（含 Figma）+ 自控可发 | **本文** |
| 轻量拖拽即可 | Beken |

---

## 11. 验收

**MVP：** JSON 双页；真预览；generate+user；可上板；不兼容 Pro XML。  
**V1：** api+CLI；**Figma 选定 Frame 导入 JSON 且预览正确**。  
**V2：** 标注/导航；绑定或动画或 Test 或 Online 主路径通过。

---

## 12. 风险

| 风险 | 对策 |
|------|------|
| Figma 语义难 | 分阶段；强制标注；视觉回归 |
| 写出 Pro XML / 复用官方 .jsc | Schema 门禁；禁止解包业务字节码当依赖 |
| 做成完整 Theia 拖死进度 | 首期轻量壳 + Wasm/SDL |
| 预览≠稿 | 导入后真 LVGL 验收 |

---

## 13. 总结论

| 维度 | 结论 |
|------|------|
| 官方实测 | Theia+Electron；双版本 `lved-runtime.wasm`；Flow 本机桥；导出有 .jsc |
| 格式 | 自有 JSON，不兼容 Pro XML |
| 功能 | **对齐 Pro（含 Figma）** |
| 顺序 | Schema→CodeGen→Preview→Designer→CLI→**Figma**→Online/高级 |

公开能力对标见 **§0.4** / 分析文档 **§3**。

一句话：

> **功能对齐原工具；格式自有 JSON。预览与 Figma 对齐官方 Wasm + 本机桥架构，壳层首期宜轻量，不必先做 Theia。**

---

## 参考资料

1. `LVGL_Pro官方UI工具分析文档.md`（§3 主要功能；§1.1 安装包实测）  
2. `LVGL_Pro官方UI工具_分析与仿制方案.md`  
3. `LVGL_Pro官方UI工具_竞品逆向与重构设计说明.md`（L1+L2 兼容重构总设计）  
4. 本机：`D:\Program Files\LVGL_Pro_Editor`  
5. https://lvgl.io/pro ；https://github.com/lvgl/lvgl_pro （或 lvgl_editor）README Features  
6. https://lvgl.io/docs/pro/figma ；https://lvgl.io/docs/pro/syntax/xml-license  

---

*技术规划建议，不构成法律意见。*
