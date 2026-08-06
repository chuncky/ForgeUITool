<template>
  <div class="keymap-editor">
    <p class="hint">每行空格分隔按键；可用 LVGL 符号名（如 LV_SYMBOL_OK）</p>
    <div v-for="(row, idx) in rows" :key="idx" class="row">
      <input :value="row" :placeholder="`Row ${idx + 1}`" @change="onRow(idx, $event)" />
      <button type="button" class="icon" title="删除行" @click="remove(idx)">×</button>
    </div>
    <button type="button" class="add" @click="add">+ 添加行</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  model: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const rows = computed(() => {
  const raw = props.model.rows;
  if (!Array.isArray(raw)) return [] as string[];
  return raw.map((r) => String(r ?? ""));
});

function emitRows(next: string[]) {
  emit("change", { rows: next });
}

function onRow(idx: number, e: Event) {
  const text = (e.target as HTMLInputElement).value;
  emitRows(rows.value.map((r, i) => (i === idx ? text : r)));
}

function add() {
  emitRows([...rows.value, "key1 key2 key3"]);
}

function remove(idx: number) {
  emitRows(rows.value.filter((_, i) => i !== idx));
}
</script>

<style scoped>
.keymap-editor {
  display: grid;
  gap: 6px;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
}

input {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.icon,
.add {
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.icon {
  width: 28px;
  height: 28px;
  padding: 0;
}

.add {
  padding: 6px 8px;
  justify-self: start;
}
</style>
