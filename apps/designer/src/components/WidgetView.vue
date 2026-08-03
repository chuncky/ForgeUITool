<template>
  <div
    v-if="!node.hidden"
    class="widget"
    :class="{ on: store.selectedId === node.id, locked: node.locked, [node.type]: true }"
    :style="boxStyle"
    @click.stop="onSelect"
    @mousedown.stop="onDragStart"
  >
    <template v-if="node.type === 'label'">{{ node.props.text }}</template>
    <template v-else-if="node.type === 'button'">
      <span>{{ node.props.text || "Button" }}</span>
    </template>
    <template v-else-if="node.type === 'image'">IMG</template>
    <template v-else>{{ node.type }}</template>
    <WidgetView v-for="c in node.children" :key="c.id" :node="c" :editing-disabled="editingDisabled" />
    <div
      v-if="store.selectedId === node.id && !node.locked"
      class="handle"
      @mousedown.stop="onResizeStart"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { UiNode } from "../env";
import { useProjectStore } from "../stores/project";

const props = defineProps<{ node: UiNode; editingDisabled?: boolean }>();
const store = useProjectStore();

const live = ref<{ x: number; y: number; w: number; h: number } | null>(null);

const boxStyle = computed(() => {
  const f = live.value ?? props.node.frame;
  const style = props.node.style as {
    main?: { default?: { text_color?: string; bg_color?: string; radius?: number } };
  };
  const def = style?.main?.default;
  const radius = def?.radius != null ? `${def.radius}px` : props.node.type === "button" ? "6px" : undefined;
  return {
    left: `${f.x}px`,
    top: `${f.y}px`,
    width: `${f.w}px`,
    height: `${f.h}px`,
    color: def?.text_color || "#F0F4F8",
    background: def?.bg_color || (props.node.type === "button" ? "#334e68" : "transparent"),
    borderRadius: radius,
  };
});

const editingDisabled = computed(() => props.editingDisabled ?? false);

function onSelect() {
  if (editingDisabled.value) return;
  store.select(props.node.id);
}

function onDragStart(e: MouseEvent) {
  if (editingDisabled.value || props.node.locked) return;
  if (e.button !== 0) return;
  store.select(props.node.id);
  const startX = e.clientX;
  const startY = e.clientY;
  const ox = props.node.frame.x;
  const oy = props.node.frame.y;
  live.value = { ...props.node.frame };

  const onMove = (ev: MouseEvent) => {
    live.value = {
      ...live.value!,
      x: Math.max(0, Math.round(ox + (ev.clientX - startX))),
      y: Math.max(0, Math.round(oy + (ev.clientY - startY))),
    };
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!live.value) return;
    const frame = { ...live.value };
    live.value = null;
    if (frame.x === ox && frame.y === oy) return;
    await store.patchSelected({ frame });
    await store.alignSelected({ recordHistory: false });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function onResizeStart(e: MouseEvent) {
  if (editingDisabled.value || props.node.locked) return;
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const ow = props.node.frame.w;
  const oh = props.node.frame.h;
  live.value = { ...props.node.frame };

  const onMove = (ev: MouseEvent) => {
    live.value = {
      ...live.value!,
      w: Math.max(16, Math.round(ow + (ev.clientX - startX))),
      h: Math.max(16, Math.round(oh + (ev.clientY - startY))),
    };
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!live.value) return;
    const frame = { ...live.value };
    live.value = null;
    if (frame.w === ow && frame.h === oh) return;
    await store.patchSelected({ frame });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
</script>

<style scoped>
.widget {
  position: absolute;
  border: 1px dashed transparent;
  display: grid;
  place-items: center;
  font-size: 13px;
  user-select: none;
  cursor: move;
}

.widget.on {
  border-color: var(--accent);
  outline: 1px solid rgba(61, 156, 240, 0.35);
}

.handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 10px;
  height: 10px;
  background: var(--accent);
  border-radius: 2px;
  cursor: nwse-resize;
}

.widget.locked {
  cursor: default;
  opacity: 0.85;
}

.button {
  border-radius: inherit;
}

.image {
  background: #243b53;
  color: var(--muted);
}
</style>
