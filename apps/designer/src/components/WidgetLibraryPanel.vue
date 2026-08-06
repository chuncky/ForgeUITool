<template>
  <section class="library">
    <header class="head">
      <span class="icon-grid" aria-hidden="true">▦</span>
      <span class="title">控件库</span>
    </header>

    <div class="tabs">
      <button :class="{ active: tab === 'system' }" @click="tab = 'system'">系统控件</button>
      <button :class="{ active: tab === 'custom' }" @click="tab = 'custom'">自定义控件</button>
    </div>

    <div v-if="tab === 'system'" class="search-wrap">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input v-model="query" type="search" placeholder="搜索控件…" />
    </div>

    <div v-if="tab === 'system'" class="categories">
      <div v-for="group in visibleGroups" :key="group.category" class="category">
        <button class="cat-head" @click="toggleCategory(group.category)">
          <span class="arrow">{{ expanded[group.category] ? "▾" : "▸" }}</span>
          <span class="cat-name">{{ group.label }}</span>
          <span class="cat-count">({{ group.widgets.length }})</span>
        </button>
        <div v-show="expanded[group.category]" class="tiles">
          <button
            v-for="w in group.widgets"
            :key="w.type"
            class="tile"
            draggable="true"
            :title="w.type"
            @click="store.addWidget(w.type)"
            @dragstart="onDragStart($event, w.type)"
          >
            <span class="tile-icon" :data-icon="w.icon ?? w.type">{{ iconChar(w) }}</span>
            <span class="tile-label">{{ w.label["zh-CN"] || w.type }}</span>
          </button>
        </div>
      </div>
      <p v-if="!visibleGroups.length" class="empty">无匹配控件</p>
    </div>

    <div v-else class="custom-list">
      <div v-if="store.customWidgets.length" class="tiles">
        <button
          v-for="cw in store.customWidgets"
          :key="cw.id"
          class="tile"
          draggable="true"
          :title="cw.id"
          @click="store.addCustomWidget(cw.id)"
          @dragstart="onCustomDragStart($event, cw.id)"
        >
          <span class="tile-icon">★</span>
          <span class="tile-label">{{ cw.name }}</span>
        </button>
      </div>
      <div v-else class="custom-empty">
        <p>暂无自定义控件</p>
        <p class="hint">在控件树 ⋯ 菜单选择「创建自定义控件」</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import type { WidgetMeta } from "../env";
import { widgetIconChar } from "../utils/widget-icons";

type TabId = "system" | "custom";

const store = useProjectStore();
const tab = ref<TabId>("system");
const query = ref("");
const expanded = reactive<Record<string, boolean>>({});

function onDragStart(e: DragEvent, type: string) {
  e.dataTransfer?.setData("application/x-forgeui-widget", type);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
}

function onCustomDragStart(e: DragEvent, customId: string) {
  e.dataTransfer?.setData("application/x-forgeui-custom-widget", customId);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
}

function iconChar(w: WidgetMeta) {
  return widgetIconChar(w.icon ?? w.type);
}

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase();
  const buckets = new Map<string, WidgetMeta[]>();
  const order = ["layout", "button", "display", "input", "media", "viz"];
  const labels: Record<string, string> = {
    layout: "布局容器",
    button: "按钮",
    display: "数据展示",
    input: "表单输入",
    media: "图片媒体",
    viz: "可视化",
  };

  for (const w of store.widgets) {
    if (w.type === "screen") continue;
    const cat = w.category ?? "layout";
    const zh = w.label["zh-CN"]?.toLowerCase() ?? "";
    const en = w.label.en?.toLowerCase() ?? "";
    if (q && !w.type.includes(q) && !zh.includes(q) && !en.includes(q)) continue;
    const list = buckets.get(cat) ?? [];
    list.push(w);
    buckets.set(cat, list);
  }

  return order
    .filter((id) => buckets.has(id))
    .map((category) => ({
      category,
      label: labels[category] ?? category,
      widgets: buckets.get(category) ?? [],
    }));
});

function toggleCategory(id: string) {
  expanded[id] = !expanded[id];
}

function ensureExpanded() {
  for (const g of visibleGroups.value) {
    if (expanded[g.category] === undefined) expanded[g.category] = true;
  }
}

onMounted(ensureExpanded);
watch(visibleGroups, ensureExpanded);
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 52vh;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 6px;
  font-weight: 600;
}

.icon-grid {
  color: var(--accent);
  font-size: 16px;
}

.tabs {
  display: flex;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
}

.tabs button {
  flex: 1;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 8px 4px;
  font-size: 13px;
  color: var(--muted);
  border-bottom: 2px solid transparent;
}

.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px;
  padding: 6px 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.search-icon {
  color: var(--muted);
  font-size: 14px;
}

.search-wrap input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.categories {
  overflow: auto;
  padding: 0 6px 8px;
  min-height: 0;
}

.category {
  margin-bottom: 4px;
}

.cat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}

.cat-head:hover {
  background: rgba(61, 156, 240, 0.08);
}

.arrow {
  width: 12px;
  color: var(--muted);
  font-size: 11px;
}

.cat-name {
  flex: 1;
}

.cat-count {
  color: var(--muted);
  font-size: 12px;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px 2px 8px 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-2);
  font-size: 11px;
  min-height: 64px;
}

.tile:hover {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.12);
}

.tile-icon {
  font-size: 18px;
  line-height: 1;
}

.tile-label {
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
}

.empty,
.custom-empty {
  padding: 16px 12px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.custom-list {
  overflow: auto;
  padding: 8px 6px;
  min-height: 0;
}

.custom-list .tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px 2px 8px;
}

.custom-empty .hint {
  margin-top: 6px;
  font-size: 12px;
}
</style>
