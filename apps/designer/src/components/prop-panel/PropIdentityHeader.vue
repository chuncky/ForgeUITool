<template>
  <header class="head">
    <span class="type-badge">{{ typeLabel }}</span>
    <span class="id-line">ID: {{ nodeId }}</span>
  </header>

  <label class="field name-field">
    显示名
    <input :value="name" @change="onName" />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  typeLabel: string;
  nodeId: string;
  name: string;
}>();

const emit = defineEmits<{
  "update:name": [value: string];
}>();

function onName(e: Event) {
  emit("update:name", (e.target as HTMLInputElement).value);
}
</script>

<style scoped>
.head {
  padding: 10px 10px 8px;
  display: grid;
  gap: 4px;
}

.type-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.id-line {
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
}

.name-field {
  margin: 0 10px 8px;
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
</style>
