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

export interface GlobalSettings {
  defaultPlatform: "qm10xd" | "qm10xv" | "qm10xh";
  sdkPathQm10xd: string;
  previewBackend: "sdl" | "wasm";
  locale: "zh-CN" | "en";
  recentProjects: RecentProject[];
}

const STORAGE_KEY = "forgeui.designer.settings.v1";

function defaults(): GlobalSettings {
  return {
    defaultPlatform: "qm10xd",
    sdkPathQm10xd: "",
    previewBackend: "sdl",
    locale: "zh-CN",
    recentProjects: [],
  };
}

function load(): GlobalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<GlobalSettings>(load());

  watch(
    settings,
    (v) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
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

  return { settings, rememberProject, removeRecent };
});
