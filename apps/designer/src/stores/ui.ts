import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const widgetLibraryVisible = ref(true);
  const showNewProject = ref(false);
  const showProjectSettings = ref(false);
  const showAssets = ref(false);
  const showColorLibrary = ref(false);
  const showStyleLibrary = ref(false);
  const showSaveStyle = ref(false);
  const showI18n = ref(false);
  const showAnimations = ref(false);
  const showLogicGraph = ref(false);
  const showMemoryEstimate = ref(false);
  const showHistory = ref(false);
  const showWasmEmbed = ref(false);
  const uiLocale = ref<"zh-CN" | "en">("zh-CN");
  /** FR-071 designer play preview: live overrides keyed by nodeId */
  const animPreview = ref<Record<string, { x?: number; y?: number; w?: number; h?: number; opacity?: number; rotation?: number }>>({});
  const showAiAssist = ref(false);
  const showCodeEditor = ref(false);
  const logPanelCollapsed = ref(false);
  /** FR-010g bottom auxiliary tabs (events stay in right Inspector). */
  const bottomAuxTab = ref<"log" | "assets" | "config">("log");
  /** FR-013c canvas widget context menu (client coords). */
  const widgetContextMenu = ref<{ nodeId: string; x: number; y: number } | null>(null);
  const rightTab = ref<"props" | "events">("props");
  const cMenuOpen = ref(false);
  const deliveryMenuOpen = ref(false);

  /** When set, AssetsDialog picks an image and invokes this callback (FR-040 / imageSrc). */
  const imagePickHandler = ref<((path: string) => void) | null>(null);
  /** When set, AssetsDialog picks a font id for text_font / fontRef. */
  const fontPickHandler = ref<((fontId: string) => void) | null>(null);
  /** When set, ColorLibraryDialog picks a color ref (@id) for a style field. */
  const colorPickHandler = ref<((ref: string) => void) | null>(null);
  /** Draft for SaveStyleDialog (current Part×State snapshot). */
  const saveStyleDraft = ref<{
    part: string;
    state: string;
    props: Record<string, unknown>;
    widgetType?: string;
  } | null>(null);

  function openStyleLibrary() {
    showStyleLibrary.value = true;
  }

  function openSaveStyle(draft: {
    part: string;
    state: string;
    props: Record<string, unknown>;
    widgetType?: string;
  }) {
    saveStyleDraft.value = draft;
    showSaveStyle.value = true;
  }

  function closeSaveStyle() {
    showSaveStyle.value = false;
    saveStyleDraft.value = null;
  }

  function toggleWidgetLibrary() {
    widgetLibraryVisible.value = !widgetLibraryVisible.value;
  }

  function toggleLogPanel() {
    logPanelCollapsed.value = !logPanelCollapsed.value;
  }

  function openWidgetContextMenu(nodeId: string, x: number, y: number) {
    widgetContextMenu.value = { nodeId, x, y };
  }

  function closeWidgetContextMenu() {
    widgetContextMenu.value = null;
  }

  function openAssetsForImagePick(handler: (path: string) => void) {
    imagePickHandler.value = handler;
    fontPickHandler.value = null;
    showAssets.value = true;
  }

  function pickImageAsset(path: string) {
    imagePickHandler.value?.(path);
    imagePickHandler.value = null;
    showAssets.value = false;
  }

  function clearImagePick() {
    imagePickHandler.value = null;
  }

  function openAssetsForFontPick(handler: (fontId: string) => void) {
    fontPickHandler.value = handler;
    imagePickHandler.value = null;
    showAssets.value = true;
  }

  function pickFontAsset(fontId: string) {
    fontPickHandler.value?.(fontId);
    fontPickHandler.value = null;
    showAssets.value = false;
  }

  function clearFontPick() {
    fontPickHandler.value = null;
  }

  function openColorsForPick(handler: (ref: string) => void) {
    colorPickHandler.value = handler;
    showColorLibrary.value = true;
  }

  function pickColorRef(ref: string) {
    colorPickHandler.value?.(ref);
    colorPickHandler.value = null;
    showColorLibrary.value = false;
  }

  function clearColorPick() {
    colorPickHandler.value = null;
  }

  function setUiLocale(locale: "zh-CN" | "en") {
    uiLocale.value = locale;
    try {
      localStorage.setItem("forgeui.designer.uiLocale", locale);
    } catch {
      /* ignore */
    }
  }

  function initUiLocale() {
    try {
      const v = localStorage.getItem("forgeui.designer.uiLocale");
      if (v === "en" || v === "zh-CN") uiLocale.value = v;
    } catch {
      /* ignore */
    }
  }

  return {
    widgetLibraryVisible,
    toggleWidgetLibrary,
    showNewProject,
    showProjectSettings,
    showAssets,
    showColorLibrary,
    showStyleLibrary,
    showSaveStyle,
    saveStyleDraft,
    openStyleLibrary,
    openSaveStyle,
    closeSaveStyle,
    showI18n,
    showAnimations,
    showLogicGraph,
    showMemoryEstimate,
    showHistory,
    showWasmEmbed,
    uiLocale,
    setUiLocale,
    initUiLocale,
    animPreview,
    showAiAssist,
    showCodeEditor,
    logPanelCollapsed,
    toggleLogPanel,
    bottomAuxTab,
    widgetContextMenu,
    openWidgetContextMenu,
    closeWidgetContextMenu,
    rightTab,
    cMenuOpen,
    deliveryMenuOpen,
    imagePickHandler,
    fontPickHandler,
    colorPickHandler,
    openAssetsForImagePick,
    pickImageAsset,
    clearImagePick,
    openAssetsForFontPick,
    pickFontAsset,
    clearFontPick,
    openColorsForPick,
    pickColorRef,
    clearColorPick,
  };
});
