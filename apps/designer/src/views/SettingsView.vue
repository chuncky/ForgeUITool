<template>
  <div class="page">
    <h1>设置</h1>
    <p class="lead">全局默认项（保存在本机）。工程级平台/分辨率等请在工作区「项目设置」修改。</p>

    <label>
      默认平台
      <select v-model="settings.settings.defaultPlatform">
        <option value="qm10xd">qm10xd</option>
        <option value="qm10xv">qm10xv</option>
        <option value="qm10xh">qm10xh</option>
      </select>
    </label>
    <label>
      qm10xd SDK 路径提示
      <input
        v-model="settings.settings.sdkPathQm10xd"
        placeholder="也可设环境变量 FORGEUI_QM10XD_SDK"
      />
    </label>
    <label>
      默认预览后端
      <select v-model="settings.settings.previewBackend">
        <option value="sdl">sdl（MVP）</option>
        <option value="wasm">wasm（IR 浏览器预览）</option>
      </select>
    </label>
    <label>
      界面语言
      <select v-model="settings.settings.locale">
        <option value="zh-CN">简体中文</option>
        <option value="en">English（占位）</option>
      </select>
    </label>

    <div v-if="project.loaded" class="row">
      <button @click="ui.showProjectSettings = true">打开当前工程设置…</button>
    </div>
    <ProjectSettingsDialog />
  </div>
</template>

<script setup lang="ts">
import ProjectSettingsDialog from "../components/ProjectSettingsDialog.vue";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { useUiStore } from "../stores/ui";

const settings = useSettingsStore();
const project = useProjectStore();
const ui = useUiStore();
</script>

<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
  padding: 32px 24px;
  display: grid;
  gap: 14px;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.lead {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
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
</style>
