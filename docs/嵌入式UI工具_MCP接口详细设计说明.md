# ForgeUI Kit MCP 接口详细设计说明

> **文档类型：** 模块详细设计（MCP / AI 设计子系统）  
> **产品暂名：** ForgeUI Kit  
> **版本：** V1.0  
> **日期：** 2026-07-30  
> **交付分期：** V2（差异化）；MVP 仅接口 + Bridge stub + Skill 骨架  
> **对标竞品：** Beken LVGL UI Designer 2.x MCP（`ref/beken/lvgl_ui_designer_2.0.3/resources/mcp/`、`resources/ai-skill/`）  
> **上游依据：** 《设计需求文档》V2.4 FR-072、AR-020～022、NFR-004；《软件概要设计说明》V1.7 §5.1/§5.11；《软件详细设计说明》V1.2 §11.1  
> **合规：** 功能与体验对齐 Beken AI 路径（L1）；**不**兼容 `beken_lvgl_ui_designer` MCP 名称/Bridge 协议作为 L4；**不**读写 `.bkprj`

---

## 1. 文档说明

### 1.1 目的

在 Beken MCP 已验证的「**外部 AI 宿主 → stdio MCP → HTTP Bridge → 设计器内存模型 → 用户确认保存**」链路上，给出 ForgeUI Kit **自有 MCP Server、Bridge、工具面、事务模型与 Skill** 的字段级与 API 级契约，供 V2 实现与 Cursor/Codex 等集成测试。

### 1.2 范围

| 纳入 | 不纳入 |
|------|--------|
| MCP 工具名、参数 Schema、batch 读写 operation 类型 | AI 模型选型、Prompt 工程 |
| Bridge HTTP API、会话/工程绑定 | 终端里伪造 MCP 命令（Beken 明确禁止） |
| `.forge-ai/` 工作区、Skill 目录结构 | Instrument/SCPI、Flow 调试 |
| 与 `@forgeui/core` Project Model API 映射 | 直接改 `<codegenDir>/`（非 custom）、`custom/` 已有实现 |
| MVP stub 与 V2 填满计划 | 兼容 Beken Bridge 端口/工具名 |

### 1.3 与 Beken 的差异摘要

| 维度 | Beken | ForgeUI Kit |
|------|-------|-------------|
| MCP Server 名 | `beken_lvgl_ui_designer` | **`forgeui_designer`** |
| Bridge 环境变量 | `LVGL_DESIGNER_BRIDGE=http://127.0.0.1:39001` | **`FORGEUI_BRIDGE=http://127.0.0.1:39201`** |
| 工作区目录 | `<project>/.ai-workspace` | **`<project>/.forge-ai/`** |
| 权威工程 | `.bkprj` | **多文件 JSON**（`project.json` + `screens/`） |
| 组件 ID | `wid` | **`id`**（工程内稳定 NodeId） |
| Host Call 事件 | MCP 阶段常禁 `call_function` | V2 MCP **可声明** `CALL_FUNCTION`，但**不**写 `custom/` 实现 |
| 启动 MCP | `LVGL-UI-Designer.exe` + `ELECTRON_RUN_AS_NODE=1` | **`ForgeUI.exe`**（或 `node packages/mcp/dist/server.js` 开发态） |

---

## 2. 总体架构

### 2.1 组件图

