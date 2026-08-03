<template>
  <PropGroup>
    <template #title>行为配置</template>

    <label class="field">
      预览状态
      <select :value="previewState" @change="onPreviewState">
        <option v-for="s in PREVIEW_STATES" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
    </label>

    <div class="flags">
      <p class="flags-label">对象标志</p>
      <label v-for="flag in LVGL_OBJECT_FLAGS" :key="flag.id" class="check-row">
        <input type="checkbox" :checked="hasFlag(flag.id)" @change="toggleFlag(flag.id, $event)" />
        <span>{{ flag.label }}</span>
      </label>
    </div>
  </PropGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PropGroup from "./PropGroup.vue";
import { LVGL_OBJECT_FLAGS, PREVIEW_STATES } from "./constants";

const props = defineProps<{
  nodeProps: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const previewState = computed(() => String(props.nodeProps.preview_state ?? "default"));

function flagList(): string[] {
  const raw = props.nodeProps.lvgl_flags;
  return Array.isArray(raw) ? raw.map(String) : [];
}

function hasFlag(id: string) {
  return flagList().includes(id);
}

function onPreviewState(e: Event) {
  emit("change", { preview_state: (e.target as HTMLSelectElement).value });
}

function toggleFlag(id: string, e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  const set = new Set(flagList());
  if (checked) set.add(id);
  else set.delete(id);
  emit("change", { lvgl_flags: [...set] });
}
</script>

<style scoped>
.field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.flags {
  display: grid;
  gap: 6px;
}

.flags-label {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

.check-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text);
}
</style>
