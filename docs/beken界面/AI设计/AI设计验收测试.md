# AI 设计验收测试

> 自动化：`npm run test:ai-design`  
> 对标：Cursor / Bridge / MCP 写路径（添加与修改控件）

## 自动化覆盖

| 层 | 文件 | 内容 |
|----|------|------|
| Cursor stdio | `tests/ai_design_acceptance.test.ts` | `initialize` / `tools/list` / Content-Length `tools/call` 添加按钮、更新 label |
| 控件矩阵 | 同上单测循环 | **每个调色板控件**在同一临时工程上 `add_node` + `update_node` |
| 嵌套树 | `forgeui_add_node_tree` | container + 子 button |
| Bridge HTTP | `createForgeUiBridge` | `aiWorkspacePath` 匹配添加；错路径 → `AI_WORKSPACE_MISMATCH` |
| Live（可选） | `FORGEUI_LIVE_BRIDGE=1` | 对运行中设计器 `39201` 实测加按钮 |

```bash
# CI / 日常
npm run test:ai-design

# 设计器已打开工程时
FORGEUI_LIVE_BRIDGE=1 npm run test:ai-design
```

## Cursor 手工最小验收（至少一个控件）

1. 打开 ForgeUI → 打开工程 → 工作台  
2. 顶栏 **AI设计 → Cursor**（打开 `.forge-ai`）  
3. 确认 MCP `forgeui_designer` 绿灯；Settings → MCP 可刷新  
4. 在 Cursor 对话：  
   > 用 forgeui 工具在当前页添加一个按钮，文字为「验收按钮」  
5. 画布出现按钮；底栏 **保存 AI 变更**  
6. 再要求修改按钮文字 → 画布更新 → 再保存  

失败排查见 `resources/ai-skill/forgeui-lvgl-designer/troubleshooting.md`。

## 与现有测试关系

- `tests/mcp_tools.test.ts`：单点 MCP 能力  
- `tests/designer_ai_panel.test.ts`：设置页 / 检测 / Skill 打包  
- **本套件**：AI 设计「能加、能改、走 Cursor/Bridge 路径」的回归网
