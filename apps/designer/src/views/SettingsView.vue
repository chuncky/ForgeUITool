<template>
  <div class="settings-page">
    <aside class="nav">
      <h1>设置</h1>
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="nav-item"
        :class="{ on: settings.settingsTab === t.id }"
        @click="settings.settingsTab = t.id"
      >
        {{ t.label }}
      </button>
    </aside>

    <div class="main">
      <!-- 通用 -->
      <template v-if="settings.settingsTab === 'general'">
        <section class="card">
          <h2>语言</h2>
          <label>
            语言
            <select :value="settings.settings.locale" @change="onLocale">
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        <section class="card">
          <h2>主题</h2>
          <div class="theme-grid">
            <button
              v-for="th in UI_THEMES"
              :key="th.id"
              type="button"
              class="theme-card"
              :class="{ on: settings.settings.uiTheme === th.id }"
              :data-theme-preview="th.id"
              @click="settings.settings.uiTheme = th.id"
            >
              <span class="swatch" />
              <span class="name">{{ th.label }}</span>
            </button>
            <div v-for="p in themePlaceholders" :key="p" class="theme-card placeholder">
              <span class="swatch" />
              <span class="name">{{ p }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>默认工程 / SDK</h2>
          <label>
            默认平台
            <select v-model="settings.settings.defaultPlatform">
              <option value="qm10xd">qm10xd</option>
              <option value="qm10xv">qm10xv</option>
              <option value="qm10xh">qm10xh</option>
            </select>
          </label>
          <label>
            qm10xd SDK 路径
            <input
              v-model="settings.settings.sdkPathQm10xd"
              placeholder="也可设环境变量 FORGEUI_QM10XD_SDK"
            />
          </label>
          <label>
            默认预览后端
            <select v-model="settings.settings.previewBackend">
              <option value="sdl">sdl</option>
              <option value="wasm">wasm</option>
            </select>
          </label>
        </section>

        <div v-if="project.loaded" class="row">
          <button type="button" @click="ui.showProjectSettings = true">打开当前工程设置…</button>
        </div>
      </template>

      <!-- 工作台 -->
      <template v-else-if="settings.settingsTab === 'workbench'">
        <section class="card">
          <h2>工作台中</h2>
          <label class="toggle">
            <span>
              <strong>隐藏网格</strong>
              <em>在工作台画布中隐藏网格</em>
            </span>
            <input v-model="settings.settings.hideGrid" type="checkbox" />
          </label>
          <label class="toggle">
            <span>
              <strong>隐藏事件连线</strong>
              <em>在工作台画布中隐藏事件连线</em>
            </span>
            <input v-model="settings.settings.hideEventLinks" type="checkbox" />
          </label>
          <label class="snap">
            <span>
              <strong>对齐线阈值</strong>
              <em>组件对齐线显示的像素距离阈值 (1-5)</em>
            </span>
            <div class="stepper">
              <button type="button" @click="bumpSnap(-1)">−</button>
              <input v-model.number="settings.settings.alignSnapPx" type="number" min="1" max="5" />
              <button type="button" @click="bumpSnap(1)">+</button>
            </div>
          </label>
        </section>
      </template>

      <!-- 快捷键 -->
      <template v-else-if="settings.settingsTab === 'shortcuts'">
        <section v-for="g in SHORTCUT_GROUPS" :key="g.id" class="card">
          <h2>{{ g.title }}</h2>
          <table class="keys">
            <tbody>
              <tr v-for="(it, i) in g.items" :key="i">
                <td class="k">{{ it.keys }}</td>
                <td>{{ it.action }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <!-- AI -->
      <template v-else>
        <SettingsAiPanel />
      </template>
    </div>

    <ProjectSettingsDialog />
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import ProjectSettingsDialog from "../components/ProjectSettingsDialog.vue";
import SettingsAiPanel from "../components/SettingsAiPanel.vue";
import { useCanvasViewStore } from "../stores/canvasView";
import { useProjectStore } from "../stores/project";
import { UI_THEMES, useSettingsStore, type SettingsNavTab } from "../stores/settings";
import { useUiStore } from "../stores/ui";
import { SHORTCUT_GROUPS } from "../utils/shortcuts-catalog";

const settings = useSettingsStore();
const project = useProjectStore();
const ui = useUiStore();
const canvas = useCanvasViewStore();

const tabs: Array<{ id: SettingsNavTab; label: string }> = [
  { id: "general", label: "通用设置" },
  { id: "workbench", label: "工作台设置" },
  { id: "shortcuts", label: "快捷键设置" },
  { id: "ai", label: "AI 设置" },
];

const themePlaceholders = ["深紫", "翡翠绿", "海洋蓝", "钴蓝", "板岩灰", "霜蓝", "薰衣草紫"];

function onLocale(e: Event) {
  const v = (e.target as HTMLSelectElement).value as "zh-CN" | "en";
  settings.settings.locale = v;
  ui.setUiLocale(v);
}

function bumpSnap(d: number) {
  const n = Math.min(5, Math.max(1, (settings.settings.alignSnapPx || 2) + d));
  settings.settings.alignSnapPx = n;
}

function syncWorkbench() {
  canvas.showGrid = !settings.settings.hideGrid;
  canvas.showEventLinks = !settings.settings.hideEventLinks;
  canvas.alignSnapPx = settings.settings.alignSnapPx;
}

syncWorkbench();
watch(
  () => [
    settings.settings.hideGrid,
    settings.settings.hideEventLinks,
    settings.settings.alignSnapPx,
  ],
  syncWorkbench,
);
</script>

<style scoped>
.settings-page {
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: 100%;
  background: var(--bg);
}

.nav {
  border-right: 1px solid var(--border);
  background: var(--panel);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav h1 {
  margin: 0 8px 12px;
  font-size: 18px;
}

.nav-item {
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--muted);
}

.nav-item.on {
  background: rgba(61, 156, 240, 0.15);
  border-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}

.main {
  padding: 24px;
  display: grid;
  gap: 16px;
  align-content: start;
  max-width: 820px;
}

.card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  background: var(--panel);
  display: grid;
  gap: 12px;
}

.card h2 {
  margin: 0;
  font-size: 14px;
}

.lead {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

input,
select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 8px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.theme-card {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
  cursor: pointer;
}

.theme-card.on {
  border-color: var(--accent);
}

.theme-card.placeholder {
  opacity: 0.45;
  cursor: default;
}

.swatch {
  display: block;
  height: 36px;
  border-radius: 4px;
  background: linear-gradient(135deg, var(--bg), var(--accent-2));
}

.theme-card[data-theme-preview="pearl"] .swatch {
  background: linear-gradient(135deg, #f4f6f8, #0969da);
}

.theme-card[data-theme-preview="charcoal"] .swatch {
  background: linear-gradient(135deg, #121212, #5b9bd5);
}

.name {
  font-size: 11px;
  color: var(--text);
}

.toggle,
.snap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  color: var(--text);
}

.toggle em,
.snap em {
  display: block;
  font-style: normal;
  color: var(--muted);
  font-size: 11px;
  margin-top: 2px;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stepper input {
  width: 48px;
  text-align: center;
}

.keys {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.keys td {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.keys .k {
  width: 40%;
  color: var(--accent);
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.row button {
  padding: 8px 12px;
}
</style>
