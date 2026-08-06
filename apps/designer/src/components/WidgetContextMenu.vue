<template>
  <FloatingPanelMenu
    :open="ui.widgetContextMenu != null"
    :point="point"
    @update:open="onOpenChange"
  >
    <WidgetActionMenuItems
      v-if="node"
      :locked="!!node.locked"
      :hidden="!!node.hidden"
      @action="onAction"
    />
  </FloatingPanelMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UiNode } from "../env";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { runWidgetMenuAction } from "../utils/widget-menu";
import FloatingPanelMenu from "./FloatingPanelMenu.vue";
import WidgetActionMenuItems from "./WidgetActionMenuItems.vue";

const store = useProjectStore();
const ui = useUiStore();

const point = computed(() => {
  const m = ui.widgetContextMenu;
  return m ? { x: m.x, y: m.y } : null;
});

const node = computed((): UiNode | null => {
  const id = ui.widgetContextMenu?.nodeId;
  if (!id) return null;
  if (store.selectedId === id && store.selectedNode) return store.selectedNode as UiNode;
  // Fallback: walk current screen tree
  const root = store.currentScreen;
  if (!root) return null;
  const walk = (n: UiNode): UiNode | null => {
    if (n.id === id) return n;
    for (const c of n.children ?? []) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root as UiNode);
});

function onOpenChange(open: boolean) {
  if (!open) ui.closeWidgetContextMenu();
}

async function onAction(action: string) {
  const n = node.value;
  ui.closeWidgetContextMenu();
  if (!n) return;
  await runWidgetMenuAction(store, n, action);
}
</script>