```text
┌─────────────────────────────────────────────────────────────────┐
│ 外部 AI 宿主（Cursor / Codex / TRAE …）                          │
│   Skill: forgeui-lvgl-designer  │  MCP Client (stdio)           │
└────────────────────────────┬────────────────────────────────────┘
                             │ JSON-RPC tools/call
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ packages/mcp — forgeui-mcp-server (Node, stdio)                 │
│   解析 MCP 工具 → 校验 aiWorkspacePath → HTTP 转发 Bridge        │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /bridge/invoke
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/designer Main — ForgeUiBridge (HTTP, 127.0.0.1:39201)      │
│   会话：projectRoot + workspacePath + 工作台是否打开              │
│   写路径：BridgeHandler → @forgeui/core ProjectModelApi          │
│   读路径：序列化 IR/树/截图 → JSON 响应                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ applyMutation / validate / subscribe
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ @forgeui/core — Project Model API（AR-020）                      │
│   与 GUI / CLI 共用；禁止 Bridge 旁路写盘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 设计原则（锁定）

1. **Designer 为真源：** AI 只经 MCP 改内存模型；禁止直接编辑权威 JSON 文件（对齐 Beken Skill 核心规则）。  
2. **粗粒度工具面：** 公开工具数量控制在 7～9 个；细粒度 operation 走 `batch_get` / `batch_update`（对齐 Beken 2026 工具面收敛）。  
3. **写事务 + 用户确认：** 首次 MCP 写打开 AI 事务；画布底部 **保存 / 撤销**；未确认时继续 AI 或手动编辑 → 自动合并进同一 pending 集（对齐 Beken 2026 取消 `begin_ai_task` 公开工具后的行为）。  
4. **单页 batch 写限制：** 一个 `batch_update` 不得跨页创建/修改控件树（Beken `BATCH_UPDATE_MULTI_PAGE_FORBIDDEN`）。  
5. **权限边界（AR-022）：** MCP **不得**写 `<codegenDir>/`（非 `custom/`）；**不得**覆盖 `custom/` 已有文件内容；`CALL_FUNCTION` 仅追加新 handler 声明（与 D-02 一致）。  
6. **验收仍靠真 LVGL：** 截图仅辅助布局；生成/预览仍走 CodeGen + SDL（C-002）。

---

## 3. 进程与部署

### 3.1 MCP Server 启动

**生产（Electron 打包）：**

```json
{
  "mcpServers": {
    "forgeui_designer": {
      "type": "stdio",
      "command": "<ForgeUI安装目录>/ForgeUI.exe",
      "args": [
        "<ForgeUI安装目录>/resources/mcp/forgeui-mcp-server.cjs"
      ],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1",
        "FORGEUI_BRIDGE": "http://127.0.0.1:39201"
      }
    }
  }
}
```

**开发态：**

```json
{
  "mcpServers": {
    "forgeui_designer": {
      "type": "stdio",
      "command": "node",
      "args": ["<repo>/packages/mcp/dist/forgeui-mcp-server.js"],
      "env": {
        "FORGEUI_BRIDGE": "http://127.0.0.1:39201"
      }
    }
  }
}
```

### 3.2 Bridge 生命周期

| 阶段 | 行为 |
|------|------|
| Designer 启动 | Main 进程监听 `127.0.0.1:39201`（可配置 `settings.ai.bridgePort`） |
| 打开工程进工作区 | Bridge 绑定 `projectRoot`；写入 Bridge 状态 `READY` |
| 用户点「AI 设计 → Cursor」 | 确保 `.forge-ai/` 存在；用 Cursor 打开该目录；合并 `mcp.json` |
| Designer 关闭 / 离开工作区 | Bridge 返回 `NOT_IN_WORKSPACE`；MCP 写拒绝 |
| 预览/生成进行中 | Bridge 返回 `PREVIEW_BUSY`（对齐 Beken「AI 按钮灰掉」） |

### 3.3 `.forge-ai/` 工作区

```text
<projectRoot>/
  .forge-ai/
    workspace.json       # { projectRoot, openedAt, designerVersion }
    README.md            # 提示：须从 Designer「AI 设计」入口打开
```

每次 MCP 工具调用（除 ping 类）须带：

```ts
aiWorkspacePath: string  // 绝对路径，必须等于 <projectRoot>/.forge-ai
```

Bridge 校验：

- 路径存在且 `workspace.json.projectRoot` 与当前 Designer 打开工程一致  
- 失败码：`AI_WORKSPACE_PATH_REQUIRED` | `AI_WORKSPACE_MISMATCH` | `NO_PROJECT_OPEN`

---

## 4. Bridge HTTP API

### 4.1 通用约定

| 项 | 值 |
|----|-----|
| Base URL | `process.env.FORGEUI_BRIDGE \|\| http://127.0.0.1:39201` |
| _invoke_ | `POST /bridge/invoke` |
| Content-Type | `application/json` |
| 超时 | MCP 侧默认 70s；batch 执行预算 45s（可配置） |
| 最大响应 | 480KB（留余量低于 Cursor 512KB MCP 限制） |

**请求体：**

```json
{
  "operation": "batch_get",
  "aiWorkspacePath": "D:/projects/hello/.forge-ai",
  "params": { "requests": [{ "type": "get_project_summary" }] }
}
```

