<template>
  <div class="act-row">
    <select :value="action.type" @change="onType">
      <option value="CHANGE_SCREEN">切页</option>
      <option value="CALL_FUNCTION">Call function</option>
    </select>
    <select v-if="action.type === 'CHANGE_SCREEN'" :value="changeTarget" @change="onTarget">
      <option v-for="s in screens" :key="s.id" :value="s.id">{{ s.id }}</option>
    </select>
    <input
      v-else
      :value="callHandler"
      placeholder="handler 名"
      @change="onHandler"
    />
    <button type="button" class="mini" @click="$emit('remove')">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Action } from "../../env";

const props = defineProps<{
  action: Action;
  screens: Array<{ id: string }>;
}>();

const emit = defineEmits<{
  update: [action: Action];
  remove: [];
}>();

const changeTarget = computed(() =>
  props.action.type === "CHANGE_SCREEN" ? props.action.target : "",
);

const callHandler = computed(() =>
  props.action.type === "CALL_FUNCTION" ? props.action.handler : "",
);

function onType(e: Event) {
  const type = (e.target as HTMLSelectElement).value;
  if (type === "CHANGE_SCREEN") {
    emit("update", { type: "CHANGE_SCREEN", target: props.screens[0]?.id ?? "home" });
  } else {
    emit("update", { type: "CALL_FUNCTION", handler: "on_handler" });
  }
}

function onTarget(e: Event) {
  emit("update", { type: "CHANGE_SCREEN", target: (e.target as HTMLSelectElement).value });
}

function onHandler(e: Event) {
  emit("update", { type: "CALL_FUNCTION", handler: (e.target as HTMLInputElement).value });
}
</script>

<style scoped>
.act-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 4px;
}

select,
input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
}

.mini {
  padding: 2px 8px;
  font-size: 12px;
}
</style>
