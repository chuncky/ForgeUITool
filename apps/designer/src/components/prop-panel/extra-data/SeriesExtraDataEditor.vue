<template>
  <div class="series-editor">
    <div v-for="(s, idx) in series" :key="idx" class="block">
      <div class="row">
        <label>
          名称
          <input :value="s.name" @change="onName(idx, $event)" />
        </label>
        <label>
          颜色
          <input type="color" :value="s.color" @input="onColor(idx, $event)" />
        </label>
        <button type="button" class="icon" title="删除系列" @click="remove(idx)">×</button>
      </div>
      <label class="values">
        数值（逗号分隔）
        <input :value="valuesText(s)" placeholder="10, 20, 30" @change="onValues(idx, $event)" />
      </label>
    </div>
    <button type="button" class="add" @click="add">+ 添加系列</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface SeriesRow {
  name: string;
  color: string;
  values: number[];
}

const props = defineProps<{
  model: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const series = computed(() => {
  const raw = props.model.series;
  if (!Array.isArray(raw)) return [] as SeriesRow[];
  return raw.map(asSeries);
});

function asSeries(item: unknown): SeriesRow {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const values = Array.isArray(o.values)
      ? o.values.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      : [];
    return {
      name: typeof o.name === "string" ? o.name : "Series",
      color: typeof o.color === "string" && o.color ? o.color : "#4a90e2",
      values,
    };
  }
  return { name: "Series", color: "#4a90e2", values: [] };
}

function valuesText(s: SeriesRow) {
  return s.values.join(", ");
}

function parseValues(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
}

function emitSeries(next: SeriesRow[]) {
  emit("change", { series: next });
}

function onName(idx: number, e: Event) {
  const name = (e.target as HTMLInputElement).value;
  emitSeries(series.value.map((s, i) => (i === idx ? { ...s, name } : s)));
}

function onColor(idx: number, e: Event) {
  const color = (e.target as HTMLInputElement).value;
  emitSeries(series.value.map((s, i) => (i === idx ? { ...s, color } : s)));
}

function onValues(idx: number, e: Event) {
  const values = parseValues((e.target as HTMLInputElement).value);
  emitSeries(series.value.map((s, i) => (i === idx ? { ...s, values } : s)));
}

function add() {
  emitSeries([
    ...series.value,
    {
      name: `Series ${series.value.length + 1}`,
      color: "#4a90e2",
      values: [10, 20, 30, 40, 50],
    },
  ]);
}

function remove(idx: number) {
  emitSeries(series.value.filter((_, i) => i !== idx));
}
</script>

<style scoped>
.series-editor {
  display: grid;
  gap: 10px;
}

.block {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px;
  align-items: end;
}

label {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

.values {
  grid-column: 1 / -1;
}

input {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

input[type="color"] {
  width: 36px;
  height: 32px;
  padding: 2px;
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