**成功响应：**

```json
{
  "ok": true,
  "data": { },
  "warnings": []
}
```

**失败响应：**

```json
{
  "ok": false,
  "error": {
    "code": "NOT_IN_WORKSPACE",
    "message": "Designer is not in workspace with an open project."
  }
}
```

### 4.2 Bridge operation 与 MCP 工具映射

| Bridge `operation` | MCP 公开工具 | 说明 |
|--------------------|--------------|------|
| `get_editor_state` | `forgeui_get_editor_state` | 首选首读 |
| `batch_get` | `forgeui_batch_get` | 批量读 |
| `batch_update` | `forgeui_batch_update` | 批量写 |
| `update_node` | `forgeui_update_node` | 单节点粗粒度写（别名） |
| `add_node_tree` | `forgeui_add_node_tree` | 嵌套创建 |
| `screenshot` | `forgeui_get_page_screenshot` | 画布 PNG base64 |
| `import_image` | `forgeui_create_image_asset` | 导入 PNG 到 assets |
| `validate` | （经 batch_get 或内部） | 触发 Schema 校验 |
| `generate` | `forgeui_generate` | 触达 CodeGen，**不写**旁路 |
| `ping` | `forgeui_ping` | 健康检查 / 日志测试 |

---

## 5. MCP 公开工具（V2 冻结名）

> 命名前缀 **`forgeui_`**，与 Beken 工具名不冲突。参数 Schema 采用 JSON Schema draft-07，由 `@forgeui/mcp` 注册。

### 5.1 工具清单

| # | 工具名 | 用途 | MVP |
|---|--------|------|-----|
| 1 | `forgeui_get_editor_state` | 工程+当前页+选中节点+控件类型摘要+约束 | stub |
| 2 | `forgeui_batch_get` | 有序批量读 | stub |
| 3 | `forgeui_batch_update` | 有序批量写 | stub |
| 4 | `forgeui_update_node` | 单节点 properties/styles/events 合并写 | stub |
| 5 | `forgeui_add_node_tree` | 递归创建子树 | stub |
| 6 | `forgeui_get_page_screenshot` | 当前页画布截图 | stub |
| 7 | `forgeui_create_image_asset` | 导入图片资源 | stub |
| 8 | `forgeui_generate` | 触发 A1 CodeGen + 可选 pack | stub |
| 9 | `forgeui_ping` | Bridge 连通性 | 可实现 |

**不公开（Beken 亦已隐藏）：** `begin_ai_task` / `finish_ai_task` — 由 Bridge 在首次写时自动开启事务。

### 5.2 `forgeui_get_editor_state`

**参数：**

```ts
interface GetEditorStateParams {
  aiWorkspacePath: string;          // 必填
  screenId?: string;                // 默认当前页
  includeWidgetTypes?: boolean;     // 默认 true
  includeSpecs?: boolean;           // 默认 false
  widgetTypes?: string[];           // includeSpecs 时，最多 12 个
  includeAssets?: boolean;          // 默认 false
}
```

**返回（节选）：**

```ts
interface EditorState {
  project: {
    name: string;
    platform: string;
    display: { width: number; height: number; colorDepth: number };
    lvglVersion: string;
    deliveryMode: string;
    defaultScreen: string;
  };
  currentScreenId: string;
  screenTree: ScreenTreeNode;       // 简化树，含 id/type/name/frame
  selectedNodeId: string | null;
  widgetTypeSummaries: WidgetTypeSummary[];
  specs?: WidgetSpec[];             // 可选
  assets?: AssetSummary[];
  constraints: {
    maxBatchPayloadBytes: 262144;
    batchTimeBudgetMs: 45000;
    singlePageWritePerBatch: true;
    mcpSupportedActionTypes: string[];
  };
  aiTransaction: {
    pending: boolean;
    changeCount: number;
  };
}
```

### 5.3 `forgeui_batch_get`

**参数：**

