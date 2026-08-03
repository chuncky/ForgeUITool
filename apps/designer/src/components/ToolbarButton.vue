<template>
  <button
    type="button"
    class="tb-btn"
    :class="{
      on: active,
      'icon-only': iconOnly,
      primary,
      wide,
    }"
    :disabled="disabled"
    :title="title"
    @click="$emit('click', $event)"
  >
    <ToolbarIcon :icon="icon" />
    <span v-if="!iconOnly && label" class="tb-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import ToolbarIcon from "./ToolbarIcon.vue";
import type { ToolbarIconId } from "../icons/toolbar";

defineProps<{
  icon: ToolbarIconId;
  label?: string;
  iconOnly?: boolean;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  wide?: boolean;
  title?: string;
}>();

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
.tb-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 52px;
  max-width: 72px;
  padding: 4px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
}

.tb-btn:hover:not(:disabled) {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.04);
}

.tb-btn.on {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.12);
}

.tb-btn.primary {
  background: var(--accent-2);
  border-color: var(--accent);
}

.tb-btn.primary:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-2);
}

.tb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.tb-btn.icon-only {
  min-width: 36px;
  max-width: 36px;
  padding: 6px 4px;
}

.tb-btn.wide {
  min-width: 88px;
  max-width: 160px;
  align-items: center;
}

.tb-label {
  font-size: 11px;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
</style>
