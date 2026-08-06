<template>
  <header class="head">
    <span class="type-badge" :title="widgetType">
      <span class="type-icon" aria-hidden="true">{{ icon }}</span>
      <span class="type-text">{{ typeLabel }}</span>
    </span>
    <span class="id-line">ID: {{ nodeId }}</span>
  </header>

  <label class="field name-field">
    显示名
    <input :value="name" @change="onName" />
    <span v-if="showNameHint" class="name-hint">大纲/树用，不等于画布文案（见下方「文本」）</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { widgetIconChar } from "../../utils/widget-icons";

const props = defineProps<{
  typeLabel: string;
  nodeId: string;
  name: string;
  widgetType?: string;
}>();

const emit = defineEmits<{
  "update:name": [value: string];
}>();

const icon = computed(() => widgetIconChar(props.widgetType));

/** Label/button both expose 「文本」— clarify 显示名 ≠ canvas caption. */
const showNameHint = computed(
  () => props.widgetType === "label" || props.widgetType === "button",
);

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
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.type-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  display: inline-grid;
  place-items: center;
  font-size: 14px;
  flex-shrink: 0;
}

.type-text {
  line-height: 1.2;
}

.id-line {
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
  padding-left: 36px;
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

.name-hint {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.35;
  font-weight: 400;
}
</style>
