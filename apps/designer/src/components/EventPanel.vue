<template>
  <section class="block">
    <div v-if="node && node.type !== 'screen'" class="editor">
      <EventCard
        v-for="(ev, i) in local"
        :key="i"
        :binding="ev"
        :screens="screens"
        :nodes="flatNodes"
        :triggers="triggers"
        :locales="locales"
        :animations="animationIds"
        :variables="variableIds"
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
import type { EventBinding, UiNode } from "../env";
import { useProjectStore } from "../stores/project";
import EventCard from "./event-panel/EventCard.vue";

const store = useProjectStore();
const node = computed(() => store.selectedNode);
const screens = computed(() => store.loaded?.project.screens ?? []);
const locales = computed(() => store.i18nConfig.locales.map((l) => l.id));
const animationIds = computed(() => store.animations.map((a) => a.id));
const variableIds = computed(() =>
  Array.isArray(store.loaded?.project.variables)
    ? store.loaded!.project.variables!.map((v) => v.id)
    : [],
);

function collectFlat(n: UiNode, out: Array<{ id: string; type: string; label: string }>): void {
  if (n.type !== "screen") {
    out.push({ id: n.id, type: n.type, label: `${n.name || n.id} (${n.type})` });
  }
  for (const c of n.children ?? []) collectFlat(c, out);
}

/** FR-032: all widgets across screens for SET_PROP target picker. */
const flatNodes = computed(() => {
  const out: Array<{ id: string; type: string; label: string }> = [];
  const loaded = store.loaded;
  if (!loaded) return out;
  for (const ref of loaded.project.screens) {
    const screen = loaded.screens[ref.id];
    if (screen) collectFlat(screen, out);
  }
  return out;
});

const triggers = ["CLICKED", "PRESSED", "RELEASED", "LONG_PRESSED", "VALUE_CHANGED"] as const;

const local = ref<EventBinding[]>([]);

/** Reload local draft only when selection changes — not on every node deep mutation. */
watch(
  () => [store.screenId, store.selectedId] as const,
  () => {
    const n = store.selectedNode;
    local.value = n ? (JSON.parse(JSON.stringify(n.events || [])) as EventBinding[]) : [];
  },
  { immediate: true },
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
