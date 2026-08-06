<template>
  <div v-if="ui.showColorLibrary" class="mask" @click.self="close">
    <div class="dialog">
      <h2>颜色库</h2>
      <p v-if="ui.colorPickHandler" class="pick-hint">选择命名色以填入样式字段（引用为 @id）</p>
      <p v-else class="hint">管理工程命名色（FR-018）。样式字段可引用 @颜色 id。保存/复用整套样式请用属性面板「样式」的保存与样式库。</p>

      <section class="section">
        <div class="toolbar">
          <button type="button" class="primary" @click="addColor">添加颜色</button>
        </div>
        <ul v-if="colors.length" class="list">
          <li v-for="(c, idx) in colors" :key="c.id" class="row">
            <button
              v-if="ui.colorPickHandler"
              type="button"
              class="pick-row"
              @click="onPickColor(c.id)"
            >
              <span class="swatch" :style="{ background: resolve(c.value) }" />
              <span class="name">{{ c.name }}</span>
              <span class="meta">{{ c.id }} · {{ c.value }}</span>
            </button>
            <template v-else>
              <span class="swatch" :style="{ background: resolve(c.value) }" />
              <input v-model="colors[idx].name" class="name-input" />
              <input v-model="colors[idx].value" class="value-input" placeholder="#RRGGBBAA" />
              <input v-model="colors[idx].id" class="id-input" title="引用 id（@id）" />
              <button type="button" class="danger-sm" @click="removeColor(idx)">删</button>
            </template>
          </li>
        </ul>
        <p v-else class="empty">暂无命名色</p>
        <div v-if="!ui.colorPickHandler" class="section-actions">
          <button type="button" class="primary" @click="saveColors">保存颜色库</button>
        </div>
      </section>

      <div class="actions">
        <button @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { displayColorValue, toRgbaHex } from "../utils/color";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();

const colors = ref<Array<{ id: string; name: string; value: string }>>([]);

watch(
  () => ui.showColorLibrary,
  (open) => {
    if (!open) return;
    colors.value = store.colorLibrary.map((c) => ({ ...c }));
  },
);

function resolve(value: string) {
  return displayColorValue(value, store.colorLibrary).replace(/^#/, "#").slice(0, 7);
}

function addColor() {
  const n = colors.value.length + 1;
  colors.value.push({ id: `color_${n}`, name: `颜色 ${n}`, value: "#336699ff" });
}

function removeColor(idx: number) {
  colors.value.splice(idx, 1);
}

async function saveColors() {
  const normalized = colors.value.map((c) => ({
    id: c.id.trim() || "color",
    name: c.name.trim() || c.id,
    value: toRgbaHex(c.value),
  }));
  await store.setColorLibrary(normalized);
}

function onPickColor(id: string) {
  ui.pickColorRef(`@${id}`);
}

function close() {
  ui.clearColorPick();
  ui.showColorLibrary = false;
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  z-index: 70;
}

.dialog {
  width: min(560px, 92vw);
  max-height: 80vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: grid;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 16px;
}

.hint,
.pick-hint,
.empty {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.pick-hint {
  color: var(--accent, #60a5fa);
}

.section {
  display: grid;
  gap: 10px;
}

.toolbar {
  display: flex;
  gap: 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 28px 1fr 1.2fr 0.8fr auto;
  gap: 8px;
  align-items: center;
}

.pick-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  color: inherit;
  cursor: pointer;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.name-input,
.value-input,
.id-input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

.meta,
.name {
  font-size: 12px;
}

.meta {
  color: var(--muted);
}

.primary,
.danger-sm,
.actions button {
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.primary {
  background: var(--accent, #3b82f6);
  border: 1px solid var(--accent, #3b82f6);
  color: #fff;
}

.danger-sm {
  background: transparent;
  border: 1px solid #e11d48;
  color: #fb7185;
}

.section-actions,
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.actions button {
  background: var(--panel-2, var(--bg));
  border: 1px solid var(--border);
  color: var(--text);
}
</style>
