<template>
  <li class="node-wrap">
    <div
      class="row"
      :class="{
        on: store.isSelected(node.id),
        hidden: node.hidden,
        locked: node.locked,
        'drop-before': dropMode === 'before',
        'drop-after': dropMode === 'after',
        'drop-inside': dropMode === 'inside',
      }"
      :draggable="!node.locked"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <button type="button" class="main" @click.stop="onSelect">
        <span class="type">{{ node.type }}</span>
        <span class="name">{{ node.name || node.id }}</span>
      </button>
      <button
        type="button"
        class="icon-btn"
        :title="node.hidden ? '显示' : '隐藏'"
        @click.stop="store.toggleNodeHidden(node.id)"
      >
        {{ node.hidden ? "👁‍🗨" : "👁" }}
      </button>
      <button
        type="button"
        class="icon-btn"
        title="更多"
        @click.stop="onMenuClick"
      >
        ⋯
      </button>
    </div>
    <ul v-if="node.children?.length">
      <ComponentTreeNode v-for="c in node.children" :key="c.id" :node="c" @menu="(n, el) => emit('menu', n, el)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { UiNode } from "../env";
import { findNode, findParentNode, useProjectStore } from "../stores/project";

const TREE_MIME = "application/x-forgeui-tree-node";

/** Chromium: getData is empty during dragover — share id across instances. */
let activeTreeDragId = "";

const props = defineProps<{ node: UiNode }>();
const emit = defineEmits<{
  menu: [node: UiNode, anchor: HTMLElement];
}>();

const store = useProjectStore();
const dropMode = ref<"before" | "after" | "inside" | null>(null);

function onSelect(e: MouseEvent) {
  store.select(props.node.id, { additive: e.ctrlKey || e.metaKey });
}

function onMenuClick(e: MouseEvent) {
  emit("menu", props.node, e.currentTarget as HTMLElement);
}

function onDragStart(e: DragEvent) {
  if (props.node.locked) {
    e.preventDefault();
    return;
  }
  activeTreeDragId = props.node.id;
  e.dataTransfer?.setData(TREE_MIME, props.node.id);
  e.dataTransfer!.effectAllowed = "move";
}

function onDragEnd() {
  dropMode.value = null;
  activeTreeDragId = "";
}

function containsId(root: UiNode, id: string): boolean {
  if (root.id === id) return true;
  return root.children.some((c) => containsId(c, id));
}

function canDrop(dragId: string): boolean {
  if (!dragId || dragId === props.node.id) return false;
  const screen = store.currentScreen;
  if (!screen) return false;
  const dragNode = findNode(screen, dragId);
  if (!dragNode) return false;
  if (containsId(dragNode, props.node.id)) return false;
  return true;
}

function resolveMode(e: DragEvent, el: HTMLElement): "before" | "after" | "inside" {
  const rect = el.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
  const canInside = store.widgetSpec(props.node.type)?.isContainer === true;
  if (canInside && ratio > 0.25 && ratio < 0.75) return "inside";
  return ratio < 0.5 ? "before" : "after";
}

function onDragOver(e: DragEvent) {
  const known = e.dataTransfer?.types.includes(TREE_MIME);
  if (!known) {
    dropMode.value = null;
    return;
  }
  const id = activeTreeDragId;
  if (!id || !canDrop(id)) {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    dropMode.value = null;
    return;
  }
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dropMode.value = resolveMode(e, e.currentTarget as HTMLElement);
}

function onDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  dropMode.value = null;
}

async function onDrop(e: DragEvent) {
  const dragId = e.dataTransfer?.getData(TREE_MIME) || activeTreeDragId;
  const mode = dropMode.value ?? resolveMode(e, e.currentTarget as HTMLElement);
  dropMode.value = null;
  activeTreeDragId = "";
  if (!dragId || !canDrop(dragId)) return;

  if (mode === "inside") {
    const len = props.node.children?.length ?? 0;
    await store.moveNodeById(dragId, props.node.id, len);
    return;
  }

  const screen = store.currentScreen;
  if (!screen) return;
  const parent = findParentNode(screen, props.node.id);
  if (!parent) return;
  const idx = parent.children.findIndex((c) => c.id === props.node.id);
  if (idx < 0) return;
  const insertAt = mode === "before" ? idx : idx + 1;
  await store.moveNodeById(dragId, parent.id, insertAt);
}
</script>

<style scoped>
.node-wrap {
  list-style: none;
}

ul {
  list-style: none;
  margin: 0;
  padding-left: 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.row.on {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.12);
  box-shadow: inset 3px 0 0 var(--accent);
}

.row.hidden .name {
  opacity: 0.45;
  text-decoration: line-through;
}

.row.drop-before {
  box-shadow: inset 0 2px 0 var(--accent);
}

.row.drop-after {
  box-shadow: inset 0 -2px 0 var(--accent);
}

.row.drop-inside {
  border-color: var(--accent);
  background: rgba(61, 156, 240, 0.22);
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  padding: 4px 6px;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  cursor: grab;
}

.row.locked .main {
  cursor: default;
}

.type {
  color: var(--muted);
  font-size: 10px;
  min-width: 52px;
  flex-shrink: 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.icon-btn {
  padding: 2px 6px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.85;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}
</style>