```ts
interface BatchGetParams {
  aiWorkspacePath: string;
  requests: BatchGetRequest[];
}

type BatchGetRequest =
  | { type: "get_editor_state"; ref?: string; screenId?: string; includeSpecs?: boolean; widgetTypes?: string[] }
  | { type: "get_project_summary"; ref?: string }
  | { type: "list_screens"; ref?: string }
  | { type: "get_screen_tree"; ref?: string; screenId: string }
  | { type: "get_node"; ref?: string; screenId?: string; nodeId: string }
  | { type: "list_widget_types"; ref?: string }
  | { type: "get_widget_spec"; ref?: string; widgetType: string; /* 单次最多 12 个 spec 请求 */ }
  | { type: "list_assets"; ref?: string; kind?: "image" | "font" }
  | { type: "list_event_triggers"; ref?: string; target?: "node" | "screen" }
  | { type: "list_event_action_types"; ref?: string }
  | { type: "list_events"; ref?: string; targetId: string; screenId?: string }
  | { type: "get_page_screenshot"; ref?: string; screenId?: string };
```

**返回：**

```ts
interface BatchGetResult {
  results: Array<{
    ref?: string;
    ok: boolean;
    data?: unknown;
    error?: BridgeError;
  }>;
}
```

### 5.4 `forgeui_batch_update`

**参数：**

```ts
interface BatchUpdateParams {
  aiWorkspacePath: string;
  mode?: "stop_on_error" | "continue_on_error";  // 默认 stop_on_error
  operations: BatchUpdateOperation[];
}
```

**运行时限制（对齐 Beken）：**

| 限制 | 值 |
|------|-----|
| 载荷上限 | 256 KB |
| 执行时间预算 | ~45s |
| operation 安全上限 | 300（软 guard） |
| 跨页写 | **禁止** → `BATCH_UPDATE_MULTI_PAGE_FORBIDDEN` |
| 超时 | 已执行保留，返回 `timedOut: true`, `pendingFrom: number` |

**返回：**

```ts
interface BatchUpdateResult {
  results: Array<{ index: number; ok: boolean; data?: unknown; error?: BridgeError }>;
  timedOut?: boolean;
  pendingFrom?: number;
  redrawn: boolean;
  aiTransaction: { pending: true; changeCount: number };
}
```

### 5.5 `forgeui_update_node`（粗粒度单节点）

等价于一条 `batch_update` 内 `type: "update_node"`，参数：

```ts
interface UpdateNodeParams {
  aiWorkspacePath: string;
  screenId?: string;
  nodeId: string;
  frame?: Partial<Frame>;
  props?: Record<string, unknown>;
  styles?: StylePatch[];
  events?: Event[];                 // 全量替换该节点 events
}
```

### 5.6 `forgeui_add_node_tree`

```ts
interface AddNodeTreeParams {
  aiWorkspacePath: string;
  screenId?: string;
  parentId?: string | null;         // null = screen 根下
  ref?: string;                     // batch 内后续 nodeRef
  tree: NodeTreeInput;
}

interface NodeTreeInput {
  type: string;
  name: string;
  frame?: Frame;
  props?: Record<string, unknown>;
  styles?: StylePatch[];
  children?: NodeTreeInput[];
}
```

### 5.7 `forgeui_get_page_screenshot`

```ts
interface ScreenshotParams {
  aiWorkspacePath: string;
  screenId?: string;
  maxWidth?: number;                // 默认工程宽度
}
// 返回 { mime: "image/png", base64: "...", width, height }
```

### 5.8 `forgeui_create_image_asset`

```ts
interface CreateImageAssetParams {
  aiWorkspacePath: string;
  name: string;                     // assets 内唯一
  imagePath: string;                // AI 侧已生成的 PNG 绝对路径
  targetWidth: number;
  targetHeight: number;
  purpose?: "icon" | "background" | "general";
}
// 返回 { assetId, relativePath, cSymbol? }
```

### 5.9 `forgeui_generate`

```ts
interface GenerateParams {
  aiWorkspacePath: string;
  cleanGenerated?: boolean;
  runPackIfBoth?: boolean;          // deliveryMode 含 dynamic 时
}
// 返回 CodeGenResult 摘要；失败带 diagnostics
```

---

## 6. `batch_update` Operation 类型详表

### 6.1 页面级

