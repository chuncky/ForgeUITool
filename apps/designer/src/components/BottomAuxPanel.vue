<template>
  <section class="bottom-aux" :class="{ collapsed: ui.logPanelCollapsed && ui.bottomAuxTab === 'log' }">
    <header class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="tab"
        :class="{ on: ui.bottomAuxTab === t.id }"
        @click="ui.bottomAuxTab = t.id"
      >
        {{ t.label }}
      </button>
      <div class="spacer" />
      <template v-if="ui.bottomAuxTab === 'log'">
        <button type="button" @click="store.clearLogs()">清空</button>
        <button type="button" @click="ui.toggleLogPanel()">
          {{ ui.logPanelCollapsed ? "展开" : "收起" }}
        </button>
      </template>
    </header>

    <div v-show="!(ui.bottomAuxTab === 'log' && ui.logPanelCollapsed)" class="body">
      <pre v-if="ui.bottomAuxTab === 'log'" ref="logEl" class="log">{{ store.logText || "暂无日志" }}</pre>

      <div v-else-if="ui.bottomAuxTab === 'assets'" class="pane assets">
        <div class="pane-actions">
          <button type="button" @click="ui.showAssets = true">打开资源管理</button>
          <button type="button" @click="store.importImages()">导入图片</button>
        </div>
        <ul v-if="store.imageAssets.length" class="asset-list">
          <li v-for="img in store.imageAssets" :key="img.id || img.path">
            <span class="name">{{ img.id }}</span>
            <span class="path">{{ img.path }}</span>
          </li>
        </ul>
        <p v-else class="hint">暂无图片资源。可导入或从顶栏「资源管理」添加。</p>
      </div>

      <div v-else class="pane config">
        <p class="hint">工程显示分辨率、交付模式与 SDK 路径等在项目设置中编辑。</p>
        <dl v-if="store.loaded" class="meta">
          <div>
            <dt>工程</dt>
            <dd>{{ store.loaded.project.name }}</dd>
          </div>
          <div>
            <dt>分辨率</dt>
            <dd>{{ store.loaded.project.display?.width }} × {{ store.loaded.project.display?.height }}</dd>
          </div>
          <div>
            <dt>LVGL</dt>
            <dd>{{ store.loaded.project.lvglVersion }}</dd>
          </div>
        </dl>
        <button type="button" class="primary" @click="ui.showProjectSettings = true">打开工程设置</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();
const logEl = ref<HTMLElement | null>(null);

const tabs = [
  { id: "log" as const, label: "日志" },
  { id: "assets" as const, label: "资源" },
  { id: "config" as const, label: "配置" },
];

watch(
  () => store.logText,
  async () => {
    if (ui.bottomAuxTab !== "log") return;
    await nextTick();
    const el = logEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<style scoped>
.bottom-aux {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  border-top: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}

.bottom-aux.collapsed {
  grid-template-rows: auto;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
  font-size: 12px;
}

.tab {
  padding: 4px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.tab.on {
  color: var(--text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.spacer {
  flex: 1;
}

.tabs button:not(.tab) {
  padding: 2px 8px;
  font-size: 12px;
}

.body {
  min-height: 0;
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
  height: 160px;
}

.pane {
  padding: 10px 12px;
  height: 160px;
  overflow: auto;
  font-size: 12px;
}

.pane-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.asset-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.asset-list li {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}

.asset-list .name {
  font-weight: 600;
  min-width: 120px;
}

.asset-list .path {
  color: var(--muted);
  word-break: break-all;
}

.hint {
  margin: 0 0 12px;
  color: var(--muted);
}

.meta {
  display: grid;
  gap: 6px;
  margin: 0 0 12px;
}

.meta div {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
}

.meta dt {
  color: var(--muted);
}

.meta dd {
  margin: 0;
}

.primary {
  background: var(--accent-2);
  border-color: var(--accent);
}
</style>
