# 8. SDK 交付适配（原「平台插件」；D-08）

> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  
> **章节：** §8  
> **版本：** 与主文档同步（见主文档 / §17 修订记录）

---

> **纠正：** 生成物对多板 **同一份**。本模块只负责把 `forgeui_generated/` **整目录拷贝**到客户 SDK，以及上板文档；**禁止**按 `platform` 改写 C / UI 包。

```ts
interface SdkDeliveryAdapter {
  id: string; // 如 "qm10xd" — 仅标识拷贝目标路径/文档，非 CodeGen 输入
  defaultSdkPathHints(): string[];
  copyCodegenDir(src: string, sdkPath: string): Promise<{ ok: boolean; diagnostics: Diagnostic[] }>;
  boardHelloDoc(): string;
}
```

## 8.1 接口

实现上可继续沿用现有 `PlatformPlugin` 命名空间，但语义以 `SdkDeliveryAdapter` 为准（拷贝路径 / 文档，**不**改生成物）。

```ts
interface PlatformPlugin { // = SdkDeliveryAdapter
  id: string;
  displayName: string;
  defaultSdkPathHints(): string[];
  resolveSdkPath(project: ProjectMeta, globalCfg: GlobalConfig): string | null;
  copyGenerated(projectRoot: string, sdkPath: string, opts?: { force?: boolean }): Promise<CopyResult>;
  helloDocPath(): string;
  boardTemplateDir(): string; // 仅脚手架/文档，非 CodeGen 方言
}
```

## 8.2 默认拷贝行为（以 qm10xd SDK 布局为例）

| 步骤 | 说明 |
|------|------|
| 1 | 读取工程/全局 SDK 路径提示（与生成内容无关） |
| 2 | 将 **整个** `<codegenDir>/` 拷贝到 SDK 约定相对路径；SDK 侧 `include(.../forgeui_generated.cmake)` |
| 3 | `--force` 仅覆盖生成区约定目录，不删业务其它文件 |
| 4 | 输出下一步：文档中「调用 `ui_init`」链接 |

**不做：** 烧录、ADB、完整 SDK 编译驱动（OUT）；**不做** 按板型改写 `forgeui_generated/`。

## 8.3 xv/xh

V1：复制 qm10xd 插件骨架改路径宏与文档；注册进 `platforms/index.ts`。

---
