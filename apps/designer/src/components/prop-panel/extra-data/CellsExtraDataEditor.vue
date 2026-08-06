<template>
  <div class="cells-editor">
    <div class="toolbar">
      <button type="button" class="add" @click="addRow">+ 行</button>
      <button type="button" class="add" @click="addCol">+ 列</button>
    </div>
    <div v-if="grid.length" class="grid" :style="gridStyle">
      <template v-for="(row, r) in grid" :key="r">
        <div v-for="(cell, c) in row" :key="`${r}-${c}`" class="cell">
          <input :value="cell" :placeholder="`${r},${c}`" @change="onCell(r, c, $event)" />
          <button
            v-if="c === row.length - 1 && grid.length > 1"
            type="button"
            class="icon row-del"
            title="删除行"
            @click="removeRow(r)"
          >
            −
          </button>
        </div>
      </template>
    </div>
    <button
      v-if="grid[0]?.length > 1"
      type="button"
      class="add col-del"
      @click="removeCol(grid[0]!.length - 1)"
    >
      − 列
    </button>
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

function normalizeGrid(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [["Cell"]];
  const rows = raw.map((row) => {
    if (!Array.isArray(row)) return [String(row ?? "")];
    return row.map((c) => String(c ?? ""));
  });
  return rows.length ? rows : [["Cell"]];
}

const grid = computed(() => normalizeGrid(props.model.cells));

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${grid.value[0]?.length ?? 1}, minmax(0, 1fr))`,
}));

function emitCells(next: string[][]) {
  emit("change", { cells: next });
}

function onCell(r: number, c: number, e: Event) {
  const text = (e.target as HTMLInputElement).value;
  const next = grid.value.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? text : cell)));
  emitCells(next);
}

function addRow() {
  const cols = grid.value[0]?.length ?? 1;
  emitCells([...grid.value, Array.from({ length: cols }, (_, i) => `R${grid.value.length + 1}C${i + 1}`)]);
}

function addCol() {
  emitCells(grid.value.map((row, ri) => [...row, `R${ri + 1}C${row.length + 1}`]));
}

function removeRow(r: number) {
  if (grid.value.length <= 1) return;
  emitCells(grid.value.filter((_, i) => i !== r));
}

function removeCol(c: number) {
  if ((grid.value[0]?.length ?? 0) <= 1) return;
  emitCells(grid.value.map((row) => row.filter((_, i) => i !== c)));
}
</script>

<style scoped>
.cells-editor {
  display: grid;
  gap: 8px;
}

.toolbar {
  display: flex;
  gap: 6px;
}

.grid {
  display: grid;
  gap: 4px;
}

.cell {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  align-items: center;
}

input {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  min-width: 0;
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
  width: 24px;
  height: 24px;
  padding: 0;
}

.add {
  padding: 4px 8px;
}

.col-del {
  justify-self: start;
}
</style>
