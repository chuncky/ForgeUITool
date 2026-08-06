<template>
  <div v-if="ui.showHistory" class="mask" @click.self="close">
    <div class="dialog">
      <h2>历史版本</h2>
      <p class="hint">存档（Ctrl+S）时自动写入 `.forge/history/`。恢复前会备份当前状态。</p>

      <div class="toolbar">
        <input v-model="newLabel" class="label-input" placeholder="快照标签（可选）" />
        <button type="button" class="primary" :disabled="!store.loaded" @click="createSnap">立即快照</button>
        <button type="button" :disabled="loading" @click="refresh">刷新</button>
      </div>

      <ul v-if="items.length" class="list">
        <li v-for="s in items" :key="s.id" class="row">
          <div class="info">
            <span class="id">{{ s.id }}</span>
            <span v-if="s.label" class="label">{{ s.label }}</span>
            <span class="time">{{ formatTime(s.createdAt) }}</span>
          </div>
          <button type="button" class="restore" @click="restore(s.id)">恢复</button>
        </li>
      </ul>
      <p v-else class="empty">暂无历史快照，请先存档</p>

      <div class="actions">
        <button @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();

const items = ref<Array<{ id: string; label?: string; createdAt: string }>>([]);
const loading = ref(false);
const newLabel = ref("");

watch(
  () => ui.showHistory,
  (open) => {
    if (open) void refresh();
  },
);

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function refresh() {
  loading.value = true;
  try {
    items.value = await store.fetchSnapshots();
  } finally {
    loading.value = false;
  }
}

async function createSnap() {
  const meta = await store.createNamedSnapshot(newLabel.value.trim());
  if (meta) {
    newLabel.value = "";
    await refresh();
  }
}

async function restore(id: string) {
  const ok = await store.restoreSnapshot(id);
  if (ok) {
    ui.showHistory = false;
  }
}

function close() {
  ui.showHistory = false;
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 24px;
}

.dialog {
  width: min(560px, 100%);
  max-height: min(80vh, 640px);
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  display: grid;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 16px;
}

.hint,
.empty {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.label-input {
  flex: 1;
  min-width: 140px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--bg);
}

.info {
  flex: 1;
  display: grid;
  gap: 2px;
  font-size: 12px;
}

.id {
  font-family: ui-monospace, monospace;
  color: var(--text);
}

.label {
  color: var(--accent);
}

.time {
  color: var(--muted);
  font-size: 11px;
}

.restore {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  color: var(--accent);
  background: transparent;
  cursor: pointer;
}

.primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
