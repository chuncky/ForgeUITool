# 11. 扩展点 Stub（AR）

> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  
> **章节：** §11  
> **版本：** 与主文档同步（见主文档 / §17 修订记录）

---

> **MCP 完整契约**见《嵌入式UI工具_MCP接口详细设计说明.md》；本节保留模块落点摘要。

## 11.1 MCP（V2，AR-020～022；对标 Beken MCP + Skill）

MCP Server 名：**`forgeui_designer`**；Bridge：**`FORGEUI_BRIDGE=http://127.0.0.1:39201`**；工作区：**`.forge-ai/`**。

公开工具（V2 冻结）：

```text
forgeui_get_editor_state
forgeui_batch_get
forgeui_batch_update
forgeui_update_node
forgeui_add_node_tree
forgeui_get_page_screenshot
forgeui_create_image_asset
forgeui_generate
forgeui_ping
```

`batch_get` / `batch_update` 内部 operation 类型与 Project Model API 映射见 MCP 详设 §5～§6。

**工作流（Beken 式）：** 外部 AI 宿主 → stdio MCP → HTTP Bridge → Project Model API → validate → 设计器刷新；用户 **保存/撤销** AI 事务。

权限：显式授权；只改模型；不改 `custom/` 已有实现；生成仅经 `forgeui_generate` → CodeGen。

## 11.2 Importer（AR-030～031）

```ts
interface Importer {
  id: string;
  canHandle(file: string): boolean;
  import(file: string, model: ProjectModelApi): Promise<MutationResult>;
}
```

内置：`ForgeuiBundleImporter`（unbundle）；`FigmaImporter` stub → `E_IMPORT_NOT_IMPL`。

## 11.3 Logic Graph（AR-050）

事件仅存 JSON；`apps/designer` 不实现逻辑图画布；禁止把事件只保存在 Vue 组件 state。

---
