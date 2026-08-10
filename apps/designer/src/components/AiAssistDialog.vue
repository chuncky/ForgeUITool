<template>
  <!-- Legacy dialog: redirect to Settings → AI（BK 无独立启用开关弹窗）. -->
  <div v-if="ui.showAiAssist" class="mask" @click.self="close">
    <div class="dialog">
      <h2>AI 设置</h2>
      <p class="hint">AI 配置已并入壳顶栏「设置 → AI 设置」。正在跳转…</p>
      <SettingsAiPanel />
      <div class="foot">
        <button type="button" @click="goSettings">打开设置页</button>
        <button type="button" class="primary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import SettingsAiPanel from "./SettingsAiPanel.vue";
import { useSettingsStore } from "../stores/settings";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const settings = useSettingsStore();
const router = useRouter();

function close() {
  ui.showAiAssist = false;
}

function goSettings() {
  settings.openSettingsTab("ai");
  ui.showAiAssist = false;
  void router.push("/settings");
}

watch(
  () => ui.showAiAssist,
  (v) => {
    if (v) {
      settings.openSettingsTab("ai");
    }
  },
);
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
  width: min(640px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.hint {
  color: var(--muted);
  font-size: 12px;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
