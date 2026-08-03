<template>
  <section class="block">
    <div v-if="node && node.type !== 'screen'" class="editor">
      <EventCard
        v-for="(ev, i) in local"
        :key="i"
        :binding="ev"
        :screens="screens"
        :triggers="triggers"
        @update="(b) => updateEvent(i, b)"
        @add-action="addAction(i)"
        @remove="removeEvent(i)"
      />
      <button type="button" @click="addEvent">+ 事件</button>
    </div>
    <p v-else class="hint">选中非屏幕控件后可编辑事件</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { EventBinding } from "../env";
import { useProjectStore } from "../stores/project";
import EventCard from "./event-panel/EventCard.vue";

const store = useProjectStore();
const node = computed(() => store.selectedNode);
const screens = computed(() => store.loaded?.project.screens ?? []);
const triggers = ["CLICKED", "PRESSED", "RELEASED", "LONG_PRESSED", "VALUE_CHANGED"] as const;

const local = ref<EventBinding[]>([]);

watch(
  () => node.value,
  (n) => {
    local.value = n ? (JSON.parse(JSON.stringify(n.events || [])) as EventBinding[]) : [];
  },
  { immediate: true, deep: true },
);

async function commit() {
  await store.setEvents(JSON.parse(JSON.stringify(local.value)));
}

function updateEvent(i: number, binding: EventBinding) {
  local.value[i] = binding;
  commit();
}

function addEvent() {
  local.value.push({
    trigger: "CLICKED",
    actions: [{ type: "CALL_FUNCTION", handler: "on_handler" }],
  });
  commit();
}

function removeEvent(i: number) {
  local.value.splice(i, 1);
  commit();
}

function addAction(i: number) {
  local.value[i]!.actions.push({ type: "CALL_FUNCTION", handler: "on_handler" });
  commit();
}
</script>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.editor {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 8px;
}

.hint {
  color: var(--muted);
  font-size: 12px;
}
</style>
