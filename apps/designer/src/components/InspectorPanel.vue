<template>
  <section class="inspector" aria-label="属性检查器">
    <div
      class="tabs"
      role="tablist"
      aria-label="属性与事件"
      @keydown="onTabKeydown"
    >
      <button
        id="inspector-tab-props"
        ref="propsTabEl"
        type="button"
        role="tab"
        :class="{ active: ui.rightTab === 'props' }"
        :aria-selected="ui.rightTab === 'props'"
        :tabindex="ui.rightTab === 'props' ? 0 : -1"
        aria-controls="inspector-panel-props"
        @click="selectTab('props')"
      >
        属性
      </button>
      <button
        id="inspector-tab-events"
        ref="eventsTabEl"
        type="button"
        role="tab"
        :class="{ active: ui.rightTab === 'events' }"
        :aria-selected="ui.rightTab === 'events'"
        :tabindex="ui.rightTab === 'events' ? 0 : -1"
        aria-controls="inspector-panel-events"
        @click="selectTab('events')"
      >
        事件
      </button>
    </div>

    <div class="body">
      <div
        id="inspector-panel-props"
        role="tabpanel"
        aria-labelledby="inspector-tab-props"
        class="panel-wrap"
        :inert="ui.rightTab !== 'props' ? true : undefined"
        :hidden="ui.rightTab !== 'props' ? true : undefined"
      >
        <PropPanel v-show="ui.rightTab === 'props'" />
      </div>
      <div
        id="inspector-panel-events"
        role="tabpanel"
        aria-labelledby="inspector-tab-events"
        class="panel-wrap"
        :inert="ui.rightTab !== 'events' ? true : undefined"
        :hidden="ui.rightTab !== 'events' ? true : undefined"
      >
        <EventPanel v-show="ui.rightTab === 'events'" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import PropPanel from "./PropPanel.vue";
import EventPanel from "./EventPanel.vue";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const propsTabEl = ref<HTMLButtonElement | null>(null);
const eventsTabEl = ref<HTMLButtonElement | null>(null);

type InspectorTab = "props" | "events";
const TAB_ORDER: InspectorTab[] = ["props", "events"];

function focusTab(tab: InspectorTab) {
  void nextTick(() => {
    (tab === "props" ? propsTabEl.value : eventsTabEl.value)?.focus();
  });
}

function selectTab(tab: InspectorTab) {
  ui.rightTab = tab;
  focusTab(tab);
}

function onTabKeydown(e: KeyboardEvent) {
  const idx = TAB_ORDER.indexOf(ui.rightTab);
  if (idx < 0) return;

  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const next =
      TAB_ORDER[(idx + (e.key === "ArrowRight" ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length]!;
    selectTab(next);
    return;
  }
  if (e.key === "Home") {
    e.preventDefault();
    selectTab("props");
    return;
  }
  if (e.key === "End") {
    e.preventDefault();
    selectTab("events");
  }
}
</script>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.tabs button {
  flex: 1;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 10px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tabs button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-wrap[hidden] {
  display: none;
}

.body :deep(.prop-panel),
.body :deep(.block) {
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
}
</style>
