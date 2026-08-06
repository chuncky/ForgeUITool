# 5. CodeGen（A1）详细设计

> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  
> **章节：** §5  
> **版本：** 与主文档同步（见主文档 / §17 修订记录）

---

## 5.1 模块职责

`packages/codegen`：`ProjectIR` → 写入 `<codegenDir>/`（非 `custom` 区）+ 首次创建 `<codegenDir>/custom/` 桩。

## 5.2 输出布局（D-07，对标 Beken `beken_generated/`）

> 专项说明：`docs/生成代码问题/单目录生成物设计方案.md`

```text
forgeui_generated/
  forgeui_generated.cmake    # GLOB 全部 .c；SDK/预览统一 include
  ui.h
  ui.c                       # ui_init / ui_deinit / 屏切换 helper 声明
  ui_nav.c                   # V1：切屏/简单动画（对标 SquareLine ui_helpers）
  ui_nav.h
  screens/
    screen_home.c
    screen_home.h
    screen_settings.c
    screen_settings.h
  image/                     # imageMode=c_array 时
  fonts/
  custom/                    # 再生成不覆盖（对标 Beken custom/）
    ui_events.h              # 仅首次生成
    ui_events.c              # 仅首次生成；已存在则跳过
    custom_func.h            # V1 可选
    custom_func.c
```

## 5.3 模板清单（Handlebars）

```text
packages/codegen/templates/
  c/
    ui.h.hbs
    ui.c.hbs
    ui_nav.c.hbs       # V1
    ui_nav.h.hbs
    screen.c.hbs
    screen.h.hbs
    ui.cmake.hbs
    custom/ui_events.h.hbs
    custom/ui_events.c.hbs
    forgeui_generated.cmake.hbs
  partials/
    widgets/
      label.hbs
      button.hbs
      image.hbs
      ...
    events/
      change_screen.hbs    # 调用 ui_nav_load_screen(target, anim, ms)
      call_function.hbs
```

**上下文（最低字段）：** `project`, `screen`, `node`, `ir`, `naming`, `lvglVersion`, `handlers[]`

## 5.4 用户区规则（D-02 / D-07）

| 场景 | 行为 |
|------|------|
| `<codegenDir>/custom/ui_events.c` 不存在 | 按模板生成所有 `handler` 空实现 |
| 已存在 | **整文件不覆盖**；若有新 handler，追加声明/空实现到文件末尾（推荐）或生成 `custom/ui_events_new_stubs.c` 提示合并（详细实现选一种，黄金用例锁死） |
| `--clean-generated` | 只清 `<codegenDir>/` **除 `custom/` 外** 与 `.forge/build-manifest.json`，**从不**清 `custom/` |

**禁止默认 weak 符号**（FR-056 可选，默认关闭）。

## 5.5 生成 API

```ts
interface CodeGenOptions {
  cleanGenerated?: boolean;
  dryRun?: boolean;
}

interface CodeGenResult {
  ok: boolean;
  filesWritten: string[];
  filesSkipped: string[];      // 含 custom/ 跳过
  diagnostics: Diagnostic[];
}

function generate(projectRoot: string, opts?: CodeGenOptions): Promise<CodeGenResult>;
```

## 5.6 构建清单

每次成功生成更新 `.forge/build-manifest.json`：

```json
{
  "generatedAt": "ISO-8601",
  "lvglVersion": "9.10",
  "files": ["forgeui_generated/ui.c", "..."]
}
```

V1：`forgeui generate --prune-orphans` 删除清单外且位于 `<codegenDir>/`（**不含 custom/**）的孤儿文件（对标 EEZ build manifest）。

## 5.7 板端最小集成契约

```c
lv_init();
/* display + indev port（平台提供） */
ui_init();   /* entrySymbol，默认 ui_init */
while (1) {
  lv_timer_handler();
  /* delay */
}
```

业务在 `forgeui_generated/custom/ui_events.c`：`void on_btn_next(void) { ... }`，通过生成区暴露的对象句柄访问控件（句柄命名规则：`ui_<screen>_<nodeId>` 或结构体 `ui.xxx`，在详细模板中固定一种）。

---
