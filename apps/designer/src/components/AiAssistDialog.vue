<template>
  <div v-if="ui.showAiAssist" class="mask" @click.self="ui.showAiAssist = false">
    <div class="dialog">
      <h2>AI 设计（V2）</h2>
      <p>
        本产品通过 <strong>MCP</strong> 暴露工程模型读写与生成触发（AR-020～022）。MVP 仅保留工具名冻结与
        stub；完整协同在 V2。
      </p>
      <ul>
        <li v-for="t in tools" :key="t">{{ t }}</li>
      </ul>
      <p class="hint">请在 Cursor / 兼容宿主中配置 ForgeUI MCP，并显式授权后再改模型。不会直接改写 user/ 已有实现策略（D-02）。</p>
      <div class="actions">
        <button class="primary" @click="ui.showAiAssist = false">知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const tools = [
  "forgeui_get_editor_state",
  "forgeui_batch_get",
  "forgeui_batch_update",
  "forgeui_update_node",
  "forgeui_add_node_tree",
  "forgeui_get_page_screenshot",
  "forgeui_generate",
  "forgeui_ping",
];
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
  width: min(480px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

h2 {
  margin: 0 0 10px;
}

p,
.hint {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

ul {
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
