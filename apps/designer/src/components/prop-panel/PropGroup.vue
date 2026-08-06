<template>
  <div class="group" :class="{ open: isOpen }">
    <button type="button" class="summary" @click="toggle">
      <span class="chev" aria-hidden="true">{{ isOpen ? "▾" : "▸" }}</span>
      <span class="dot" />
      <span class="title"><slot name="title" /></span>
      <span v-if="hint" class="hint">{{ hint }}</span>
      <span v-if="$slots.actions" class="actions" @click.stop><slot name="actions" /></span>
    </button>
    <div class="group-collapse">
      <div class="group-clip">
        <div class="group-body">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    hint?: string;
  }>(),
  { open: true },
);

const isOpen = ref(props.open);

watch(
  () => props.open,
  (v) => {
    isOpen.value = v;
  },
);

function toggle() {
  isOpen.value = !isOpen.value;
}
</script>

<style scoped>
.group {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
}

.summary {
  width: 100%;
  list-style: none;
  cursor: pointer;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
}

.chev {
  width: 12px;
  color: var(--muted);
  font-size: 10px;
  flex-shrink: 0;
  transition: transform 0.18s ease;
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

.actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
  align-items: center;
}

.actions :deep(button) {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
}

.actions :deep(button:hover) {
  border-color: var(--accent);
  color: var(--accent);
}

/* Height animation: clip holds min-height:0; body keeps natural height so outer .groups can scroll. */
.group-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s ease;
}

.group.open .group-collapse {
  grid-template-rows: 1fr;
}

.group-clip {
  min-height: 0;
  overflow: hidden;
}

.group-body {
  padding: 0 10px;
  display: grid;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.18s ease, padding 0.22s ease;
}

.group.open .group-body {
  padding: 0 10px 10px;
  opacity: 1;
}
</style>
