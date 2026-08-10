<template>
  <div
    class="screen"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      background: bg,
    }"
  >
    <HistoryScreenNode v-if="root" :node="root" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Node } from "@forgeui/core/types";
import { forgeColorToCss } from "../utils/canvas-chrome";
import HistoryScreenNode from "./HistoryScreenNode.vue";

const props = defineProps<{
  root: Node | null | undefined;
  width: number;
  height: number;
}>();

const bg = computed(() => {
  const style = props.root?.style as Record<string, unknown> | undefined;
  return forgeColorToCss(style?.bg_color, "#ffffff") ?? "#ffffff";
});
</script>

<style scoped>
.screen {
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}
</style>
