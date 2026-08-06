<template>
  <div v-if="ui.showWasmEmbed" class="mask" @click.self="close">
    <div class="dlg" role="dialog" aria-label="Wasm IR 预览">
      <div class="head">
        <h2>Wasm IR 嵌入预览（FR-064）</h2>
        <button type="button" @click="reload">刷新</button>
        <button type="button" class="primary" @click="close">关闭</button>
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <p v-else-if="loading" class="hint">正在准备 Wasm IR…</p>
      <!-- Electron webview for local file:// IR shell -->
      <webview v-else-if="url" class="frame" :src="url" allowpopups />
      <p v-else class="hint">无预览 URL</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

const ui = useUiStore();
const store = useProjectStore();
const url = ref("");
const loading = ref(false);
const error = ref("");

async function reload() {
  loading.value = true;
  error.value = "";
  try {
    const result = await store.prepareWasmEmbed();
    if (!result.ok) {
      error.value = result.error ?? "准备失败";
      url.value = "";
      return;
    }
    url.value = result.previewUrl ?? "";
  } finally {
    loading.value = false;
  }
}

function close() {
  ui.showWasmEmbed = false;
  url.value = "";
  error.value = "";
}

watch(
  () => ui.showWasmEmbed,
  (v) => {
    if (v) void reload();
  },
);
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 85;
}
.dlg {
  width: min(920px, 94vw);
  height: min(720px, 90vh);
  background: #1e2430;
  color: #e8ecf4;
  border-radius: 10px;
  border: 1px solid #3a4558;
  display: flex;
  flex-direction: column;
  padding: 12px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
h2 {
  flex: 1;
  margin: 0;
  font-size: 15px;
}
.head button {
  background: #2a3344;
  color: inherit;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.primary {
  background: #3b6ea5 !important;
}
.frame {
  flex: 1;
  width: 100%;
  border: 1px solid #3a4558;
  border-radius: 6px;
  background: #0d1118;
}
.hint,
.err {
  font-size: 13px;
  color: #9aa4b2;
}
.err {
  color: #e07070;
}
</style>
