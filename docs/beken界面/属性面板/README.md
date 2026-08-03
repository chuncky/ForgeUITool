# 属性面板截图（Beken 参照）



## 脚本入口（唯一）



```bash

# 单控件：添加 → 选中 → 截图 → 撤回

python .tmp/capture_component_props.py 文本组



# 批量（按 beken-components.json）

python .tmp/capture_component_props.py --batch --limit 5



# 已手动选中控件，只截图

python .tmp/capture_component_props.py --shot-only --zh 文本组

```



**运行前**：Beken LVGL UI Designer 工作区在前台；建议用控件较少的测试页（如 `cap_props_page`）。



### 脚本流程



1. 控件库搜索（剪贴板粘贴中文名）→ 点磁贴添加  

2. 点「组件树 [N]」标题行 → `End` 选最后一项（**不按 Enter**）  

3. 校验属性首组含锚点九宫格（= 位置信息，非屏幕信息）  

4. 截图 `{中文名}属性-header.png`、`-全窗.png`、`-1~4.png`  

5. `Ctrl+Z` 撤回本次添加  



### 禁止操作（会把选中切回页面/屏幕）



- 点画布空白区  

- 点页面列表  

- 组件树 `End` + `Enter`  

- 顶栏「属性」Tab  



旧脚本（`capture_one_component.py`、`capture_props_v2.py` 等）已停用。



---



## 手工截取规范



1. 打开 Beken LVGL UI Designer 工作区，确保**仅 Beken 窗口在前台**。  

2. 从控件库添加或选中目标控件，确认属性面板首组为「位置信息」（不是「屏幕信息」）。  

3. 属性 Tab 滚到顶部，截取右侧属性区：  

   - `{中文名}属性-1.png`～`-4.png`：分段滚动  

   - `{中文名}属性-全窗.png`：可选  

4. 保存到 `{中文名}属性/` 子目录。  

5. 替换前如目录内已有正确旧图，请先**备份**。  



## 目录命名



与 `docs/工具详细说明手册/控件属性面板使用说明.md` §11 及 Beken 控件库中文名一致。

