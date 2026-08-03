<template>
  <PropGroup>
    <template #title>{{ isScreen ? "屏幕信息" : "位置信息" }}</template>

    <template v-if="isScreen">
      <div class="grid2">
        <label>
          宽
          <input type="number" min="16" :value="displayWidth" @change="onDisplaySize('width', $event)" />
        </label>
        <label>
          高
          <input type="number" min="16" :value="displayHeight" @change="onDisplaySize('height', $event)" />
        </label>
      </div>
    </template>
    <template v-else>
      <div class="grid4">
        <label>x <input type="number" :value="frame.x" @change="onFrame('x', $event)" /></label>
        <label>y <input type="number" :value="frame.y" @change="onFrame('y', $event)" /></label>
        <label>宽 <input type="number" min="16" :value="frame.w" @change="onFrame('w', $event)" /></label>
        <label>高 <input type="number" min="16" :value="frame.h" @change="onFrame('h', $event)" /></label>
      </div>
    </template>
  </PropGroup>
</template>

<script setup lang="ts">
import PropGroup from "./PropGroup.vue";

defineProps<{
  isScreen: boolean;
  frame: { x: number; y: number; w: number; h: number };
  displayWidth: number;
  displayHeight: number;
}>();

const emit = defineEmits<{
  "update:frame": [patch: Record<string, number>];
  "update:display": [patch: { width?: number; height?: number }];
}>();

function onFrame(key: string, e: Event) {
  emit("update:frame", { [key]: Number((e.target as HTMLInputElement).value) });
}

function onDisplaySize(key: "width" | "height", e: Event) {
  const value = Math.max(16, Number((e.target as HTMLInputElement).value));
  emit("update:display", { [key]: value });
}
</script>

<style scoped>
label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.grid4 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