| type | 字段 | 映射 ProjectModelApi |
|------|------|----------------------|
| `switch_screen` | `screenId` | 仅 Bridge UI 当前页切换 |
| `add_screen` | `name?`, `screenId?` | `addScreen` |
| `remove_screen` | `screenId` | `removeScreen`（≥1 页约束） |
| `rename_screen` | `screenId`, `name` | `renameScreen` |
| `set_default_screen` | `screenId` | 改 `project.defaultScreen` |
| `update_screen_style` | `screenId?`, `part?`, `state?`, `property`, `value` | `updateNode` on screen root |

### 6.2 节点级（细粒度，仅经 batch）

| type | 映射 |
|------|------|
| `add_node` | `addNode` |
| `remove_node` | `removeNode` |
| `update_node_property` | `updateNode` props 单键 |
| `update_node_style` | `updateNode` style 单条 |
| `move_node` | `moveNode` |
| `update_node` | 粗粒度，同 §5.5 |
| `add_node_tree` | 多次 `addNode` 事务 |

**命名规则（对齐 Beken component-naming）：**

- `name`：字母/数字/下划线，字母或下划线开头，页内唯一，最长 50  
- `id`：Bridge 可自动生成 `node_<nanoid>`；`ref` 供同 batch 引用

### 6.3 事件级（V2 初版）

| type | 说明 |
|------|------|
| `add_event` | `setEvents` 合并 |
| `update_event` | 按 `event.id` 替换 |
| `remove_event` | 按 `event.id` 删除 |

**MVP/V2 初版支持的 actionType（映射自有 Action.type）：**

| MCP actionType | 自有 Action | 备注 |
|----------------|-------------|------|
| `change_screen` | `CHANGE_SCREEN` | `target`, `anim?`, `ms?` |
| `set_prop` | `SET_PROP` | V1 起 |
| `call_function` | `CALL_FUNCTION` | **仅**声明 handler；不写 `custom/` 实现体 |

**V2 暂不支持（后置或手动）：** 时间轴动画、`switch_language`（随 FR-042 i18n 一起开）

### 6.4 batch 内引用

与 Beken 相同：operation 设 `ref` 返回 `nodeId`/`screenId` 后，后续可用 `nodeRef` / `parentRef` / `screenRef`。

```json
{
  "operations": [
    {
      "type": "add_node_tree",
      "ref": "card",
      "screenId": "home",
      "tree": { "type": "container", "name": "status_card", "children": [] }
    },
    {
      "type": "update_node_property",
      "nodeRef": "card",
      "screenId": "home",
      "property": "border_width",
      "value": 1
    }
  ]
}
```

---

## 7. AI 变更事务与 UI 反馈

### 7.1 状态机

```text
Idle
  │ 首次 batch_update / update_node / add_node_tree
  ▼
AiPending（内存模型已改，磁盘未强制保存）
  │ 用户点「保存」→ commitAiTransaction → save(project) → Idle
  │ 用户点「撤销」→ rollbackAiTransaction → Idle
  │ 用户手动编辑 → 合并进同一 AiPending
  │ 用户发起新一轮 AI（未点保存）→ Beken 行为：自动保存上一轮 → 新 AiPending
  ▼
```

### 7.2 Bridge 内部

```ts
interface AiTransactionService {
  beginIfNeeded(): void;
  snapshotBeforeFirstWrite(): ProjectSnapshot;  // 内存快照
  rollback(): void;
  commit(): void;                               // 写盘 + 纳入 historyStore
  isPending(): boolean;
}
```

### 7.3 画布反馈（对齐 Beken）

| 阶段 | UI |
|------|-----|
| MCP 读 | 可选轻量「分析中」扫描动效 |
| MCP 写 | 画布外框高亮 |
| 事务 pending | 底部栏 **保存** / **撤销** |
| 保存后 | 纳入 `.forge/history/`（V1） |

---

## 8. 与 Project Model API 映射

| MCP / Bridge | `@forgeui/core` | 禁止 |
|--------------|-----------------|------|
| 所有写 operation | `applyMutation` → `validate` | 直接 `fs.writeFile` screens |
| `forgeui_generate` | `generate(projectRoot)` | 写 generated 模板外内容 |
| 读 screen_tree | `getScreen` + 遍历 | 读 `.bkprj` |
| 截图 | Canvas 离屏渲染或 DOM→PNG | 冒充 SDL 像素验收 |
| 导入图片 | AssetPipeline + `updateNode` 引用 | — |

