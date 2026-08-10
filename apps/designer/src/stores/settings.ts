import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface RecentProject {
  root: string;
  name: string;
  platform: string;
  width: number;
  height: number;
  openedAt: string;
}

export type SettingsNavTab = "general" | "workbench" | "shortcuts" | "ai";
export type UiThemeId = "midnight" | "charcoal" | "pearl";

export interface GlobalSettings {
  defaultPlatform: "qm10xd" | "qm10xv" | "qm10xh";
  sdkPathQm10xd: string;
  previewBackend: "sdl" | "wasm";
  /** Designer chrome locale (single source; syncs uiLocale). */
  locale: "zh-CN" | "en";
  recentProjects: RecentProject[];
  uiTheme: UiThemeId;
  /** Workbench: hide grid when true (BK「隐藏网格」). */
  hideGrid: boolean;
  hideEventLinks: boolean;
  alignSnapPx: number;
}

const STORAGE_KEY = "forgeui.designer.settings.v1";

export const UI_THEMES: Array<{ id: UiThemeId; label: string }> = [
  { id: "midnight", label: "午夜蓝" },
  { id: "charcoal", label: "炭黑" },
  { id: "pearl", label: "珍珠白" },
];

function defaults(): GlobalSettings {
  return {
    defaultPlatform: "qm10xd",
    sdkPathQm10xd: "",
    previewBackend: "sdl",
    locale: "zh-CN",
    recentProjects: [],
    uiTheme: "midnight",
    hideGrid: false,
    hideEventLinks: false,
    alignSnapPx: 2,
  };
}

function load(): GlobalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<GlobalSettings> & { aiDesignEnabled?: boolean };
    const { aiDesignEnabled: _drop, ...rest } = parsed;
    void _drop;
    const merged = { ...defaults(), ...rest };
    if (merged.alignSnapPx < 1 || merged.alignSnapPx > 5) merged.alignSnapPx = 2;
    return merged;
  } catch {
    return defaults();
  }
}

function applyThemeToDocument(theme: UiThemeId) {
  document.documentElement.dataset.theme = theme;
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<GlobalSettings>(load());
  const settingsTab = ref<SettingsNavTab>("general");

  applyThemeToDocument(settings.value.uiTheme);

  watch(
    settings,
    (v) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
      applyThemeToDocument(v.uiTheme);
    },
    { deep: true },
  );

  function rememberProject(entry: Omit<RecentProject, "openedAt">) {
    const next: RecentProject = { ...entry, openedAt: new Date().toISOString() };
    const list = settings.value.recentProjects.filter((p) => p.root !== next.root);
    list.unshift(next);
    settings.value.recentProjects = list.slice(0, 12);
  }

  function removeRecent(root: string) {
    settings.value.recentProjects = settings.value.recentProjects.filter((p) => p.root !== root);
  }

  function openSettingsTab(tab: SettingsNavTab) {
    settingsTab.value = tab;
  }

  return {
    settings,
    settingsTab,
    rememberProject,
    removeRecent,
    openSettingsTab,
    applyThemeToDocument,
  };
});
