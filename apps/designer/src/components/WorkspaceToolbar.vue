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
        label="项目设置"
        @click="ui.showProjectSettings = true"
      />
      <ToolbarButton
        icon="widgets"
        label="控件库"
        :active="ui.widgetLibraryVisible"
        title="显示或隐藏控件库面板"
        @click="ui.toggleWidgetLibrary()"
      />
      <ToolbarButton
        icon="palette"
        label="颜色库"
        disabled
        title="V1：颜色库 FR-018"
      />
      <ToolbarButton icon="assets" label="资源管理" @click="ui.showAssets = true" />
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
        label="存档"
        :disabled="!store.loaded || !store.dirty"
        title="Ctrl+S"
        @click="store.save()"
      />
      <ToolbarButton icon="history" label="历史" disabled title="V1：历史版本 FR-004" />
      <ToolbarButton icon="code" label="代码编辑器" @click="ui.showCodeEditor = true" />
      <ToolbarButton icon="ai" label="AI设计" @click="ui.showAiAssist = true" />
      <div class="menu-wrap">
        <ToolbarButton icon="c-lang" label="C语言 ▾" primary @click="toggleCMenu" />
        <div v-if="ui.cMenuOpen" class="menu" @mouseleave="ui.cMenuOpen = false">
          <button @click="runC('clean')">全部清理</button>
          <button @click="runC('generate')">生成代码</button>
          <button @click="runC('compile')">编译</button>
          <button @click="runC('simulate')">模拟运行</button>
          <button @click="runC('all')">生成+编译+模拟运行</button>
        </div>
      </div>
      <div class="menu-wrap">
        <ToolbarButton
          icon="delivery"
          label="交付 ▾"
          :disabled="!store.loaded"
          @click="toggleDeliveryMenu"
        />
        <div v-if="ui.deliveryMenuOpen" class="menu" @mouseleave="ui.deliveryMenuOpen = false">
          <button @click="runDelivery('export')">导出到 SDK</button>
          <button
            :disabled="packDisabled"
            :title="packDisabled ? '当前为 static_c，未启用 A2' : ''"
            @click="runDelivery('pack')"
          >
            打包 UI 包
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
import { computed } from "vue";
import ToolbarButton from "./ToolbarButton.vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();

const projectLabel = computed(() => {
  const name = store.loaded?.project.name ?? "未打开工程";
  return store.dirty ? `${name} *` : name;
});

const packDisabled = computed(
  () => !store.loaded || store.loaded.project.deliveryMode === "static_c",
);

function openLogPanel() {
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
  else if (cmd === "all") await store.generateCompileAndRun();
}

async function runDelivery(cmd: string) {
  ui.deliveryMenuOpen = false;
  openLogPanel();
  if (cmd === "export") await store.exportSdk();
  else if (cmd === "pack") await store.pack();
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
