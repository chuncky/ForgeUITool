<template>
  <header class="bar">
    <ToolbarButton
      icon="folder-open"
      wide
      :disabled="!store.loaded"
      :label="projectLabel"
      :title="store.loaded ? `打开项目文件夹\n${store.loaded.root}` : '未打开工程'"
      @click="store.revealProjectFolder()"
    />
    <div class="actions">
      <ToolbarButton
        icon="settings"
        :label="tt('projectSettings')"
        @click="ui.showProjectSettings = true"
      />
      <ToolbarButton
        icon="widgets"
        :label="tt('widgetLibrary')"
        :active="ui.widgetLibraryVisible"
        title="显示或隐藏控件库面板"
        @click="ui.toggleWidgetLibrary()"
      />
      <ToolbarButton
        icon="palette"
        :label="tt('colorLibrary')"
        :disabled="!store.loaded"
        title="颜色库 FR-018"
        @click="ui.showColorLibrary = true"
      />
      <ToolbarButton
        icon="i18n"
        :label="tt('i18n')"
        :disabled="!store.loaded"
        title="多语言键值与 XLIFF FR-042/043"
        @click="ui.showI18n = true"
      />
      <label
        v-if="store.loaded && store.i18nConfig.enabled"
        class="locale-switch"
        title="设计器预览语言 FR-042"
      >
        {{ tt("previewLang") }}
        <select :value="store.i18nConfig.previewLocale" @change="onPreviewLocale">
          <option v-for="l in store.i18nConfig.locales" :key="l.id" :value="l.id">
            {{ l.id }}
          </option>
        </select>
      </label>
      <ToolbarButton
        icon="timeline"
        :label="tt('animations')"
        :disabled="!store.loaded"
        title="时间轴动画 FR-071"
        @click="ui.showAnimations = true"
      />
      <ToolbarButton
        icon="code"
        :label="tt('logicGraph')"
        :disabled="!store.loaded"
        title="逻辑图 FR-036"
        @click="ui.showLogicGraph = true"
      />
      <ToolbarButton
        icon="assets"
        :label="tt('memoryEstimate')"
        :disabled="!store.loaded"
        title="内存估算 FR-076"
        @click="ui.showMemoryEstimate = true"
      />
      <ToolbarButton icon="assets" :label="tt('assets')" @click="ui.showAssets = true" />
      <label class="locale-switch" :title="tt('uiLocale')">
        {{ tt("uiLocale") }}
        <select :value="ui.uiLocale" @change="onUiLocale">
          <option value="zh-CN">中文</option>
          <option value="en">EN</option>
        </select>
      </label>
      <ToolbarButton
        icon="undo"
        icon-only
        :disabled="!store.canUndo"
        title="撤回 (Ctrl+Z)"
        @click="store.undo()"
      />
      <ToolbarButton
        icon="redo"
        icon-only
        :disabled="!store.canRedo"
        title="重做 (Ctrl+Y)"
        @click="store.redo()"
      />
      <ToolbarButton
        icon="save"
        :label="tt('save')"
        :disabled="!store.loaded || !store.dirty"
        title="Ctrl+S"
        @click="store.save()"
      />
      <ToolbarButton
        icon="history"
        :label="tt('history')"
        :disabled="!store.loaded"
        title="历史版本 FR-004"
        @click="ui.showHistory = true"
      />
      <ToolbarButton icon="code" :label="tt('codeEditor')" @click="ui.showCodeEditor = true" />
      <ToolbarButton icon="ai" :label="tt('aiDesign')" @click="ui.showAiAssist = true" />
      <div class="menu-wrap">
        <ToolbarButton icon="c-lang" :label="tt('cLang')" primary @click="toggleCMenu" />
        <div v-if="ui.cMenuOpen" class="menu" @mouseleave="ui.cMenuOpen = false">
          <button @click="runC('clean')">{{ tt("clean") }}</button>
          <button @click="runC('generate')">{{ tt("generate") }}</button>
          <button @click="runC('compile')">{{ tt("compile") }}</button>
          <button @click="runC('simulate')">{{ tt("simulate") }}</button>
          <button @click="runC('wasmEmbed')">{{ tt("wasmEmbed") }}</button>
          <button @click="runC('all')">{{ tt("all") }}</button>
        </div>
      </div>
      <div class="menu-wrap">
        <ToolbarButton
          icon="delivery"
          :label="tt('delivery')"
          :disabled="!store.loaded"
          @click="toggleDeliveryMenu"
        />
        <div v-if="ui.deliveryMenuOpen" class="menu" @mouseleave="ui.deliveryMenuOpen = false">
          <button @click="runDelivery('export')">{{ tt("exportSdk") }}</button>
          <button
            :disabled="packDisabled"
            :title="packDisabled ? '当前为 static_c，未启用 A2' : ''"
            @click="runDelivery('pack')"
          >
            {{ tt("packUi") }}
          </button>
          <button :disabled="packDisabled" @click="runDelivery('packPreview')">
            {{ tt("packPreview") }}
          </button>
        </div>
      </div>
    </div>
    <div class="meta">
      {{ store.loaded?.project.platform }} · LVGL {{ store.loaded?.project.lvglVersion }} ·
      {{ store.loaded?.project.deliveryMode }}
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import ToolbarButton from "./ToolbarButton.vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { t, type UiStringKey } from "../i18n/ui-locale";

