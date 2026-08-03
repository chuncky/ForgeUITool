<template>
  <section v-if="store.loaded" class="page-tree">
    <div class="section pages">
      <header class="sec-head">
        <span class="sec-title">页面 [{{ store.loaded.project.screens.length }}]</span>
        <button type="button" class="add-btn" title="新建页面" @click="store.addScreen()">+</button>
      </header>
      <ul class="page-list">
        <li
          v-for="ref in store.loaded.project.screens"
          :key="ref.id"
          class="page-row"
          :class="{ active: ref.id === store.screenId }"
        >
          <template v-if="editingId === ref.id">
            <input
              ref="editInput"
              v-model="editName"
              class="edit-input"
              @keydown.enter="commitRename(ref.id)"
              @keydown.esc="cancelRename"
              @blur="commitRename(ref.id)"
            />
          </template>
          <button
            v-else
            type="button"
            class="page-label"
            @click="store.switchScreen(ref.id)"
            @dblclick.stop="startRename(ref.id)"
          >
            {{ screenLabel(ref.id) }}
          </button>
          <button
            type="button"
            class="icon-btn"
            :class="{ on: store.loaded.project.defaultScreen === ref.id }"
            title="设为启动页"
            @click.stop="store.setStartupScreen(ref.id)"
          >
            🚀
          </button>
          <button
            type="button"
            class="icon-btn"
            title="更多"
            @click.stop="openPageMenu(ref.id, $event)"
          >
            ⋯
          </button>
        </li>
      </ul>
    </div>

    <div class="section tree">
      <header class="sec-head">
        <span class="sec-title">控件树 [{{ nodeCount }}]</span>
      </header>
      <ul v-if="store.currentScreen" class="widget-tree">
        <ComponentTreeNode
          v-for="c in store.currentScreen.children"
          :key="c.id"
          :node="c"
          @menu="openWidgetMenu"
        />
      </ul>
      <p v-else class="empty">无页面</p>
    </div>

    <FloatingPanelMenu v-model:open="pageMenuOpen" :anchor="pageMenuAnchor">
      <button @click="onPageMenu('rename')">重命名</button>
      <button @click="onPageMenu('copy')">复制页面</button>
      <button @click="onPageMenu('up')">上移</button>
      <button @click="onPageMenu('down')">下移</button>
      <button @click="onPageMenu('top')">置顶</button>
      <button @click="onPageMenu('bottom')">置底</button>
      <button class="danger" @click="onPageMenu('delete')">删除</button>
    </FloatingPanelMenu>

    <FloatingPanelMenu v-model:open="widgetMenuOpen" :anchor="widgetMenuAnchor">
      <button @click="onWidgetMenu('lock')">{{ widgetMenuNode?.locked ? "解锁" : "锁定" }}</button>
      <button @click="onWidgetMenu('copy')">复制</button>
      <button @click="onWidgetMenu('up')">上移</button>
      <button @click="onWidgetMenu('down')">下移</button>
      <button @click="onWidgetMenu('top')">置顶</button>
      <button @click="onWidgetMenu('bottom')">置底</button>
      <button class="danger" @click="onWidgetMenu('delete')">删除</button>
    </FloatingPanelMenu>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { UiNode } from "../env";
import { useProjectStore } from "../stores/project";
import ComponentTreeNode from "./ComponentTreeNode.vue";
import FloatingPanelMenu from "./FloatingPanelMenu.vue";

const store = useProjectStore();
const editingId = ref<string | null>(null);
const editName = ref("");
const editInput = ref<HTMLInputElement | null>(null);

const pageMenuOpen = ref(false);
const pageMenuAnchor = ref<HTMLElement | null>(null);
const pageMenuTargetId = ref<string | null>(null);

const widgetMenuOpen = ref(false);
const widgetMenuAnchor = ref<HTMLElement | null>(null);
const widgetMenuNode = ref<UiNode | null>(null);

function screenLabel(id: string): string {
  const doc = store.loaded?.screens[id];
  return doc?.name || id;
}

