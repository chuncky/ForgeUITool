/** Read-only shortcut catalog for Settings → 快捷键 (BK-aligned help list). */
export interface ShortcutEntry {
  keys: string;
  action: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  items: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "general",
    title: "通用操作",
    items: [
      { keys: "Ctrl+S", action: "存档" },
      { keys: "Ctrl+Z", action: "撤回" },
      { keys: "Ctrl+Shift+Z / Ctrl+Y", action: "重做" },
      { keys: "Delete / Backspace", action: "删除选中控件" },
    ],
  },
  {
    id: "view",
    title: "视图操作",
    items: [
      { keys: "滚轮", action: "画布缩放" },
      { keys: "中键拖拽 / 空格+拖拽", action: "平移画布" },
      { keys: "Ctrl+0", action: "缩放到 100%" },
    ],
  },
  {
    id: "widget",
    title: "组件操作",
    items: [
      { keys: "方向键", action: "微调选中控件位置" },
      { keys: "Ctrl+D", action: "复制选中控件（若已绑定）" },
    ],
  },
];
