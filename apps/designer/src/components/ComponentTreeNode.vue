<template>
  <li class="node-wrap">
    <div class="row" :class="{ on: store.isSelected(node.id), hidden: node.hidden, locked: node.locked }">
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
import type { UiNode } from "../env";
import { useProjectStore } from "../stores/project";

const props = defineProps<{ node: UiNode }>();
const emit = defineEmits<{
  menu: [node: UiNode, anchor: HTMLElement];
}>();

const store = useProjectStore();

function onSelect(e: MouseEvent) {
  store.select(props.node.id, { additive: e.ctrlKey || e.metaKey });
}

function onMenuClick(e: MouseEvent) {
  emit("menu", props.node, e.currentTarget as HTMLElement);
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
  cursor: pointer;
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