const store = useProjectStore();
const ui = useUiStore();

onMounted(() => ui.initUiLocale());

function tt(key: UiStringKey) {
  return t(ui.uiLocale, key);
}

const projectLabel = computed(() => {
  const name = store.loaded?.project.name ?? "未打开工程";
  return store.dirty ? `${name} *` : name;
});

const packDisabled = computed(
  () => !store.loaded || store.loaded.project.deliveryMode === "static_c",
);

function openLogPanel() {
  ui.bottomAuxTab = "log";
  ui.logPanelCollapsed = false;
}

function toggleCMenu() {
  ui.deliveryMenuOpen = false;
  ui.cMenuOpen = !ui.cMenuOpen;
}

function toggleDeliveryMenu() {
  ui.cMenuOpen = false;
  ui.deliveryMenuOpen = !ui.deliveryMenuOpen;
}

async function runC(cmd: string) {
  ui.cMenuOpen = false;
  openLogPanel();
  if (cmd === "clean") await store.clean();
  else if (cmd === "generate") await store.generate();
  else if (cmd === "compile") await store.previewBuild();
  else if (cmd === "simulate") await store.previewRun();
  else if (cmd === "wasmEmbed") ui.showWasmEmbed = true;
  else if (cmd === "all") await store.generateCompileAndRun();
}

async function runDelivery(cmd: string) {
  ui.deliveryMenuOpen = false;
  openLogPanel();
  if (cmd === "export") await store.exportSdk();
  else if (cmd === "pack") await store.pack();
  else if (cmd === "packPreview") await store.previewPackedUi();
}

async function onPreviewLocale(e: Event) {
  const locale = (e.target as HTMLSelectElement).value;
  await store.setPreviewLocale(locale);
}

function onUiLocale(e: Event) {
  const locale = (e.target as HTMLSelectElement).value as "zh-CN" | "en";
  ui.setUiLocale(locale);
}
</script>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--panel);
  flex-wrap: wrap;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}

.locale-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  margin: 0 4px;
}

.locale-switch select {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
}

.meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.menu-wrap {
  position: relative;
}

.menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  margin-top: 4px;
  min-width: 200px;
  display: grid;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.menu button {
  text-align: left;
  border: none;
  border-radius: 4px;
}

.menu button:hover:not(:disabled) {
  background: rgba(61, 156, 240, 0.15);
}

.menu button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
