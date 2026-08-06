<template>
  <div v-if="ui.showStyleLibrary" class="mask" @click.self="close">
    <div class="dialog" role="dialog" aria-labelledby="style-lib-title">
      <header class="head">
        <h2 id="style-lib-title">样式库</h2>
        <button type="button" class="icon-x" title="关闭" @click="close">×</button>
      </header>

      <p v-if="!themes.length" class="empty">暂无已存样式。在属性面板「样式」点「保存」可加入样式库。</p>

      <ul v-else class="list">
        <li v-for="t in themes" :key="t.id" class="card">
          <div class="thumb">
            <span class="preview-chip" :style="chrome(t.props)">Button</span>
          </div>
          <div class="info">
            <div class="name">{{ t.name }}</div>
            <div v-if="t.description" class="desc">{{ t.description }}</div>
            <div class="meta">
              <span class="clock" aria-hidden="true">◷</span>
              创建于: {{ formatCreated(t.createdAt) || "—" }}
              <span class="dot">·</span>
              {{ t.part }} / {{ t.state }}
            </div>
          </div>
          <div class="ops">
            <button type="button" class="apply" title="应用到当前选中控件" @click="onApply(t.id)">
              ✓ 应用
            </button>
            <button type="button" class="del" title="从样式库删除" @click="onDelete(t.id)">
              🗑 删除
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { formatStyleCreatedAt, styleThemePreviewChrome } from "../utils/style-theme-preview";

const store = useProjectStore();
const ui = useUiStore();

const themes = computed(() => store.styleThemes);

function chrome(props: Record<string, unknown>) {
  return styleThemePreviewChrome(props);
}

function formatCreated(iso: string | undefined) {
  return formatStyleCreatedAt(iso);
}

function close() {
  ui.showStyleLibrary = false;
}

async function onApply(id: string) {
  if (!store.selectedId) {
    window.alert("请先选中要应用样式的控件");
    return;
  }
  await store.applyStyleTheme(id);
  close();
}

async function onDelete(id: string) {
  if (!window.confirm("确定从样式库删除该样式？")) return;
  await store.deleteStyleTheme(id);
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 80;
}

.dialog {
  width: min(640px, 94vw);
  max-height: min(80vh, 640px);
  overflow: auto;
  background: var(--panel, #1a2332);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
  display: grid;
  gap: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.icon-x {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.empty {
  margin: 8px 0;
  color: var(--muted);
  font-size: 13px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.card {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--bg, #0f172a);
}

.thumb {
  width: 88px;
  height: 64px;
  border-radius: 6px;
  background: #0b1220;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  min-height: 28px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
}

.info {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 11px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.clock {
  opacity: 0.8;
}

.dot {
  opacity: 0.5;
}

.ops {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apply,
.del {
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  color: #fff;
}

.apply {
  background: #3b82f6;
}

.del {
  background: #e11d48;
}
</style>