function countDescendants(node: UiNode): number {
  let n = 0;
  for (const c of node.children) {
    n += 1 + countDescendants(c);
  }
  return n;
}

const nodeCount = computed(() => {
  const screen = store.currentScreen;
  if (!screen) return 0;
  return countDescendants(screen);
});

function startRename(id: string) {
  closeMenus();
  editingId.value = id;
  editName.value = screenLabel(id);
  void nextTick(() => editInput.value?.focus());
}

function cancelRename() {
  editingId.value = null;
}

async function commitRename(id: string) {
  if (editingId.value !== id) return;
  const name = editName.value.trim();
  editingId.value = null;
  if (name && name !== screenLabel(id)) {
    await store.renameScreenName(id, name);
  }
}

function closeMenus() {
  pageMenuOpen.value = false;
  widgetMenuOpen.value = false;
}

function openPageMenu(id: string, e: MouseEvent) {
  widgetMenuOpen.value = false;
  const el = e.currentTarget as HTMLElement;
  if (pageMenuOpen.value && pageMenuTargetId.value === id) {
    pageMenuOpen.value = false;
    return;
  }
  pageMenuTargetId.value = id;
  pageMenuAnchor.value = el;
  pageMenuOpen.value = true;
}

function openWidgetMenu(node: UiNode, el: HTMLElement) {
  pageMenuOpen.value = false;
  if (widgetMenuOpen.value && widgetMenuNode.value?.id === node.id) {
    widgetMenuOpen.value = false;
    return;
  }
  widgetMenuNode.value = node;
  widgetMenuAnchor.value = el;
  widgetMenuOpen.value = true;
}

async function onPageMenu(action: string) {
  const id = pageMenuTargetId.value;
  pageMenuOpen.value = false;
  if (!id) return;
  if (action === "rename") startRename(id);
  else if (action === "copy") await store.duplicateScreenById(id);
  else if (action === "up") await store.reorderScreenById(id, "up");
  else if (action === "down") await store.reorderScreenById(id, "down");
  else if (action === "top") await store.reorderScreenById(id, "top");
  else if (action === "bottom") await store.reorderScreenById(id, "bottom");
  else if (action === "delete") await store.removeScreenById(id);
}

async function onWidgetMenu(action: string) {
  const node = widgetMenuNode.value;
  widgetMenuOpen.value = false;
  if (!node) return;
  const id = node.id;
  if (action === "lock") await store.toggleNodeLocked(id);
  else if (action === "copy") await store.duplicateNodeById(id);
  else if (action === "up") await store.moveNodeOrderById(id, "up");
  else if (action === "down") await store.moveNodeOrderById(id, "down");
  else if (action === "top") await store.moveNodeOrderById(id, "top");
  else if (action === "bottom") await store.moveNodeOrderById(id, "bottom");
  else if (action === "delete") await store.removeNodeById(id);
}
</script>

<style scoped>
.page-tree {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pages {
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.tree {
  flex: 1;
  min-height: 0;
}

.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 6px;
}

.sec-title {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.03em;
}

.add-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  background: var(--accent-2);
  border-color: var(--accent);
  font-size: 16px;
  line-height: 1;
}

.page-list,
.widget-tree {
  list-style: none;
  margin: 0;
  padding: 0 6px;
  max-height: 160px;
  overflow: auto;
}

.widget-tree {
  max-height: none;
  flex: 1;
  overflow: auto;
  padding-bottom: 8px;
}

.page-row {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.page-row.active {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.12);
  box-shadow: inset 3px 0 0 var(--accent);
}

.page-label {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 6px 8px;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-input {
  flex: 1;
  margin: 2px 4px;
  padding: 4px 6px;
  font-size: 12px;
  background: var(--bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: inherit;
}

.icon-btn {
  padding: 2px 6px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.7;
}

.icon-btn.on {
  opacity: 1;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.empty {
  margin: 8px 10px;
  font-size: 12px;
  color: var(--muted);
}
</style>
