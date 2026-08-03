# qm10xd 上板 Hello（≤10 步）

面向 ForgeUI Kit 生成物接入 **qm10xd** SDK。

1. 在设计器或 CLI 完成界面，执行 `forgeui generate <工程>`。
2. 配置 SDK 路径（任选其一）：
   - 工程 `project.json` → `sdk.path`
   - 环境变量 `FORGEUI_QM10XD_SDK`
   - CLI：`forgeui export-sdk <工程> --sdk <SDK根目录> --force`
3. 执行导出：生成物复制到 SDK 下 `ui/generated` 与 `ui/user`（`copyTargetRel` 可改）。
4. 在平台工程中把 `ui/generated`、`ui/user` 加入编译（参考导出目录旁的本文件）。
5. 包含头文件：`#include "ui.h"`（注意 include 路径指向 `ui/generated`）。
6. 在 `lv_init()` 与 display/indev port 完成之后调用 **`ui_init()`**。
7. 主循环调用 `lv_timer_handler()`。
8. 业务回调写在 `ui/forgeui_generated/custom/ui_events.c`（再生成不会覆盖已有实现）。SDK CMake：`include(.../forgeui_generated.cmake)`。
9. 交叉编译并烧录评估板。
10. 板上应显示默认屏（Hello 双页工程为 Home）；点击 Next 可切到 Settings。

> 本工具不做烧录 IDE。烧录/调试仍用既有 qm10x 工具链。
