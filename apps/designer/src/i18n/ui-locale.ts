/** Designer chrome locale (FR-020) — independent of project i18n (FR-042). */

export type UiLocale = "zh-CN" | "en";

const STORAGE_KEY = "forgeui.designer.uiLocale";

export const UI_STRINGS = {
  "zh-CN": {
    projectSettings: "项目设置",
    widgetLibrary: "控件库",
    colorLibrary: "颜色库",
    i18n: "多语言",
    animations: "动画",
    assets: "资源管理",
    save: "存档",
    history: "历史",
    codeEditor: "代码编辑器",
    aiDesign: "AI设计",
    cLang: "C语言 ▾",
    delivery: "交付 ▾",
    previewLang: "预览",
    logicGraph: "逻辑图",
    memoryEstimate: "内存估算",
    uiLocale: "界面语言",
    clean: "全部清理",
    generate: "生成代码",
    compile: "编译",
    simulate: "模拟运行",
    all: "生成+编译+模拟运行",
    exportSdk: "导出到 SDK",
    packUi: "打包 UI 包",
    packPreview: "UI 包装载预览",
    wasmEmbed: "Wasm IR 预览",
    props: "属性",
    events: "事件",
  },
  en: {
    projectSettings: "Settings",
    widgetLibrary: "Widgets",
    colorLibrary: "Colors",
    i18n: "i18n",
    animations: "Anim",
    assets: "Assets",
    save: "Save",
    history: "History",
    codeEditor: "Code",
    aiDesign: "AI",
    cLang: "C ▾",
    delivery: "Deliver ▾",
    previewLang: "Preview",
    logicGraph: "Logic",
    memoryEstimate: "Memory",
    uiLocale: "UI Lang",
    clean: "Clean all",
    generate: "Generate",
    compile: "Build",
    simulate: "Simulate",
    all: "Generate+Build+Run",
    exportSdk: "Export to SDK",
    packUi: "Pack UI package",
    packPreview: "Preview UI package",
    wasmEmbed: "Wasm IR preview",
    props: "Props",
    events: "Events",
  },
} as const;

export type UiStringKey = keyof (typeof UI_STRINGS)["zh-CN"];

export function loadUiLocale(): UiLocale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "zh-CN") return v;
  } catch {
    /* ignore */
  }
  return "zh-CN";
}

export function saveUiLocale(locale: UiLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function t(locale: UiLocale, key: UiStringKey): string {
  return UI_STRINGS[locale][key] ?? UI_STRINGS["zh-CN"][key] ?? key;
}
