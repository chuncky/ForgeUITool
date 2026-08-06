<template>
  <div class="card">
    <label>
      触发
      <select :value="binding.trigger" @change="onTrigger">
        <option v-for="t in triggers" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>

    <ActionRow
      v-for="(action, j) in binding.actions"
      :key="j"
      :action="action"
      :screens="screens"
      :nodes="nodes"
      :locales="locales"
      :animations="animations"
      :variables="variables"
      @update="(a) => updateAction(j, a)"
      @remove="removeAction(j)"
    />

    <div class="row">
      <button type="button" class="mini" @click="$emit('add-action')">+ 动作</button>
      <button type="button" class="mini danger" @click="$emit('remove')">删除事件</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Action, EventBinding } from "../../env";
import ActionRow from "./ActionRow.vue";

const props = defineProps<{
  binding: EventBinding;
  screens: Array<{ id: string }>;
  nodes?: Array<{ id: string; type: string; label: string }>;
  triggers: readonly string[];
  locales?: string[];
  animations?: string[];
  variables?: string[];
}>();

const emit = defineEmits<{
  update: [binding: EventBinding];
  "add-action": [];
  remove: [];
}>();

function onTrigger(e: Event) {
  emit("update", {
    ...props.binding,
    trigger: (e.target as HTMLSelectElement).value as EventBinding["trigger"],
  });
}

function updateAction(index: number, action: Action) {
  const actions = [...props.binding.actions];
  actions[index] = action;
  emit("update", { ...props.binding, actions });
}

function removeAction(index: number) {
  const actions = [...props.binding.actions];
  actions.splice(index, 1);
  emit("update", { ...props.binding, actions });
}
</script>

<style scoped>
.card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  display: grid;
  gap: 6px;
}

label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 6px;
}

.row {
  display: flex;
  gap: 6px;
}

.mini {
  padding: 2px 8px;
  font-size: 12px;
}

.mini.danger {
  color: #f87171;
}
</style>
