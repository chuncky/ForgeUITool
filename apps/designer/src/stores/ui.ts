import { defineStore } from "pinia";

import { ref } from "vue";



export const useUiStore = defineStore("ui", () => {

  const widgetLibraryVisible = ref(true);

  const showNewProject = ref(false);

  const showProjectSettings = ref(false);

  const showAssets = ref(false);

  const showAiAssist = ref(false);

  const showCodeEditor = ref(false);

  /** 工作区中部下方日志面板是否收起（对标 Beken 固定日志区，默认展开） */
  const logPanelCollapsed = ref(false);

  /** 右栏属性检查器 Tab：属性 | 事件（对标 Beken） */
  const rightTab = ref<"props" | "events">("props");

  const cMenuOpen = ref(false);
  const deliveryMenuOpen = ref(false);

  function toggleWidgetLibrary() {

    widgetLibraryVisible.value = !widgetLibraryVisible.value;

  }



  function toggleLogPanel() {

    logPanelCollapsed.value = !logPanelCollapsed.value;

  }



  return {

    widgetLibraryVisible,

    toggleWidgetLibrary,

    showNewProject,

    showProjectSettings,

    showAssets,

    showAiAssist,

    showCodeEditor,

    logPanelCollapsed,

    toggleLogPanel,

    rightTab,

    cMenuOpen,
    deliveryMenuOpen,
  };

});


