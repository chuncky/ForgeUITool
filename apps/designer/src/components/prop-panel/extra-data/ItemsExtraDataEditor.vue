<template>
  <div class="items-editor">
    <div v-for="(item, idx) in items" :key="idx" class="row">
      <input
        :value="itemText(item)"
        placeholder="选项文本"
        @change="onText(idx, $event)"
      />
      <button type="button" class="icon" title="删除" @click="remove(idx)">×</button>
    </div>
    <button type="button" class="add" @click="add">+ 添加项</button>
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

const items = computed(() => {
  const raw = props.model.items;
  if (!Array.isArray(raw)) return [];
  return raw as unknown[];
});

function itemText(item: unknown) {
  if (item && typeof item === "object" && "text" in item) return String((item as { text: string }).text);
  return String(item ?? "");
}

function emitItems(next: unknown[]) {
  emit("change", { items: next });
}

function onText(idx: number, e: Event) {
  const text = (e.target as HTMLInputElement).value;
  const next = items.value.map((it, i) => (i === idx ? { ...asObj(it), text } : it));
  emitItems(next);
}

function asObj(it: unknown): Record<string, unknown> {
  if (it && typeof it === "object" && !Array.isArray(it)) return { ...(it as object) };
  return { text: String(it ?? "") };
}

function add() {
  emitItems([...items.value, { text: `Item ${items.value.length + 1}` }]);
}

function remove(idx: number) {
  emitItems(items.value.filter((_, i) => i !== idx));
}
</script>

<style scoped>
.items-editor {
  display: grid;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
}

input {
  background: var(--bg);
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