**校验管道（AR-021）：** 每次 batch 写后 `validate()`；error 级诊断 → operation 失败；warning → 附在 `warnings[]`。

---

## 9. 错误码

| Code | HTTP | 含义 | 用户提示 |
|------|------|------|----------|
| `BRIDGE_UNAVAILABLE` | 503 | Designer 未启动或 Bridge 未监听 | 先打开 ForgeUI |
| `NO_PROJECT_OPEN` | 409 | 无打开工程 | 新建/打开工程 |
| `NOT_IN_WORKSPACE` | 409 | 未进工作区 | 进入工作区 |
| `AI_WORKSPACE_PATH_REQUIRED` | 400 | 缺 aiWorkspacePath | 从「AI 设计」启动 |
| `AI_WORKSPACE_MISMATCH` | 409 | 路径与当前工程不一致 | 重新从 Designer 打开 AI |
| `PREVIEW_BUSY` | 409 | 生成/预览进行中 | 停止预览后再用 AI |
| `BATCH_UPDATE_MULTI_PAGE_FORBIDDEN` | 400 | 跨页写 | 按页拆分 batch |
| `BATCH_UPDATE_PAYLOAD_TOO_LARGE` | 413 | >256KB | 减小 batch |
| `BATCH_PARTIAL_TIMEOUT` | 408 | 超时部分成功 | 从 pendingFrom 继续 |
| `INVALID_NODE_ID` | 404 | 节点不存在 | — |
| `INVALID_WIDGET_TYPE` | 400 | 未注册 type | 查 list_widget_types |
| `UNSUPPORTED_SCHEMA_FIELD_SKIPPED` | 200+w | 粗粒度写跳过未知字段 | warning |
| `CALL_FUNCTION_USER_FORBIDDEN` | 403 | MCP 试图写 custom/ 实现 | 仅允许声明 handler |

---

## 10. Skill 包（`resources/ai-skill/forgeui-lvgl-designer/`）

对标 Beken `beken-lvgl-ui-designer` Skill；**自有文案与 workflow**，不复制 GPL/厂商 Skill 全文。

### 10.1 目录

```text
resources/ai-skill/forgeui-lvgl-designer/
  SKILL.md
  mcp-workflow.md
  mcp-tools.md              # 工具参数权威说明（本文 §5～§6 的用户向摘要）
  component-selection.md
  layout-guidelines.md
  events-guidelines.md
  visual-quality-gate.md
  troubleshooting.md
  scripts/
    resize-image.py           # create_image_asset 前置缩放（可选）
```

### 10.2 SKILL.md 核心规则（摘要）

1. 只通过 **`forgeui_*` MCP 工具**改 UI；不要在终端执行工具名。  
2. 每次调用带 **`aiWorkspacePath`** = 当前 `.forge-ai` 绝对路径。  
3. 首读 **`forgeui_get_editor_state`**；后续 **`forgeui_batch_get` / `forgeui_batch_update`**。  
4. 禁止直接改 `project.json` / `screens/*.json`。  
5. 可见布局改完后 **`forgeui_get_page_screenshot`** 自检（对齐 Beken 强制截图门禁）。  
6. 复杂动画、i18n、MicroPython → 说明限制，引导用户手动或用 FR 分期能力。

### 10.3 安装器（Designer「设置 → AI 设置」）

| 动作 | 行为 |
|------|------|
| 安装 MCP | 合并 `~/.cursor/mcp.json` 的 `forgeui_designer` 段 |
| 安装 Skill | 复制到 `~/.cursor/skills/forgeui-lvgl-designer/` |
| 卸载 | 仅移除 forgeui 段，不覆盖其它 server |
| 版本检查 | 对比 `resources/mcp/VERSION` 与已安装 |

---

## 11. Designer 集成要点

### 11.1 入口（已有 §9.6 `tb.ai`）

| 步骤 | 行为 |
|------|------|
| 1 | 检测 Cursor/Codex/TRAE 是否安装 |
| 2 | 确保 MCP + Skill 版本 |
| 3 | 创建/更新 `.forge-ai/` |
| 4 | `shell.openExternal` 或 `cursor .forge-ai` |
| 5 | Bridge 状态设为 READY |

### 11.2 IPC（Main 新增）

