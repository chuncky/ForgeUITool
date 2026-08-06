# qm10xh 上板 Hello（≤10 步）

面向 ForgeUI Kit 生成物接入 **qm10xh** SDK（与 qm10xd 同构，路径宏不同）。

1. 在设计器或 CLI 完成界面，执行 `forgeui generate <工程>`。
2. 配置 SDK 路径（任选其一）：
   - 工程 `project.json` → `sdk.path`
   - 环境变量 `FORGEUI_QM10XH_SDK`
   - CLI：`forgeui export-sdk <工程> --sdk <SDK根目录> --force`
3. 执行导出：生成物复制到 SDK 下 `ui/forgeui_generated`（`copyTargetRel` 可改）。
4. 在平台工程中 `include(.../forgeui_generated/forgeui_generated.cmake)`。
5. 包含头文件：`#include "ui.h"`。
6. 在 `lv_init()` 与 display/indev port 完成之后调用 **`ui_init()`**。
7. 主循环调用 `lv_timer_handler()`。
8. 业务回调写在 `forgeui_generated/custom/ui_events.c`（再生成不覆盖已有实现）。
9. 交叉编译并烧录评估板。
10. 板上应显示默认屏；事件与页面切换与仿真一致。

> 分辨率/色深以工程 `project.json` → `display` 为准；与 qm10xd 模板差异见 SDK 文档。
