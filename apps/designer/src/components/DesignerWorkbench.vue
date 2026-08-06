<template>

  <div class="workbench">

    <WorkspaceToolbar />

    <div class="body">

      <aside class="side left">

        <WidgetLibraryPanel v-show="ui.widgetLibraryVisible" />

        <PageTreePanel />

      </aside>

      <main class="center">

        <div class="center-stack">

          <Canvas />

          <BottomAuxPanel />

        </div>

      </main>

      <aside class="side right">

        <InspectorPanel />

      </aside>

    </div>

    <ProjectSettingsDialog />

    <AssetsDialog />

    <ColorLibraryDialog />
    <SaveStyleDialog />
    <StyleLibraryDialog />
    <I18nDialog />

    <AnimationTimelineDialog />

    <LogicGraphDialog />

    <MemoryEstimateDialog />

    <WasmEmbedDialog />

    <HistoryDialog />

    <AiAssistDialog />

    <CodeEditorDrawer />

    <AiTransactionBar />
    <WidgetContextMenu />
  </div>

</template>



<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import WorkspaceToolbar from "./WorkspaceToolbar.vue";

import WidgetLibraryPanel from "./WidgetLibraryPanel.vue";

import PageTreePanel from "./PageTreePanel.vue";

import Canvas from "./Canvas.vue";

import InspectorPanel from "./InspectorPanel.vue";

import ProjectSettingsDialog from "./ProjectSettingsDialog.vue";

import AssetsDialog from "./AssetsDialog.vue";

import ColorLibraryDialog from "./ColorLibraryDialog.vue";
import SaveStyleDialog from "./SaveStyleDialog.vue";
import StyleLibraryDialog from "./StyleLibraryDialog.vue";

import I18nDialog from "./I18nDialog.vue";

import AnimationTimelineDialog from "./AnimationTimelineDialog.vue";

import LogicGraphDialog from "./LogicGraphDialog.vue";

import MemoryEstimateDialog from "./MemoryEstimateDialog.vue";

import WasmEmbedDialog from "./WasmEmbedDialog.vue";

import HistoryDialog from "./HistoryDialog.vue";

import AiAssistDialog from "./AiAssistDialog.vue";

import CodeEditorDrawer from "./CodeEditorDrawer.vue";

import BottomAuxPanel from "./BottomAuxPanel.vue";
import AiTransactionBar from "./AiTransactionBar.vue";
import WidgetContextMenu from "./WidgetContextMenu.vue";

import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { isEditableKeyboardTarget } from "../utils/keyboard";

const ui = useUiStore();
const store = useProjectStore();
let offAi: (() => void) | undefined;

function onKeyDown(e: KeyboardEvent) {
  if (isEditableKeyboardTarget(e.target)) return;

  if (e.key === "Delete" || e.key === "Backspace") {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!store.selectedId || store.selectedId === store.screenId) return;
    e.preventDefault();
    void store.removeSelected();
    return;
  }

  if (!e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) {
    e.preventDefault();
    void store.undo();
  } else if (key === "y" || (key === "z" && e.shiftKey)) {
    e.preventDefault();
    void store.redo();
  } else if (key === "s") {
    e.preventDefault();
    void store.save();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  offAi = window.forgeuiDesktop?.onAiModelUpdated?.((payload) => {
    store.applyAiModelUpdate(payload);
  });
  void store.refreshAiTransactionState();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  offAi?.();
});
</script>



<style scoped>

.workbench {

  display: grid;

  grid-template-rows: auto 1fr auto;

  height: 100%;

  min-height: 0;

}



.body {

  display: grid;

  grid-template-columns: 260px 1fr 300px;

  min-height: 0;

  border-top: 1px solid var(--border);

}



.side {

  display: flex;

  flex-direction: column;

  min-height: 0;

  background: var(--panel);

  border-right: 1px solid var(--border);

  overflow: hidden;

}



.side.right {

  border-right: none;

  border-left: 1px solid var(--border);

}



.center {

  min-width: 0;

  min-height: 0;

  display: flex;

  flex-direction: column;

  background: var(--canvas-bg);

}



.center-stack {

  flex: 1;

  min-height: 0;

  display: flex;

  flex-direction: column;

}



.center-stack :deep(.canvas-root) {

  flex: 1;

  min-height: 0;

}

</style>


