<template>
  <section class="log-panel" :class="{ collapsed: ui.logPanelCollapsed }">
    <header class="head">
      <strong>构建 / 运行日志</strong>
      <button type="button" @click="store.clearLogs()">清空</button>
      <button type="button" @click="ui.toggleLogPanel()">
        {{ ui.logPanelCollapsed ? "展开" : "收起" }}
      </button>
    </header>
    <pre v-show="!ui.logPanelCollapsed" ref="logEl" class="log">{{ store.logText || "暂无日志" }}</pre>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();
const logEl = ref<HTMLElement | null>(null);

watch(
  () => store.logText,
  async () => {
    await nextTick();
    const el = logEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<style scoped>
.log-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.log-panel.collapsed {
  grid-template-rows: auto;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
  font-size: 12px;
}

.head strong {
  flex: 1;
  font-weight: 600;
}

.log {
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  font-family: Consolas, "Courier New", monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: #dbe8f5;
  background: #0b1015;
  min-height: 0;
  height: 160px;
}
</style>