| 通道 | 用途 |
|------|------|
| `ai:getBridgeStatus` | 设置页展示 |
| `ai:installMcp` / `ai:installSkill` | 写全局配置 |
| `ai:onTransactionSaved` | Renderer 清除 pending UI |

Bridge 本身跑在 **Main**（与 spawn 预览同级），避免 Renderer 暴露 HTTP。

---

## 12. 分期与 MVP Stub

| 阶段 | 交付 | 验收 |
|------|------|------|
| **MVP** | `packages/mcp` 导出工具 Schema；Bridge 返回 `NOT_IMPLEMENTED`；Skill 骨架；设置页说明 | AC-AR-003 文档可指认接口 |
| **V2-alpha** | `forgeui_ping` + `get_editor_state` + 只读 batch_get | Cursor 能连上并读 Hello 工程 |
| **V2-beta** | batch_update 页面/节点/事件；事务 UI | UI-07：AI 改双页布局 → 保存 → JSON 落盘 |
| **V2** | 截图、create_image_asset、generate；安装器 | FR-072；NFR-004 授权流 |

### 12.1 MVP Stub 实现

```ts
// packages/mcp/src/server.ts
export function registerTools(server: McpServer) {
  for (const tool of FORGEUI_MCP_TOOLS) {
    server.tool(tool.name, tool.schema, async () => ({
      content: [{ type: "text", text: JSON.stringify({ ok: false, error: { code: "E_MCP_NOT_IMPL" } }) }],
    }));
  }
}
```

---

## 13. 安全

| 项 | 措施 |
|----|------|
| 绑定地址 | Bridge 仅 `127.0.0.1` |
| 鉴权 | 首版无 token；依赖本机 + aiWorkspacePath 校验；V2+ 可选 `FORGEUI_BRIDGE_TOKEN` |
| 路径 | 拒绝 `aiWorkspacePath` 路径穿越；`imagePath` 必须在用户可读目录 |
| 授权 | 设置页「启用 AI 设计」开关；默认关（NFR-004） |
| 审计 | `.forge/ai-audit.log` 记录 operation 摘要（无 prompt 正文） |

---

## 14. 测试用例

| ID | 步骤 | 期望 |
|----|------|------|
| MCP-01 | 无 Designer → `forgeui_ping` | `BRIDGE_UNAVAILABLE` |
| MCP-02 | 打开 Hello，batch_get summary | 返回 platform=qm10xd |
| MCP-03 | batch_update 添加 button | 画布可见；JSON 未落盘直至保存 |
| MCP-04 | 保存事务 | `screens/home.json` 含新节点 |
| MCP-05 | 撤销事务 | 恢复首次写前树 |
| MCP-06 | 跨页 batch_update | `BATCH_UPDATE_MULTI_PAGE_FORBIDDEN` |
| MCP-07 | `forgeui_generate` | 产生 `<codegenDir>/`；**不**改已有 `custom/ui_events.c` |
| MCP-08 | 错误 aiWorkspacePath | `AI_WORKSPACE_MISMATCH` |

---

## 15. 参考资料

| 材料 | 路径 |
|------|------|
| Beken MCP 实现 | `ref/beken/lvgl_ui_designer_2.0.3/resources/mcp/` |
| Beken MCP 工具说明 | `ref/beken/.../ai-skill/beken-lvgl-ui-designer/mcp-tools.md` |
| Beken AI 设计用户文档 | `ref/beken/.../doc/zh-cn/workspace-ai-design.md` |
| 竞品对比报告 MCP 结论 | `docs/嵌入式UI工具_竞品对比分析报告.md` §4.1、§8.2 |
| ForgeUI 需求 AR | `docs/嵌入式UI工具_设计需求文档.md` §8.2.1 |
| ForgeUI 核心 API | `docs/嵌入式UI工具_软件详细设计说明.md` §4.1 |

---

## 16. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.0 | 2026-07-30 | 首版：对标 Beken 2.x MCP/Bridge/Skill；映射 ForgeUI Project Model；冻结 forgeui_* 工具面 |

---

*本文为实现契约；与需求 AR-022 冲突时以「禁止写 codegen 非 custom 区、禁止覆盖 custom/」为准。Beken 工具名与 Bridge 协议仅作阅读参考，不构成兼容承诺。*
