<template>
  <details class="group" :open="open">
    <summary>
      <span class="dot" />
      <span class="title"><slot name="title" /></span>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </summary>
    <div class="group-body">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open?: boolean;
    hint?: string;
  }>(),
  { open: true },
);
</script>

<style scoped>
.group {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
}

.group summary {
  list-style: none;
  cursor: pointer;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.group summary::-webkit-details-marker {
  display: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.title {
  flex: 1;
}

.hint {
  margin-left: auto;
  font-weight: 400;
  font-size: 10px;
  color: var(--muted);
}

.group-body {
  padding: 0 10px 10px;
  display: grid;
  gap: 8px;
}
</style>
