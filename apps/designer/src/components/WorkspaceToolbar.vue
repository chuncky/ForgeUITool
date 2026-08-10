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
      <ToolbarButton icon="assets" :label="tt('assets')" title="资源管理（图片 / 字体 / 多语言）" @click="ui.openAssets()" />
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
        :label="historyLabel"
        :disabled="!store.loaded"
        title="历史版本 FR-004"
        @click="ui.showHistory = true"
      />
      <ToolbarButton icon="code" :label="tt('codeEditor')" @click="ui.showCodeEditor = true" />
      <div class="menu-wrap">
        <ToolbarButton
          icon="ai"
          :label="tt('aiDesign')"
          :disabled="!store.loaded || previewBusy"
          :title="aiButtonTitle"
          @click="toggleAiMenu"
        />
        <div v-if="ui.aiMenuOpen" class="menu ai-menu" @mouseleave="ui.aiMenuOpen = false">
          <button
            v-for="h in aiHosts"
            :key="h.id"
            type="button"
            class="ai-host-row"
            @click="onAiHost(h)"
          >
            <span class="ai-host-name">{{ h.label }}</span>
            <span v-if="h.installed" class="ai-host-ok">已安装</span>
            <span v-else class="ai-host-miss"
              >未安装 · <em @click.stop="openAiSettings">去设置</em></span
            >
          </button>
          <hr class="ai-sep" />
          <button type="button" @click="openAiSettings">AI 设置…</button>
        </div>
      </div>
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
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ToolbarButton from "./ToolbarButton.vue";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { useUiStore } from "../stores/ui";
import { t, type UiStringKey } from "../i18n/ui-locale";
import { mergeAiHostDetection, type AiHostMenuRow } from "../utils/ai-hosts-menu";

const store = useProjectStore();
const settings = useSettingsStore();
const ui = useUiStore();
const router = useRouter();
const historyCount = ref(0);
const previewBusy = ref(false);
/** Always seed four hosts — BK: menu items are permanent; detection only flips 已安装. */
const aiHosts = ref<AiHostMenuRow[]>(mergeAiHostDetection(null));

onMounted(() => {
  ui.initUiLocale();
  void refreshHistoryCount();
  void refreshAiHosts();
});

watch(
  () => [store.loaded?.root, store.dirty, ui.showHistory] as const,
  () => {
    void refreshHistoryCount();
  },
);

async function refreshHistoryCount() {
  if (!store.loaded) {
    historyCount.value = 0;
    return;
  }
  try {
    const list = await store.fetchSnapshots();
    historyCount.value = list.length;
  } catch {
    historyCount.value = 0;
  }
}

function tt(key: UiStringKey) {
  return t(ui.uiLocale, key);
}

const historyLabel = computed(() => {
  const base = tt("history");
  return historyCount.value > 0 ? `${base}（${historyCount.value}）` : base;
});

const projectLabel = computed(() => {
  const name = store.loaded?.project.name ?? "未打开工程";
  return store.dirty ? `${name} *` : name;
});

const packDisabled = computed(
  () => !store.loaded || store.loaded.project.deliveryMode === "static_c",
);

const aiButtonTitle = computed(() => {
  if (!store.loaded) return "请先打开工程";
  if (previewBusy.value) return "预览/编译进行中";
  return "AI设计 — 选择外部 AI 工具";
});

async function refreshAiHosts() {
  try {
    const d = window.forgeuiDesktop;
    if (!d?.listAiHosts) return;
    const res = await d.listAiHosts();
    // Never clear to [] while detecting — only merge status onto static rows.
    aiHosts.value = mergeAiHostDetection(res.hosts);
    previewBusy.value = !!res.previewBusy;
  } catch {
    /* keep seeded hosts */
  }
}

function openLogPanel() {
  ui.bottomAuxTab = "log";
  ui.logPanelCollapsed = false;
}

function toggleCMenu() {
  ui.deliveryMenuOpen = false;
  ui.aiMenuOpen = false;
  ui.cMenuOpen = !ui.cMenuOpen;
}

function toggleDeliveryMenu() {
  ui.cMenuOpen = false;
  ui.aiMenuOpen = false;
  ui.deliveryMenuOpen = !ui.deliveryMenuOpen;
}

function toggleAiMenu() {
  ui.cMenuOpen = false;
  ui.deliveryMenuOpen = false;
  ui.aiMenuOpen = !ui.aiMenuOpen;
  if (ui.aiMenuOpen) void refreshAiHosts();
}

function openAiSettings() {
  ui.aiMenuOpen = false;
  settings.openSettingsTab("ai");
  void router.push("/settings");
}

async function onAiHost(h: { id: string; label?: string; installed: boolean; launchSupported: boolean }) {
  ui.aiMenuOpen = false;
  if (!h.installed) {
    openAiSettings();
    return;
  }
  try {
    const res = await window.forgeuiDesktop!.launchAiHost({ host: h.id });
    if (!res.ok) {
      store.statusLine = res.error ?? "启动失败";
      alert(res.error ?? "启动失败");
      return;
    }
    store.statusLine = res.hint ?? `已启动 ${h.label ?? h.id}`;
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  }
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

.ai-menu {
  min-width: 240px;
}

.ai-host-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.ai-host-name {
  font-weight: 600;
}

.ai-host-ok {
  color: #3b9b6e;
  font-size: 12px;
}

.ai-host-miss {
  color: var(--muted);
  font-size: 12px;
}

.ai-host-miss em {
  color: var(--accent);
  font-style: normal;
  text-decoration: underline;
  cursor: pointer;
}

.ai-sep {
  border: none;
  border-top: 1px solid var(--border);
  margin: 4px 0;
}
</style>
