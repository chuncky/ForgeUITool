# AI 设计 — Beken 参照与本产品映射

> **Beken 参照图：** `AI设计界面.png`、`../工作区/工作区11-AI设计.png`、`../设置/设置4.png`  
> **Beken 文档：** `ref/beken/.../doc/zh-cn/workspace-ai-design.md`  
> **本产品契约：** `docs/嵌入式UI工具_MCP接口详细设计说明.md` §3 / §10 / §11  
> **版本：** V1.34（四宿主探测 + 启动 + MCP/Skill 对齐 BK）

## 产品形态（与 Beken 一致）

AI 设计**不是**设计器内嵌聊天框，而是：

1. 顶栏 **「AI设计 ▾」** → 选宿主（Cursor / Codex / TRAE / TRAE CN）
2. 自动就绪 MCP + Skill，打开工程 `.forge-ai/`
3. 在外部 AI 工具里用自然语言改 UI（经 Bridge）
4. 画布底栏 **保存 / 撤销 AI 变更**

## 对照表

| 项 | Beken | ForgeUI |
|----|-------|---------|
| 工作区目录 | `.ai-workspace` | **`.forge-ai`** |
| MCP 名 | `beken_lvgl_ui_designer` | **`forgeui_designer`** |
| Bridge | `127.0.0.1:39001` | **`127.0.0.1:39201`** |
| 顶栏下拉 | 四宿主 + 安装状态 | **同左** |
| 一键启动 | 四宿主均可 | **同左**（打开 `.forge-ai`） |
| 一键装/卸 MCP+Skill | 四宿主 | **同左**（Cursor/TRAE=`mcp.json`；Codex=`config.toml`） |
| Skill | `beken-lvgl-ui-designer` | `resources/ai-skill/forgeui-lvgl-designer`（**须打入** `forgeui-root`） |
| 事务 | 保存/撤销；手动续编自动保存 | 同左 |
| AI 设置 | MCP 服务状态（Bridge READY）+ 编辑器子 Tab + exe/MCP/Skill（含安装版本）装卸/刷新 | **对齐 BK**；刷新有 loading/提示；无启用开关 |
| 探测流水线 | 自定义 → known → App Paths → where（Codex + Store） | **同左**；**四宿主**均查 Uninstall 注册表（非默认盘如 `D:\Programs\Trae CN`） |
| 截图 | 真画布倾向 | 本轮仍为线框 PNG |

## 宿主检测优先级（四宿主统一）

1. `userData/ai-tools.json` 自定义路径（设置页「自定义」）
2. 固定候选路径（Codex / TRAE 含 npm、scoop、WindowsApps 等）
3. **四宿主：** Uninstall 注册表 `InstallLocation` / `DisplayIcon`（覆盖 `D:\Programs\…` 等非默认盘）
4. App Paths（`Cursor.exe` / `Codex.exe` / `Trae.exe` / `Trae CN.exe`）
5. **仅 Codex：** `Get-StartApps` → `OpenAI.Codex_*`（`appx:`）
6. `where` / `which`（`cursor` / `codex` / `trae` / `trae-cn`）

`installed = Boolean(解析到的可启动路径)`；`launchSupported = true`（四宿主）。

## Skill / MCP 落盘路径

| 宿主 | MCP | Skill |
|------|-----|-------|
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/skills/forgeui-lvgl-designer/` |
| Codex | `~/.codex/config.toml` → `[mcp_servers.forgeui_designer]` | `~/.codex/skills/forgeui-lvgl-designer/` |
| TRAE | `%APPDATA%/Trae/User/mcp.json` | `~/.trae/skills/forgeui-lvgl-designer/` |
| TRAE CN | `%APPDATA%/Trae CN/User/mcp.json` | `~/.trae-cn/skills/forgeui-lvgl-designer/` |

## 推荐用法

1. 安装 Cursor / Codex / TRAE / TRAE CN 之一
2. Designer 打开工程并进工作台
3. 顶栏 **AI设计 ▾** → 选择已安装宿主（应显示「已安装」）
4. 自动装 MCP+Skill，并用该宿主打开 **`.forge-ai`**
5. 确认 MCP `forgeui_designer` 已连接；改 UI 后画布底栏 **保存/撤销**
6. MCP 异常：**完全退出** 对应 AI 工具，再从 AI设计重开
7. 若仍「未安装」：设置 → AI → 对应 Tab → **自定义** 选择 exe

## 本轮验收清单（手工）

1. 设置 → AI：四编辑器 Tab 均可「安装/更新」「卸载」「打开工作区」
2. 本机 Cursor 非默认盘仍显示 **已安装**
3. Codex / TRAE（若已装）顶栏显示已安装，可一键启动
4. Agent：`get_editor_state` → `batch_update` 添加按钮 → 画布可见
5. 底栏「保存 AI 变更」→ JSON 落盘；或「撤销」恢复

## 自动化验收

见 [`AI设计验收测试.md`](./AI设计验收测试.md)：`npm run test:ai-design`。

## 不做

- Designer 内嵌 LLM 对话框
- 像素级真画布截图升级
- 「AI智能分析中」全量扫描动效
- 将 Claude Code 加入「AI设计」可启动菜单（与 BK UI 过滤一致）
