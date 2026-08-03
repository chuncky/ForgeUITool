<template>
  <div class="canvas-wrap">
    <div
      v-if="store.currentScreen && store.loaded"
      class="screen"
      :class="{ locked: preview.busy }"
      :style="screenStyle"
      @click="onCanvasClick"
    >
      <WidgetView
        v-for="child in store.currentScreen.children"
        :key="child.id"
        :node="child"
        :editing-disabled="preview.busy"
      />
    </div>
    <div v-else class="empty">打开工程后在此编辑</div>
    <div v-if="preview.busy" class="busy-overlay" aria-live="polite">
      <span>{{ preview.phase || "处理中…" }}</span>
      <small>预览编译在后台进行，画布暂不可编辑</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useProjectStore } from "../stores/project";
import { usePreviewStore } from "../stores/preview";
import WidgetView from "./WidgetView.vue";

const store = useProjectStore();
const preview = usePreviewStore();

const screenStyle = computed(() => {
  const d = store.loaded?.project.display;
  const style = store.currentScreen?.style as { main?: { default?: { bg_color?: string } } };
  return {
    width: `${d?.width ?? 480}px`,
    height: `${d?.height ?? 320}px`,
    background: style?.main?.default?.bg_color || "var(--screen)",
  };
});

function onCanvasClick() {
  if (preview.busy) return;
  store.select(store.screenId);
}
</script>

<style scoped>
.canvas-wrap {
  position: relative;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow: auto;
}

.screen {
  position: relative;
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.screen.locked {
  pointer-events: none;
  opacity: 0.72;
}

.busy-overlay {
  position: absolute;
  inset: 24px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6px;
  pointer-events: none;
  color: var(--text);
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.busy-overlay small {
  color: var(--muted);
  font-size: 12px;
}

.empty {
  color: var(--muted);
}
</style>
