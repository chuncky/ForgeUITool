<template>
  <div v-if="ui.showProjectSettings && store.loaded" class="mask" @click.self="ui.showProjectSettings = false">
    <div class="dialog">
      <h2>项目设置</h2>
      <label>名称 <input v-model="form.name" /></label>
      <label>
        平台
        <select v-model="form.platform">
          <option value="qm10xd">qm10xd</option>
          <option value="qm10xv">qm10xv</option>
          <option value="qm10xh">qm10xh</option>
        </select>
      </label>
      <label>
        分辨率
        <div class="row">
          <input v-model.number="form.width" type="number" min="1" />
          <span>×</span>
          <input v-model.number="form.height" type="number" min="1" />
        </div>
      </label>
      <label>色深 <input v-model.number="form.colorDepth" type="number" min="1" /></label>
      <label>lvglVersion <input v-model="form.lvglVersion" /></label>
      <label>
        deliveryMode
        <select v-model="form.deliveryMode">
          <option value="both">both（默认 A2）</option>
          <option value="static_c">static_c</option>
          <option value="dynamic_ui">dynamic_ui</option>
        </select>
      </label>
      <label>
        previewBackend
        <select v-model="form.previewBackend">
          <option value="sdl">sdl</option>
          <option value="wasm">wasm</option>
        </select>
      </label>
      <label>entrySymbol <input v-model="form.entrySymbol" /></label>
      <label>
        默认屏
        <select v-model="form.defaultScreen">
          <option v-for="s in store.loaded.project.screens" :key="s.id" :value="s.id">
            {{ s.id }}
          </option>
        </select>
      </label>
      <label>SDK 路径 <input v-model="form.sdkPath" placeholder="可空，导出时再选" /></label>
      <section class="delivery">
        <h3>交付</h3>
        <p class="hint">A1 导出到平台 SDK；A2 打包自有 UI 包（与 C 语言菜单无关）。</p>
        <div class="delivery-actions">
          <button type="button" @click="exportSdk">导出到 SDK</button>
          <button
            type="button"
            :disabled="form.deliveryMode === 'static_c'"
            :title="form.deliveryMode === 'static_c' ? '当前为 static_c，未启用 A2' : ''"
            @click="packUi"
          >
            打包 UI 包
          </button>
        </div>
      </section>
      <div class="actions">
        <button @click="ui.showProjectSettings = false">取消</button>
        <button class="primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();

const form = reactive({
  name: "",
  platform: "qm10xd" as "qm10xd" | "qm10xv" | "qm10xh",
  width: 480,
  height: 320,
  colorDepth: 16,
  lvglVersion: "9.10",
  deliveryMode: "both" as "both" | "static_c" | "dynamic_ui",
  previewBackend: "sdl" as "sdl" | "wasm",
  entrySymbol: "ui_init",
  defaultScreen: "home",
  sdkPath: "",
});

watch(
  () => [ui.showProjectSettings, store.loaded] as const,
  ([open, loaded]) => {
    if (!open || !loaded) return;
    const p = loaded.project;
    form.name = p.name;
    form.platform = p.platform as typeof form.platform;
    form.width = p.display.width;
    form.height = p.display.height;
    form.colorDepth = p.display.colorDepth;
    form.lvglVersion = p.lvglVersion;
    form.deliveryMode = (p.deliveryMode as typeof form.deliveryMode) || "both";
    form.previewBackend = (p.previewBackend as typeof form.previewBackend) || "sdl";
    form.entrySymbol = p.entrySymbol || "ui_init";
    form.defaultScreen = p.defaultScreen;
    form.sdkPath = p.sdk?.path ?? "";
  },
);

async function exportSdk() {
  ui.logPanelCollapsed = false;
  const sdkPath = form.sdkPath.trim() || store.loaded?.project.sdk?.path?.trim();
  await store.exportSdk(sdkPath || undefined);
}

async function packUi() {
  ui.logPanelCollapsed = false;
  await store.pack();
}

async function save() {
  await store.updateMeta({
    name: form.name,
    platform: form.platform,
    display: { width: form.width, height: form.height, colorDepth: form.colorDepth },
    lvglVersion: form.lvglVersion,
    deliveryMode: form.deliveryMode,
    previewBackend: form.previewBackend,
    entrySymbol: form.entrySymbol,
    defaultScreen: form.defaultScreen,
    sdk: { path: form.sdkPath },
  });
  ui.showProjectSettings = false;
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}

.dialog {
  width: min(440px, 92vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 10px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

label {
  display: grid;
  gap: 4px;
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

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delivery {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.delivery h3 {
  margin: 0 0 4px;
  font-size: 14px;
}

.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--muted);
}

.delivery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.delivery-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
