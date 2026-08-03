<template>
  <div v-if="ui.showAssets" class="mask" @click.self="ui.showAssets = false">
    <div class="dialog">
      <h2>资源管理</h2>
      <p class="hint">MVP：列出工程 assets 声明。导入文件能力 V1 增强（FR-040）。</p>
      <h3>图片</h3>
      <ul v-if="images.length">
        <li v-for="(img, i) in images" :key="i">{{ formatItem(img) }}</li>
      </ul>
      <p v-else class="empty">暂无图片资源</p>
      <h3>字体</h3>
      <ul v-if="fonts.length">
        <li v-for="(f, i) in fonts" :key="i">{{ formatItem(f) }}</li>
      </ul>
      <p v-else class="empty">暂无字体（裁剪管线 V1）</p>
      <div class="actions">
        <button class="primary" @click="ui.showAssets = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const store = useProjectStore();
const ui = useUiStore();

const images = computed(() => {
  const a = store.loaded?.project as { assets?: { images?: unknown[]; fonts?: unknown[] } } | undefined;
  return a?.assets?.images ?? [];
});
const fonts = computed(() => {
  const a = store.loaded?.project as { assets?: { images?: unknown[]; fonts?: unknown[] } } | undefined;
  return a?.assets?.fonts ?? [];
});

function formatItem(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "id" in item) return String((item as { id: string }).id);
  return JSON.stringify(item);
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
  width: min(420px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

h2 {
  margin: 0 0 8px;
}

h3 {
  margin: 12px 0 6px;
  font-size: 13px;
  color: var(--muted);
}

.hint,
.empty {
  color: var(--muted);
  font-size: 12px;
}

ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
