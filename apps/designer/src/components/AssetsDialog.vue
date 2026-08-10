<template>
  <div v-if="ui.showAssets" class="mask" @click.self="close">
    <div class="dialog" role="dialog" aria-label="资源管理">
      <h2>资源管理</h2>
      <p v-if="ui.fontPickHandler" class="pick-hint">选择字体以填入 text_font</p>
      <p v-else-if="ui.imagePickHandler" class="pick-hint">选择图片以填入属性字段</p>
      <p v-else class="hint">管理工程图片、字体与多语言（对齐 Beken 资源管理）。</p>

      <div class="main-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :class="{ active: mainTab === 'images' }"
          :aria-selected="mainTab === 'images'"
          @click="mainTab = 'images'"
        >
          图片
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: mainTab === 'fonts' }"
          :aria-selected="mainTab === 'fonts'"
          @click="mainTab = 'fonts'"
        >
          字体
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: mainTab === 'i18n' }"
          :aria-selected="mainTab === 'i18n'"
          :disabled="!!ui.imagePickHandler || !!ui.fontPickHandler"
          @click="mainTab = 'i18n'"
        >
          多语言
        </button>
      </div>

      <div v-if="mainTab === 'images'" class="tab-body">
        <div class="toolbar">
          <button type="button" class="primary" :disabled="busy" @click="importImages">
            {{ busy ? "处理中…" : "导入图片" }}
          </button>
          <button type="button" :disabled="busy || !selectedImage" @click="deleteSelectedImage">删除</button>
          <button type="button" :disabled="busy" title="清理未登记且未被引用的文件" @click="pruneOrphans">
            清理孤立文件
          </button>
        </div>
        <div v-if="images.length" class="grid">
          <button
            v-for="img in images"
            :key="img.path"
            type="button"
            class="card"
            :class="{ selected: selectedImage === img.path }"
            @click="onImageClick(img.path)"
            @dblclick="onImageDblClick(img.path)"
          >
            <div class="thumb">
              <img v-if="thumbs[img.path]" :src="thumbs[img.path]" :alt="img.id" />
              <span v-else class="thumb-ph">{{ extLabel(img.path) }}</span>
            </div>
            <span class="name">{{ img.id }}</span>
            <span class="path">{{ img.path }}</span>
          </button>
        </div>
        <p v-else class="empty">暂无图片资源</p>
      </div>

      <div v-else-if="mainTab === 'fonts'" class="tab-body">
        <div class="toolbar">
          <button type="button" class="primary" :disabled="busy" @click="importFonts">
            {{ busy ? "处理中…" : "导入字体" }}
          </button>
          <button type="button" :disabled="busy || !selectedFont" @click="deleteSelectedFont">删除</button>
        </div>
        <ul v-if="fonts.length" class="asset-list">
          <li v-for="f in fonts" :key="f.path">
            <button
              type="button"
              class="asset-row"
              :class="{ selected: selectedFont === f.id }"
              @click="onFontClick(f.id)"
              @dblclick="onFontDblClick(f.id)"
            >
              <span class="name">{{ f.id }}</span>
              <span class="path">{{ f.path }}{{ f.size ? ` · ${f.size}px` : "" }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">暂无字体；导入 TTF 后 generate 将按工程文案裁剪</p>
      </div>

      <div v-else class="tab-body i18n-body">
        <I18nPanel :active="mainTab === 'i18n'" />
      </div>

      <div class="actions">
        <button type="button" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { resolveProjectAssetDataUrl } from "../utils/asset-url";
import I18nPanel from "./I18nPanel.vue";

const store = useProjectStore();
const ui = useUiStore();
const busy = ref(false);
const selectedImage = ref<string | null>(null);
const selectedFont = ref<string | null>(null);
const thumbs = reactive<Record<string, string>>({});

const images = computed(() => store.imageAssets);
const fonts = computed(() => store.fontAssets);

const mainTab = computed({
  get: () => ui.assetsMainTab,
  set: (v: "images" | "fonts" | "i18n") => {
    ui.assetsMainTab = v;
  },
});

watch(
  () => [ui.showAssets, images.value.map((i) => i.path).join("|")] as const,
  async ([open]) => {
    if (!open) return;
    for (const img of images.value) {
      if (thumbs[img.path]) continue;
      const url = await resolveProjectAssetDataUrl(img.path);
      if (url) thumbs[img.path] = url;
    }
  },
  { immediate: true },
);

watch(
  () => ui.showAssets,
  (open) => {
    if (!open) {
      selectedImage.value = null;
      selectedFont.value = null;
    }
  },
);

function extLabel(p: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(p);
  return (m?.[1] ?? "?").toUpperCase();
}

async function importImages() {
  busy.value = true;
  try {
    await store.importImages();
  } finally {
    busy.value = false;
  }
}

async function importFonts() {
  busy.value = true;
  try {
    await store.importFonts();
  } finally {
    busy.value = false;
  }
}

function onImageClick(path: string) {
  selectedImage.value = path;
  if (ui.imagePickHandler) {
    ui.pickImageAsset(path);
  }
}

function onImageDblClick(path: string) {
  if (ui.imagePickHandler) ui.pickImageAsset(path);
  else selectedImage.value = path;
}

function onFontClick(id: string) {
  selectedFont.value = id;
  if (ui.fontPickHandler) {
    ui.pickFontAsset(id);
  }
}

function onFontDblClick(id: string) {
  if (ui.fontPickHandler) ui.pickFontAsset(id);
  else selectedFont.value = id;
}

async function deleteSelectedImage() {
  if (!selectedImage.value) return;
  if (!confirm(`删除图片「${selectedImage.value}」？若仍被控件引用将拒绝删除。`)) return;
  busy.value = true;
  try {
    await store.deleteImage(selectedImage.value);
    delete thumbs[selectedImage.value];
    selectedImage.value = null;
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

async function deleteSelectedFont() {
  if (!selectedFont.value) return;
  if (!confirm(`删除字体「${selectedFont.value}」？若仍被样式引用将拒绝删除。`)) return;
  busy.value = true;
  try {
    await store.deleteFont(selectedFont.value);
    selectedFont.value = null;
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

async function pruneOrphans() {
  busy.value = true;
  try {
    const removed = await store.pruneOrphanImages();
    alert(removed.length ? `已清理 ${removed.length} 个文件` : "无孤立文件");
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

function close() {
  ui.clearImagePick();
  ui.clearFontPick();
  ui.showAssets = false;
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
  width: min(720px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

h2 {
  margin: 0 0 8px;
}

.hint,
.empty,
.pick-hint {
  color: var(--muted);
  font-size: 12px;
}

.pick-hint {
  color: var(--accent);
}

.main-tabs {
  display: flex;
  gap: 4px;
  margin: 12px 0 10px;
  border-bottom: 1px solid var(--border);
}

.main-tabs button {
  padding: 8px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 0;
}

.main-tabs button.active {
  color: var(--text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.main-tabs button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.card:hover,
.card.selected,
.asset-row.selected {
  border-color: var(--accent);
}

.thumb {
  width: 100%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  background: var(--bg);
  border-radius: 4px;
  overflow: hidden;
}

.thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.thumb-ph {
  font-size: 11px;
  color: var(--muted);
}

.asset-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.asset-row {
  width: 100%;
  display: grid;
  gap: 2px;
  padding: 8px;
  margin-bottom: 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-2);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.name {
  font-size: 13px;
  color: var(--text);
}

.path {
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

button {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.i18n-body {
  min-height: 240px;
}
</style>
