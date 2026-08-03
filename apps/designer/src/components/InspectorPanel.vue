<template>
  <section class="inspector">
    <div class="tabs">
      <button type="button" :class="{ active: ui.rightTab === 'props' }" @click="ui.rightTab = 'props'">
        属性
      </button>
      <button type="button" :class="{ active: ui.rightTab === 'events' }" @click="ui.rightTab = 'events'">
        事件
      </button>
    </div>

    <div class="body">
      <PropPanel v-show="ui.rightTab === 'props'" />
      <EventPanel v-show="ui.rightTab === 'events'" />
    </div>
  </section>
</template>

<script setup lang="ts">
import PropPanel from "./PropPanel.vue";
import EventPanel from "./EventPanel.vue";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
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

.body :deep(.prop-panel),
.body :deep(.block) {
  flex: 1;
  min-height: 0;
}
</style>
