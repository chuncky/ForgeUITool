<template>
  <div v-if="store.aiTransactionPending" class="ai-bar">
    <span class="msg">AI 变更待确认（{{ store.aiChangeCount }} 项）</span>
    <div class="actions">
      <button type="button" class="primary" @click="store.commitAiTransaction">保存 AI 变更</button>
      <button type="button" @click="store.rollbackAiTransaction">撤销 AI 变更</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from "../stores/project";
const store = useProjectStore();
</script>

<style scoped>
.ai-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(61, 156, 240, 0.15);
  border-top: 1px solid var(--accent);
  font-size: 13px;
}

.msg {
  color: var(--text);
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
