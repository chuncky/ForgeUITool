<template>
  <div v-if="ui.showHistory" class="mask" @click.self="close">
    <div class="dialog" role="dialog" aria-label="历史版本">
      <header class="dlg-head">
        <h2>历史版本</h2>
        <button type="button" class="icon-btn" title="关闭" @click="close">×</button>
      </header>

      <div class="body">
        <!-- Left: pages of selected version -->
        <aside class="col pages">
          <div class="col-title">页面</div>
          <button
            v-for="id in pageIds"
            :key="id"
            type="button"
            class="page-row"
            :class="{ on: id === selectedPageId }"
            @click="selectedPageId = id"
          >{{ pageName(id) }}</button>
          <p v-if="!pageIds.length" class="empty-inline">选择右侧版本</p>
        </aside>

        <!-- Center: preview + restore -->
        <section class="col center">
          <div class="center-bar">
            <button
              type="button"
              class="restore-btn"
              :disabled="!selectedId"
              @click="restore"
            >
              <span class="restore-ico" aria-hidden="true">↺</span>
              恢复到此版本
            </button>
          </div>
          <div class="preview-wrap">
            <div
              v-if="previewRoot"
              class="scale-box"
              :style="{
                width: `${previewW * previewScale}px`,
                height: `${previewH * previewScale}px`,
              }"
            >
              <div
                class="scale-inner"
                :style="{
                  width: `${previewW}px`,
                  height: `${previewH}px`,
                  transform: `scale(${previewScale})`,
                }"
              >
                <HistoryScreenPreview
                  :root="previewRoot"
                  :width="previewW"
                  :height="previewH"
                />
              </div>
            </div>
            <p v-else class="empty-center">{{ loadingPreview ? "加载预览…" : "请选择历史版本" }}</p>
          </div>
        </section>

        <!-- Right: timeline -->
        <aside class="col history">
          <div class="col-title">历史版本</div>
          <div class="quota">已存档 {{ items.length }}/{{ maxSnapshots }}</div>
          <div v-if="items.length" class="timeline">
            <article
              v-for="s in items"
              :key="s.id"
              class="card"
              :class="{ on: s.id === selectedId }"
              @click="selectVersion(s.id)"
            >
              <div class="card-time">{{ formatTime(s.createdAt) }}</div>
              <div class="thumb-wrap">
                <div
                  v-if="thumbCache[s.id]"
                  class="scale-box"
                  :style="thumbBoxStyle(s)"
                >
                  <div
                    class="scale-inner"
                    :style="{
                      width: `${thumbCache[s.id]!.width}px`,
                      height: `${thumbCache[s.id]!.height}px`,
                      transform: `scale(${thumbScale(s)})`,
                    }"
                  >
                    <HistoryScreenPreview
                      :root="thumbCache[s.id]!.root"
                      :width="thumbCache[s.id]!.width"
                      :height="thumbCache[s.id]!.height"
                    />
                  </div>
                </div>
                <div v-else class="thumb-ph">{{ s.pageCount }} 页</div>
              </div>
              <div class="card-foot">
                <span>{{ s.pageCount }} 个页面</span>
                <span>{{ formatSize(s.byteSize) }}</span>
                <button
                  type="button"
                  class="del"
                  title="删除此版本"
                  @click.stop="remove(s.id)"
                >删除</button>
              </div>
            </article>
          </div>
          <p v-else class="empty-inline">暂无历史快照，请先存档（Ctrl+S）</p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { Node } from "@forgeui/core/types";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import HistoryScreenPreview from "./HistoryScreenPreview.vue";

type SnapMeta = {
  id: string;
  label?: string;
  createdAt: string;
  pageCount: number;
  byteSize: number;
  width?: number;
  height?: number;
  screenIds?: string[];
  defaultScreen?: string;
};

type ThumbPayload = { root: Node; width: number; height: number };

const store = useProjectStore();
const ui = useUiStore();

const maxSnapshots = 50;
const items = ref<SnapMeta[]>([]);
const selectedId = ref<string | null>(null);
const selectedPageId = ref<string | null>(null);
const loadingPreview = ref(false);
const previewRoot = ref<Node | null>(null);
const previewW = ref(480);
const previewH = ref(320);
const pageIds = ref<string[]>([]);
const pageNames = reactive<Record<string, string>>({});
const thumbCache = reactive<Record<string, ThumbPayload>>({});

watch(
  () => ui.showHistory,
  (open) => {
    if (open) void openDialog();
  },
);

const previewScale = computed(() => {
  const maxW = 520;
  const maxH = 560;
  const sx = maxW / Math.max(1, previewW.value);
  const sy = maxH / Math.max(1, previewH.value);
  return Math.min(1, sx, sy);
});

function thumbScale(s: SnapMeta) {
  const w = thumbCache[s.id]?.width ?? s.width ?? 480;
  const h = thumbCache[s.id]?.height ?? s.height ?? 320;
  return Math.min(168 / w, 110 / h);
}

function thumbBoxStyle(s: SnapMeta) {
  const w = thumbCache[s.id]?.width ?? s.width ?? 480;
  const h = thumbCache[s.id]?.height ?? s.height ?? 320;
  const scale = thumbScale(s);
  return { width: `${w * scale}px`, height: `${h * scale}px` };
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
  } catch {
    return iso;
  }
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pageName(id: string) {
  return pageNames[id] || id;
}

