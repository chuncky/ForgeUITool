# 7. Packer / Loader（A2）详细设计

> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  
> **章节：** §7  
> **版本：** 与主文档同步（见主文档 / §17 修订记录）

---

## 7.1 包目录

```text
packages/latest/
  manifest.json
  ui/
    project.meta.json      # 自 project 派生的子集
    screens/*.json         # 可与权威同源或规范化 IR JSON
  assets/
    ...
```

`manifest.json`：

```json
{
  "schemaVersion": "1.0.0",
  "packageVersion": "1.0.0",
  "minLoaderVersion": "1.0.0",
  "platform": "qm10xd",
  "display": { "width": 480, "height": 320, "colorDepth": 16 },
  "lvglMajor": 9,
  "lvglVersion": "9.10",
  "entryScreen": "home"
}
```

## 7.2 Packer API

```ts
interface Packer {
  pack(projectRoot: string, outDir?: string): Promise<PackResult>;
}

// MVP：
async function pack() {
  throw new ForgeError("E_PACK_NOT_IMPL"); // 或写空骨架 + 警告
}
```

**V1 填满：** IR → 规范化 `ui/` + 拷贝资源 + 写 manifest；`deliveryMode=static_c` 时跳过。

## 7.3 Loader API（板端 C，V1）

```c
typedef struct forge_ui_package forge_ui_package_t;

int forge_loader_open_file(const char *path, forge_ui_package_t **out);
int forge_loader_open_mem(const void *buf, size_t len, forge_ui_package_t **out);
int forge_loader_check_compat(const forge_ui_package_t *pkg, const forge_loader_caps_t *caps);
int forge_loader_apply(forge_ui_package_t *pkg);   /* 建 LVGL 树 */
void forge_loader_close(forge_ui_package_t *pkg);
```

**兼容失败错误码（NFR-009）：** 见 §12。  
**边界：** 薄 Loader + LVGL；无多 App（C-005）。

## 7.4 默认启用（D-05）

- 新建工程 `deliveryMode=both`。  
- `forgeui generate` 成功后，若 mode∈{`both`,`dynamic_ui`}，自动调用 `pack`（V1）；MVP pack stub 时打日志「已跳过 pack」。  
- 工具设置可改默认，但不改为「未安装的可选插件」。

---
