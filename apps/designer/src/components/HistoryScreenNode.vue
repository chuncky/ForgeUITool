<template>
  <div class="hist-node" :style="shellStyle">
    <div class="hist-body" :style="paintBodyStyle">
      <span v-if="caption" class="hist-cap">{{ caption }}</span>
      <HistoryScreenNode
        v-for="c in node.children ?? []"
        :key="c.id"
        :node="c"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Node } from "@forgeui/core/types";
import {
  bodyStyleWithoutBgImage,
  buildWidgetCanvasChrome,
  splitCanvasChrome,
} from "../utils/canvas-chrome";
import HistoryScreenNode from "./HistoryScreenNode.vue";

const props = defineProps<{ node: Node }>();

const chromeParts = computed(() => {
  const chrome = buildWidgetCanvasChrome({
    type: props.node.type,
    frame: props.node.frame,
    props: props.node.props,
    style: props.node.style as Record<string, unknown> | undefined,
  });
  return splitCanvasChrome(chrome);
});

const shellStyle = computed(() => {
  const c = chromeParts.value.shell;
  return {
    left: c.left,
    top: c.top,
    width: c.width,
    height: c.height,
    transform: c.transform,
    transformOrigin: c.transformOrigin,
    zIndex: props.node.frame.zIndex ?? 0,
  };
});

/** Drop bg-image longhands so gradient/solid fill is not overridden by url(...). */
const paintBodyStyle = computed(() => bodyStyleWithoutBgImage(chromeParts.value.body));

const caption = computed(() => {
  const t = props.node.props?.text;
  if (typeof t === "string" && t.trim()) return t;
  if (props.node.type === "button" || props.node.type === "label") return props.node.name;
  return "";
});
</script>

<style scoped>
.hist-node {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;
}
.hist-body {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}
.hist-cap {
  font-size: inherit;
  line-height: 1.2;
  word-break: break-word;
  padding: 2px 4px;
  max-width: 100%;
}
</style>