async function openDialog() {
  items.value = (await store.fetchSnapshots()) as SnapMeta[];
  Object.keys(thumbCache).forEach((k) => delete thumbCache[k]);
  if (!items.value.length) {
    selectedId.value = null;
    selectedPageId.value = null;
    previewRoot.value = null;
    pageIds.value = [];
    return;
  }
  await selectVersion(items.value[0]!.id);
  // Lazy-load thumbs for visible cards
  for (const s of items.value.slice(0, 8)) {
    void ensureThumb(s.id);
  }
}

async function ensureThumb(id: string) {
  if (thumbCache[id]) return;
  try {
    const data = await store.fetchSnapshotPreview(id);
    const def = data.meta.defaultScreen ?? data.project.defaultScreen ?? data.project.screens[0]?.id;
    const screen = def ? data.screens[def] : undefined;
    if (!screen) return;
    thumbCache[id] = {
      root: screen,
      width: data.project.display.width,
      height: data.project.display.height,
    };
  } catch {
    /* ignore thumb errors */
  }
}

const previewData = ref<Awaited<ReturnType<typeof store.fetchSnapshotPreview>> | null>(null);

async function selectVersion(id: string) {
  selectedId.value = id;
  loadingPreview.value = true;
  try {
    const data = await store.fetchSnapshotPreview(id);
    previewData.value = data;
    previewW.value = data.project.display.width;
    previewH.value = data.project.display.height;
    pageIds.value = data.project.screens.map((s) => s.id);
    for (const sid of pageIds.value) {
      pageNames[sid] = data.screens[sid]?.name || sid;
    }
    const prefer =
      selectedPageId.value && pageIds.value.includes(selectedPageId.value)
        ? selectedPageId.value
        : data.meta.defaultScreen ?? data.project.defaultScreen ?? pageIds.value[0] ?? null;
    selectedPageId.value = prefer;
    applyPage(prefer);
    void ensureThumb(id);
  } finally {
    loadingPreview.value = false;
  }
}

function applyPage(pageId: string | null) {
  const data = previewData.value;
  if (!pageId || !data) {
    previewRoot.value = null;
    return;
  }
  previewRoot.value = data.screens[pageId] ?? null;
}

watch(selectedPageId, (pid) => {
  if (!selectedId.value || !pid || !previewData.value) return;
  if (previewData.value.meta.id !== selectedId.value) return;
  applyPage(pid);
});

async function restore() {
  if (!selectedId.value) return;
  const ok = await store.restoreSnapshot(selectedId.value);
  if (ok) ui.showHistory = false;
}

async function remove(id: string) {
  if (!window.confirm("确定删除该历史版本？此操作不可撤销。")) return;
  const list = await store.deleteSnapshot(id);
  items.value = list as SnapMeta[];
  delete thumbCache[id];
  if (selectedId.value === id) {
    if (items.value[0]) await selectVersion(items.value[0].id);
    else {
      selectedId.value = null;
      previewRoot.value = null;
      pageIds.value = [];
    }
  }
}

function close() {
  ui.showHistory = false;
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 20px;
}

.dialog {
  width: min(1120px, 96vw);
  height: min(720px, 92vh);
  background: #1b2430;
  border: 1px solid #2c3848;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e7eef7;
}

.dlg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #2c3848;
}

.dlg-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9db0c5;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.icon-btn:hover {
  background: #2a3544;
  color: #fff;
}

.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 168px 1fr 240px;
}

.col {
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

.col.pages {
  border-right: 1px solid #2c3848;
  background: #171e28;
}

.col.history {
  border-left: 1px solid #2c3848;
  background: #171e28;
}

.col-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}

.quota {
  font-size: 12px;
  color: #8fa3b8;
  margin: -4px 0 12px;
}

.page-row {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
  background: transparent;
  color: #d5e0ec;
  font-size: 13px;
  cursor: pointer;
}
.page-row:hover {
  background: #243041;
}
.page-row.on {
  background: #2f6fed;
  color: #fff;
}

.center {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #121820;
}

.center-bar {
  display: flex;
  justify-content: flex-end;
}

.restore-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 6px;
  background: #2f6fed;
  color: #fff;
  font-size: 13px;
  padding: 8px 14px;
  cursor: pointer;
}
.restore-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.restore-ico {
  font-size: 14px;
}

.preview-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: auto;
  padding: 8px;
}

.scale-box {
  overflow: hidden;
  position: relative;
}
.scale-inner {
  transform-origin: top left;
}

.empty-center,
.empty-inline {
  margin: 0;
  font-size: 12px;
  color: #8093a8;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  padding-left: 14px;
}
.timeline::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #2f3d4f;
}

.card {
  position: relative;
  background: #1e2835;
  border: 1px solid #314155;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
}
.card::before {
  content: "";
  position: absolute;
  left: -14px;
  top: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3d4f66;
  border: 2px solid #171e28;
}
.card.on {
  border-color: #2f6fed;
  box-shadow: 0 0 0 1px #2f6fed55;
}
.card.on::before {
  background: #2f6fed;
}

.card-time {
  font-size: 11px;
  color: #9db0c5;
  margin-bottom: 6px;
}

.thumb-wrap {
  width: 168px;
  height: 110px;
  border-radius: 4px;
  overflow: hidden;
  background: #0f141b;
  display: grid;
  place-items: start;
}

.thumb-ph {
  width: 100%;
  height: 110px;
  display: grid;
  place-items: center;
  color: #6f8298;
  font-size: 12px;
}

.card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: #8fa3b8;
}
.card-foot .del {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #e25555;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
}
.card-foot .del:hover {
  color: #ff7b7b;
}
</style>
